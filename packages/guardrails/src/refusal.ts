// The typed Refusal result — Stage 06 step 6.
//
// "A typed Refusal result with a reason code, a user-facing explanation, and an escalation
// route for safeguarding categories that pages a named human immediately and never
// queues." Every check in this package (`input-checks.ts`, `output-checks.ts`) returns a
// `GuardrailVerdict` built from this one shape — never a bare string, never a thrown error
// for the ordinary case — the same "a decision, never an exception" reasoning
// `packages/policy/src/access.ts`'s own `resolveAccess` already gives for a purpose/consent
// drop: a hard failure would push callers toward asking for less in order to avoid errors.
//
// `RefusalReasonCode` reuses the exact reason strings the checks it wraps already produce
// (`EgressRefusal` from `pii-guard.ts`, `DropReason` from `packages/policy`) rather than
// renaming them, so a refusal traces back to the one place that decided it without a
// translation step that could silently drift out of sync.

import type { DropReason } from '@infinite-ai/policy';
import { z } from 'zod';

import type { EgressRefusal } from './pii-guard.js';

/**
 * Every reason a guardrail check in this package can refuse for. The three PII values and
 * the four purpose/consent values are exactly `EgressRefusal` and `DropReason` — see this
 * module's own header. The rest name a check this stage builds for the first time.
 */
export const RefusalReasonCode = z.enum([
  'missing_provenance',
  'detector_found_pii',
  'raw_identifier_present',
  'subject_tombstoned',
  'purpose_not_permitted',
  'no_lawful_basis',
  'consent_withdrawn',
  'invalid_input_schema',
  'prompt_injection_detected',
  'token_budget_exceeded',
  'invalid_output_schema',
  'ungrounded_claim',
  'template_infidelity',
  'readability_out_of_range',
  'age_inappropriate',
  'invalid_refusal',
  'cost_budget_exceeded',
  'diagnostic_language_detected',
]);
export type RefusalReasonCode = z.infer<typeof RefusalReasonCode>;

// A compile-time-only check that the two reused reason vocabularies are genuinely subsets
// of `RefusalReasonCode` — if either one grows a value this file forgets to add, this
// fails to typecheck rather than the mismatch surfacing only once a check runs. Erased at
// runtime; nothing here is a value.
type AssertSubset<Superset, Subset extends Superset> = Subset;
export type EgressRefusalIsRefusalReasonCode = AssertSubset<
  RefusalReasonCode,
  EgressRefusal
>;
export type DropReasonIsRefusalReasonCode = AssertSubset<RefusalReasonCode, DropReason>;

/**
 * Where a refusal routes when it needs a human, immediately. `category` names what kind of
 * concern this is — free text, not a closed enum: this codebase has no ratified taxonomy
 * of safeguarding categories (that is a SIAS/DBE policy question, and rule "never invent
 * curriculum or SIAS policy" applies just as much to inventing a category list as it does
 * to inventing a mark allocation — see `docs/OPEN_QUESTIONS.md` OQ-014). `notifyRole`
 * names the role the escalation must reach, the same role vocabulary
 * `packages/policy/src/rbac.ts`'s `Role` already defines.
 */
export const EscalationRoute = z.object({
  category: z.string().min(1),
  notifyRole: z.string().min(1),
});
export type EscalationRoute = z.infer<typeof EscalationRoute>;

export const Refusal = z.object({
  code: RefusalReasonCode,
  explanation: z.string().min(1),
  escalation: EscalationRoute.nullable(),
});
export type Refusal = z.infer<typeof Refusal>;

export type GuardrailVerdict =
  { readonly passed: true } | { readonly passed: false; readonly refusal: Refusal };

export function refuse(
  code: RefusalReasonCode,
  explanation: string,
  escalation: EscalationRoute | null = null,
): GuardrailVerdict {
  return { passed: false, refusal: { code, explanation, escalation } };
}

export const PASSED: GuardrailVerdict = { passed: true };
