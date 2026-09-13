// The PII egress guard — Stage 03 step 5.
//
// "A mandatory interceptor on the Model Gateway client. It rejects any payload that fails
// the detector or lacks the de-identification provenance flag. Rejection is a hard error,
// never a warning."
//
// Two independent conditions, and the order matters. The guard checks provenance *first*:
// a payload without a `deidentified: true` stamp is refused even if the detector finds
// nothing. That is deliberate and it is the more important of the two checks.
//
// A detector-only guard would be a filter — "we looked and it seemed fine" — and filters
// fail quietly on the cases nobody thought of. Requiring provenance makes the guarantee
// structural instead: the payload is refused unless something upstream took responsibility
// for de-identifying it. The detector then catches the case where that upstream step was
// present but wrong.
//
// There is no bypass, no allow-list and no `force` flag. Rule 4 says so, and every one of
// those would be added for a good reason on a busy afternoon.

import { containsDetectablePii, type TenantLexicon } from '@infinite-ai/deident';

/**
 * The provenance stamp the De-identification Service attaches to its output.
 *
 * `deidentified` is a literal `true` rather than a boolean, so a payload carrying
 * `deidentified: false` will not type-check as stamped — the mistake is caught at compile
 * time rather than at the guard.
 */
export interface DeidentificationProvenance {
  readonly deidentified: true;
  readonly saltVersion: number;
  /** Categories the purpose filter removed. Present so callers can see what they lost. */
  readonly dropped: readonly string[];
}

/** What the gateway client is being asked to send. */
export interface EgressPayload {
  readonly tenantId: string;
  /** Every string that will reach the model: prompt, context, retrieved documents. */
  readonly texts: readonly string[];
  readonly provenance?: DeidentificationProvenance | undefined;
}

export type EgressVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: EgressRefusal; readonly detail: string };

export type EgressRefusal =
  'missing_provenance' | 'detector_found_pii' | 'raw_identifier_present';

export class PiiEgressError extends Error {
  public override readonly name = 'PiiEgressError';
  constructor(
    public readonly reason: EgressRefusal,
    detail: string,
  ) {
    super(`Blocked model egress: ${reason}. ${detail}`);
  }
}

/**
 * Patterns that must never appear in an outbound payload, whatever the provenance says.
 *
 * A stamped payload containing a South African ID number means the de-identification step
 * ran and missed something, which is worse than it not having run — so this check applies
 * after provenance rather than instead of it.
 */
const RAW_IDENTIFIER_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'SA ID number', pattern: /\b\d{13}\b/ },
  { name: 'email address', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/ },
  { name: 'SA phone number', pattern: /(\+27|\b0)\s?\d{2}\s?\d{3}\s?\d{4}\b/ },
];

/**
 * Inspects a payload bound for the model gateway.
 *
 * Returns a verdict rather than throwing, so the gateway can log and count refusals as
 * ordinary events. `assertEgressAllowed` is the throwing form for call sites where a
 * refusal is genuinely exceptional.
 */
export function inspectEgress(
  payload: EgressPayload,
  lexicon: TenantLexicon,
): EgressVerdict {
  // 1. Provenance. Checked first, and on its own sufficient to refuse.
  if (payload.provenance === undefined || payload.provenance.deidentified !== true) {
    return {
      allowed: false,
      reason: 'missing_provenance',
      detail:
        'Payload carries no de-identification provenance. Route learner-derived text ' +
        'through the De-identification Service before calling the gateway.',
    };
  }

  // 2. Raw identifiers, regardless of what the provenance claims.
  for (const text of payload.texts) {
    for (const { name, pattern } of RAW_IDENTIFIER_PATTERNS) {
      if (pattern.test(text)) {
        return {
          allowed: false,
          reason: 'raw_identifier_present',
          detail:
            `A ${name} survived de-identification. This means the scrubber ran and ` +
            'missed something, which needs investigating rather than retrying.',
        };
      }
    }
  }

  // 3. The tenant's own lexicon — the names this school actually uses.
  for (const text of payload.texts) {
    if (containsDetectablePii(text, lexicon)) {
      return {
        allowed: false,
        reason: 'detector_found_pii',
        detail:
          'The detector found personal information in a payload that claimed to be ' +
          'de-identified.',
      };
    }
  }

  return { allowed: true };
}

/** Throws unless the payload may leave. */
export function assertEgressAllowed(
  payload: EgressPayload,
  lexicon: TenantLexicon,
): void {
  const verdict = inspectEgress(payload, lexicon);
  if (!verdict.allowed) throw new PiiEgressError(verdict.reason, verdict.detail);
}
