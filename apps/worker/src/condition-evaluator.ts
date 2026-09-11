// The real `ConditionEvaluator` (OQ-024) — what a `branch` step's `condition` string
// actually checks, given the `ConditionInput` the runner now builds from a branch step's
// one predecessor (`packages/orchestrator/src/runner.ts`'s `resolveConditionInput`).
//
// Five conditions are declared across MOD-02/MOD-05/LE. Four read `stepOutput` (a single
// prior agent's output or an array of map-step outputs); one reads `runInput` directly.
//
// `support.needs_referral` reads `runInput.activeInterventions[i].siasStatus` (OQ-027
// resolved): the MOD-02 Monitoring pipeline's input carries each learner's current SIAS
// status in the `ActiveInterventionItem` shape (`@infinite-ai/analytics`). The scheduler
// that builds the run input reads the database; this evaluator has no database access and
// depends on `siasStatus` being present and accurate in each item. The condition is true
// when any item has reached REFERRAL_PENDING — the state that gates AC-09 (compile SIAS).

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

/** `mod-02.ts`'s `branch-on-referral`, reading `runInput.activeInterventions` (OQ-027).
 * True when any item has `siasStatus === 'REFERRAL_PENDING'`. The scheduler populates
 * `activeInterventions` from the database; this evaluator trusts the field is accurate. */
function needsReferral(input: ConditionInput): boolean {
  const runInput = input.runInput as
    { activeInterventions?: readonly { siasStatus?: unknown }[] } | null | undefined;
  const items = runInput?.activeInterventions;
  if (!Array.isArray(items)) return false;
  return items.some((item) => item?.siasStatus === 'REFERRAL_PENDING');
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
