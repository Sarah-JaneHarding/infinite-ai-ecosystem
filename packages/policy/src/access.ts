// The purpose filter — Stage 03 step 3.
//
// "Every query for learner data takes a purpose. The data layer intersects the requested
// columns with the purpose's allow-list and the subject's consent, and drops disallowed
// columns rather than failing silently. Log every drop."
//
// Three gates in a fixed order, and the order is the design:
//
//   1. Is the subject tombstoned? Then nothing is readable, whatever anyone consented to.
//   2. Does the purpose permit this category at all? A category outside the purpose's
//      allow-list is refused even with consent — a guardian cannot consent a school into a
//      use the school has not declared.
//   3. Is there a lawful basis for this subject, category and purpose?
//
// Gate 2 before gate 3 is what stops consent being used as a universal solvent. Consent
// widens nothing; it is a precondition on top of a limit that is already fixed.
//
// The result is a projection, never an exception. A hard failure would push callers toward
// requesting less than they need in order to avoid errors, and that ends with someone
// passing a wider purpose to make an error go away. Dropping and logging keeps the caller
// honest and leaves a record of exactly what was withheld and why.

import {
  type ConsentEntry,
  type DataCategory,
  type Purpose,
  permits,
} from '@infinite-ai/contracts';

import { evaluateConsent, type UnresolvedObjection } from './consent.js';

export type DropReason =
  /** The subject's personal information has been tombstoned. */
  | 'subject_tombstoned'
  /** The purpose does not declare this category. */
  | 'purpose_not_permitted'
  /** No entry in the consent ledger for this subject, category and purpose. */
  | 'no_lawful_basis'
  /** Consent was withdrawn, or a §11(1)(f) interest was objected to. */
  | 'consent_withdrawn';

export interface DroppedCategory {
  readonly category: DataCategory;
  readonly reason: DropReason;
}

export interface AccessRequest {
  readonly purpose: Purpose;
  readonly subjectToken: string;
  readonly requested: readonly DataCategory[];
  readonly ledger: readonly ConsentEntry[];
  /** Set when the subject's personal information has been tombstoned. */
  readonly tombstonedAt: Date | null;
  readonly at: Date;
}

export interface AccessDecision {
  readonly purpose: Purpose;
  readonly subjectToken: string;
  readonly allowed: readonly DataCategory[];
  readonly dropped: readonly DroppedCategory[];
  /**
   * Objections that did not stop the processing. Carried on the decision so the caller
   * cannot read the data without also being handed the fact that someone objected to it.
   */
  readonly objections: readonly UnresolvedObjection[];
}

export function resolveAccess(request: AccessRequest): AccessDecision {
  const allowed: DataCategory[] = [];
  const dropped: DroppedCategory[] = [];
  const objections: UnresolvedObjection[] = [];

  for (const category of request.requested) {
    if (request.tombstonedAt !== null) {
      dropped.push({ category, reason: 'subject_tombstoned' });
      continue;
    }
    if (!permits(request.purpose, category)) {
      dropped.push({ category, reason: 'purpose_not_permitted' });
      continue;
    }
    const verdict = evaluateConsent(request.ledger, {
      subjectToken: request.subjectToken,
      category,
      purpose: request.purpose,
      at: request.at,
    });
    if (!verdict.permitted) {
      dropped.push({
        category,
        reason: verdict.reason === 'no_record' ? 'no_lawful_basis' : 'consent_withdrawn',
      });
      continue;
    }
    if (verdict.objection !== null) objections.push(verdict.objection);
    allowed.push(category);
  }

  return {
    purpose: request.purpose,
    subjectToken: request.subjectToken,
    allowed,
    dropped,
    objections,
  };
}

/**
 * The audit payload for a decision.
 *
 * Contains tokens and category names and nothing else — no values, no names, no marks.
 * The drop log is written on every learner-data read, so it is high-volume and long-lived,
 * and a log that accumulates personal information is a second copy of the database with
 * none of its protections.
 */
export interface AccessAuditPayload {
  readonly purpose: Purpose;
  readonly subjectToken: string;
  readonly allowed: readonly DataCategory[];
  readonly dropped: readonly DroppedCategory[];
  readonly objectionCount: number;
}

export function auditPayload(decision: AccessDecision): AccessAuditPayload {
  return {
    purpose: decision.purpose,
    subjectToken: decision.subjectToken,
    allowed: decision.allowed,
    dropped: decision.dropped,
    objectionCount: decision.objections.length,
  };
}

/**
 * Whether a decision returned anything at all.
 *
 * A caller that asked for five categories and received none has been refused in
 * substance, even though nothing threw. Naming that case makes it possible for a module to
 * say "no data available under this purpose" instead of rendering an empty report as
 * though the child had no marks.
 */
export function isEmpty(decision: AccessDecision): boolean {
  return decision.allowed.length === 0;
}
