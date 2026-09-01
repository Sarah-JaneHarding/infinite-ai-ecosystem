// The real `ConditionEvaluator` (OQ-024) — what a `branch` step's `condition` string
// actually checks, given the `ConditionInput` the runner now builds from a branch step's
// one predecessor (`packages/orchestrator/src/runner.ts`'s `resolveConditionInput`).
//
// Four of the five conditions declared across MOD-02/MOD-05/LE are unambiguous: each is
// narrated in its own pipeline file as reading one named prior agent's own `status` field,
// and that field's real literal values are already fixed by a ratified Zod schema
// (`@infinite-ai/analytics`'s `AC02Result`, `@infinite-ai/contracts`'s `PD04Result`,
// `PD05Result`, `LE08Result`). Checks here read `stepOutput` by simple property access
// rather than importing those schemas, since a condition only ever needs one already-typed
// field, not full re-validation of an output the predecessor step already validated (or
// will, once its own contract is enforced end-to-end) — the same lightweight-cast idiom
// `readMapCollection` in runner.ts already uses for an opaque `unknown`.
//
// `support.needs_referral` is the one condition this does NOT resolve (OQ-027): it is
// narrated as reading each monitored learner's current SIAS status, but `activeInterventions`
// — the collection `check-fidelity` (its predecessor) fans out over — has no ratified shape
// carrying that field anywhere in `@infinite-ai/contracts` or `@infinite-ai/analytics`.
// Guessing a field name here is exactly the failure mode OQ-024 itself warned wiring a real
// evaluator would risk ("silently read stale/absent fields... or require inventing which
// fields run.input is expected to carry") — so this throws instead of guessing, the same
// "fail loud, not quietly wrong" choice `worker-host.ts` already made by leaving
// `evaluateCondition` unwired entirely before this file existed.

import type { ConditionEvaluator, ConditionInput } from '@infinite-ai/orchestrator';

export class UnresolvedConditionError extends Error {
  public override readonly name = 'UnresolvedConditionError';
  constructor(message: string) {
    super(message);
  }
}

function statusOf(value: unknown): string | undefined {
  const record = value as Record<string, unknown> | null | undefined;
  const status = record?.status;
  return typeof status === 'string' ? status : undefined;
}

/** `AC02Result.status === 'blocked'` (`@infinite-ai/analytics`'s `agent-schemas.ts`) —
 * `mod-02.ts`'s `branch-on-core-health`, reading `assess-core-health` (AC-02)'s output. */
function coreHealthBlocked(input: ConditionInput): boolean {
  return statusOf(input.stepOutput) === 'blocked';
}

/** `PD04Result.status === 'suppressed'` (`CohortSuppressionResult`, `@infinite-ai/
 * contracts`'s `mod-05/signals.ts`) — `mod-05.ts`'s `branch-on-suppression`, reading
 * `aggregate-signals` (PD-04)'s output. */
function pdIsSuppressed(input: ConditionInput): boolean {
  return statusOf(input.stepOutput) === 'suppressed';
}

/** `PD05Result`'s `'ok'` variant's `topPriorityGap.suggestedInterventionType ===
 * 'micro_course'` (`@infinite-ai/contracts`'s `mod-05/pd-agents.ts`) — `mod-05.ts`'s
 * `branch-on-intervention`, reading `detect-gaps` (PD-05)'s output. A `needs_input` result
 * has no `topPriorityGap` at all, so it reads as `undefined` here, not `'micro_course'` —
 * routing to the coaching-plan path, the same as any other non-micro-course gap. */
function pdNeedsMicroCourse(input: ConditionInput): boolean {
  const record = input.stepOutput as
    { topPriorityGap?: { suggestedInterventionType?: unknown } } | null | undefined;
  return record?.topPriorityGap?.suggestedInterventionType === 'micro_course';
}

/** `LE08Result.status !== 'published'` (`@infinite-ai/contracts`'s `learning/le-agents.ts`)
 * — `le.ts`'s `branch-on-commons-eligible`, reading `evaluate-commons-publish` (LE-08)'s
 * output. LE08Result's real statuses are `'published'`, `'suppressed_below_threshold'`,
 * `'suppressed_no_opt_in'` and `'needs_input'` — there is no literal `'blocked'`, so this
 * checks the negative of the one success status rather than matching a status that can
 * never occur (see `le.ts`'s own corrected comment on this step). */
function commonsPublishBlocked(input: ConditionInput): boolean {
  return statusOf(input.stepOutput) !== 'published';
}

/** `mod-02.ts`'s `branch-on-referral`, reading `check-fidelity` (a `map` step over
 * AC-07 fidelity checks) — see this file's own header for why this one condition is not
 * resolved yet (OQ-027). */
function needsReferral(): boolean {
  throw new UnresolvedConditionError(
    'support.needs_referral: no ratified schema defines a SIAS-status field on ' +
      '`activeInterventions` items (OQ-027) — refusing to guess a field name rather than ' +
      'silently branching on the wrong thing.',
  );
}

const CONDITIONS: ReadonlyMap<string, (input: ConditionInput) => boolean> = new Map([
  ['support.core_health_blocked', coreHealthBlocked],
  ['pd.is_suppressed', pdIsSuppressed],
  ['pd.needs_micro_course', pdNeedsMicroCourse],
  ['learning.commons_publish_blocked', commonsPublishBlocked],
  ['support.needs_referral', needsReferral],
]);

/** The `ConditionEvaluator` `worker-host.ts` supplies to `RunnerOptions`. Throws on any
 * condition string not declared above — an unrecognised condition is a pipeline/evaluator
 * version mismatch, not something to default either way on. */
export const evaluateCondition: ConditionEvaluator = (condition, input) => {
  const check = CONDITIONS.get(condition);
  if (check === undefined) {
    throw new UnresolvedConditionError(
      `No evaluator registered for condition "${condition}".`,
    );
  }
  return check(input);
};
