// Promotion gate — Stage 13 step 5.
//
// Pure logic extracted from LE-07's rules so it can be unit-tested without a model call.
// The gatekeeper agent calls this; the gate cannot be bypassed by any route.
//
// Rules (priority order, all from the prompt):
//   1. biasCheckPassed === false → reject_bias_divergence
//   2. challenger.mustNotRegressPassRate < champion.mustNotRegressPassRate → reject_regression
//   3. challenger.overallPassRate <= champion.overallPassRate → reject_no_improvement
//   4. Otherwise → promote

import type { GatekeeperVerdict } from '@infinite-ai/contracts';

export interface EvalSummary {
  readonly overallPassRate: number;
  readonly mustNotRegressPassRate: number;
  readonly totalCases: number;
  readonly mustNotRegressCases: number;
}

export interface GateInput {
  readonly champion: EvalSummary;
  readonly challenger: EvalSummary;
  /** Absent means bias check was not run — not the same as passing. */
  readonly biasCheckPassed?: boolean;
}

export interface GateResult {
  readonly verdict: GatekeeperVerdict;
  readonly scoreDelta: number;
  readonly mustNotRegressDelta: number;
}

/**
 * Applies LE-07's promotion gate rules deterministically.
 *
 * Called by the gatekeeper agent and directly in unit tests.
 * Returns a verdict and the score deltas that justify it.
 */
export function applyPromotionGate(input: GateInput): GateResult {
  const scoreDelta = input.challenger.overallPassRate - input.champion.overallPassRate;
  const mustNotRegressDelta =
    input.challenger.mustNotRegressPassRate - input.champion.mustNotRegressPassRate;

  let verdict: GatekeeperVerdict;

  if (input.biasCheckPassed === false) {
    verdict = 'reject_bias_divergence';
  } else if (
    input.challenger.mustNotRegressPassRate < input.champion.mustNotRegressPassRate
  ) {
    verdict = 'reject_regression';
  } else if (input.challenger.overallPassRate <= input.champion.overallPassRate) {
    verdict = 'reject_no_improvement';
  } else {
    verdict = 'promote';
  }

  return { verdict, scoreDelta, mustNotRegressDelta };
}
