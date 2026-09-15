// Eval Gatekeeper — Stage 13 step 5.
//
// Outer LE-07 pure function that wraps applyPromotionGate with full LE07-shaped
// input/output including missing-field detection, evalDeltaSummary, and evaluatedAt.
//
// It is impossible to reach a 'promote' verdict without both eval results present
// and all gate criteria passing — there is no bypass path.

import type { GatekeeperVerdict } from '@infinite-ai/contracts';

import { type EvalSummary, applyPromotionGate } from './promotion-gate.js';

export interface EvalGatekeeperInput {
  readonly tenantId: string;
  readonly agentId: string;
  readonly challengerId: string;
  readonly championEvalResult?: EvalSummary;
  readonly challengerEvalResult?: EvalSummary;
  /** Absent means bias check was not run — not the same as failing. */
  readonly biasCheckPassed?: boolean;
  /** ISO-8601 datetime injected for deterministic testing. */
  readonly now: string;
}

export type EvalGatekeeperDecision =
  | {
      readonly status: 'ok';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly verdict: GatekeeperVerdict;
      readonly scoreDelta: number;
      readonly mustNotRegressDelta: number;
      readonly evalDeltaSummary: string;
      readonly evaluatedAt: string;
    }
  | {
      readonly status: 'needs_input';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly detail: string;
      readonly missingFields: readonly string[];
    };

function buildEvalDeltaSummary(
  champion: EvalSummary,
  challenger: EvalSummary,
  verdict: GatekeeperVerdict,
  scoreDelta: number,
  mustNotRegressDelta: number,
): string {
  const sign = (n: number) => (n >= 0 ? '+' : '');
  return (
    `verdict=${verdict}; ` +
    `overallPassRate: champion=${champion.overallPassRate.toFixed(4)}, ` +
    `challenger=${challenger.overallPassRate.toFixed(4)} ` +
    `(Δ${sign(scoreDelta)}${scoreDelta.toFixed(4)}); ` +
    `mustNotRegress: champion=${champion.mustNotRegressPassRate.toFixed(4)}, ` +
    `challenger=${challenger.mustNotRegressPassRate.toFixed(4)} ` +
    `(Δ${sign(mustNotRegressDelta)}${mustNotRegressDelta.toFixed(4)})`
  );
}

/**
 * Validates a prompt challenger against the LE-07 gate criteria.
 *
 * Returns `needs_input` when either eval result is absent. Otherwise delegates
 * to `applyPromotionGate` and returns a full LE07-shaped `ok` result with the
 * verdict, score deltas, human-readable `evalDeltaSummary`, and `evaluatedAt`.
 */
export function gateChallenger(input: EvalGatekeeperInput): EvalGatekeeperDecision {
  const missingFields: string[] = [];
  if (!input.championEvalResult) missingFields.push('championEvalResult');
  if (!input.challengerEvalResult) missingFields.push('challengerEvalResult');

  if (missingFields.length > 0) {
    return {
      status: 'needs_input',
      tenantId: input.tenantId,
      processedAt: input.now,
      detail: `Missing required eval results: ${missingFields.join(', ')}.`,
      missingFields,
    };
  }

  const champion = input.championEvalResult as EvalSummary;
  const challenger = input.challengerEvalResult as EvalSummary;

  const { verdict, scoreDelta, mustNotRegressDelta } = applyPromotionGate({
    champion,
    challenger,
    ...(input.biasCheckPassed !== undefined
      ? { biasCheckPassed: input.biasCheckPassed }
      : {}),
  });

  return {
    status: 'ok',
    tenantId: input.tenantId,
    processedAt: input.now,
    verdict,
    scoreDelta,
    mustNotRegressDelta,
    evalDeltaSummary: buildEvalDeltaSummary(
      champion,
      challenger,
      verdict,
      scoreDelta,
      mustNotRegressDelta,
    ),
    evaluatedAt: input.now,
  };
}
