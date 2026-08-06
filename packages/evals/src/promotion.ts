// Champion / challenger — Stage 07 step 4.
//
// "Each agent has a champion prompt version. A challenger is promoted only if it (a) beats
// the champion on the primary metric, (b) regresses no case tagged must_not_regress, (c)
// stays inside budget, and (d) passes a human review gate." `decidePromotion` is a pure
// decision function over the two runner outputs (step 3) plus a budget and a human
// verdict — it does not run anything itself, the same "decide, don't execute" boundary
// `packages/policy/src/access.ts`'s own `resolveAccess` already draws. All four gates are
// checked independently and every failing one is reported, not just the first — a
// challenger that is both over budget and missing a review should not have to be
// resubmitted twice to discover the second problem.
//
// Where a champion has no prior run at all (`champion === null` — this agent's first ever
// eval run), gates (a) and (b) have nothing to compare against and are skipped, the exact
// same "no champion yet" shape `runner.ts`'s own `diffAgainstChampion` already gives: there
// is no metric to beat and no case that could have regressed. Gates (c) and (d) still
// apply regardless — a first version still has to fit its budget and still needs a human
// to say yes.

import type { AgentBudget } from '@infinite-ai/agents';

import { MUST_NOT_REGRESS_TAG } from './case.js';
import { diffAgainstChampion, type EvalRunResult } from './runner.js';

export type PromotionReasonCode =
  | 'primary_metric_not_improved'
  | 'must_not_regress_case_failed'
  | 'over_budget'
  | 'human_review_not_approved'
  | 'human_review_missing';

export interface PromotionRefusal {
  readonly code: PromotionReasonCode;
  readonly detail: string;
}

export type PromotionVerdict =
  | { readonly promote: true }
  | { readonly promote: false; readonly refusals: readonly PromotionRefusal[] };

/** "Passes a human review gate" — recorded the same way Stage 06's own `human_gate`
 * decisions are: who decided, and why, never only a bare boolean. */
export interface PromotionReview {
  readonly approved: boolean;
  readonly decidedBy: string;
  readonly reason: string;
}

export interface PromotionOptions {
  readonly budget: AgentBudget;
  /** `null` means no review has happened yet — refused the same way a missing decision
   * is, not treated as an implicit approval. */
  readonly humanReview: PromotionReview | null;
  /** The primary metric to compare the challenger against the champion on. Defaults to
   * `passRate` — the one aggregate metric every run always has, regardless of which
   * scorers a particular case set happens to use. */
  readonly primaryMetric?: (result: EvalRunResult) => number;
}

const defaultPrimaryMetric = (result: EvalRunResult): number => result.metrics.passRate;

/** Gate (c): every case's own reported usage must fit inside the agent's declared budget
 * — the same per-call ceiling `AgentBudget` already documents itself as, checked per case
 * rather than against the run's aggregate total, since the aggregate is not what
 * `AgentBudget` claims to bound. A case that reported no usage at all (`null`) cannot have
 * exceeded a budget it never reported spending against. */
function overBudgetCaseIds(
  challenger: EvalRunResult,
  budget: AgentBudget,
): readonly string[] {
  return challenger.cases
    .filter(
      (c) =>
        (c.tokensUsed !== null && c.tokensUsed > budget.maxTokens) ||
        (c.costUsd !== null && c.costUsd > budget.maxCostUsd),
    )
    .map((c) => c.caseId);
}

/**
 * Decides whether `challenger` may replace `champion` as the agent's champion prompt
 * version. Checks all four named gates independently and collects every refusal reason
 * that applies — never throws for the ordinary "this challenger isn't ready" case, the
 * same "a decision, never an exception" shape this codebase holds to throughout.
 */
export function decidePromotion(
  challenger: EvalRunResult,
  champion: EvalRunResult | null,
  options: PromotionOptions,
): PromotionVerdict {
  const refusals: PromotionRefusal[] = [];
  const primaryMetric = options.primaryMetric ?? defaultPrimaryMetric;

  if (champion !== null) {
    const challengerScore = primaryMetric(challenger);
    const championScore = primaryMetric(champion);
    if (challengerScore <= championScore) {
      refusals.push({
        code: 'primary_metric_not_improved',
        detail:
          `Challenger's primary metric ${challengerScore} does not beat the champion's ` +
          `${championScore}.`,
      });
    }

    const diff = diffAgainstChampion(challenger, champion);
    const regressedMustNotRegress = diff.cases.filter(
      (c) => c.regressed && c.tags.includes(MUST_NOT_REGRESS_TAG),
    );
    if (regressedMustNotRegress.length > 0) {
      refusals.push({
        code: 'must_not_regress_case_failed',
        detail:
          `${regressedMustNotRegress.length} case(s) tagged "${MUST_NOT_REGRESS_TAG}" ` +
          `regressed: ${regressedMustNotRegress.map((c) => c.caseId).join(', ')}.`,
      });
    }
  }

  const overBudget = overBudgetCaseIds(challenger, options.budget);
  if (overBudget.length > 0) {
    refusals.push({
      code: 'over_budget',
      detail: `${overBudget.length} case(s) exceeded the agent's own budget: ${overBudget.join(', ')}.`,
    });
  }

  if (options.humanReview === null) {
    refusals.push({
      code: 'human_review_missing',
      detail: 'No human review decision has been recorded for this challenger.',
    });
  } else if (!options.humanReview.approved) {
    refusals.push({
      code: 'human_review_not_approved',
      detail: `Human review by "${options.humanReview.decidedBy}" did not approve: ${options.humanReview.reason}`,
    });
  }

  return refusals.length === 0 ? { promote: true } : { promote: false, refusals };
}
