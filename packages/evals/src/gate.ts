// The CI regression gate — Stage 07 step 5.
//
// "Fail the build on regression beyond the declared tolerance." Distinct from step 4's
// `decidePromotion`: a CI gate runs on every push, automatically, with nobody watching —
// it has no human review to wait for and is not deciding whether to swap the champion
// prompt, only whether this change may land at all. `evaluateGate` reuses the same
// `diffAgainstChampion` (step 3) and `MUST_NOT_REGRESS_TAG` (step 1) the promotion gate
// does for the one check that must never have a tolerance — a `must_not_regress` case
// failing is not a matter of degree — and adds the one check that is: how far the overall
// pass rate may drop before the build fails, a number a team declares, not one this file
// invents.

import { MUST_NOT_REGRESS_TAG } from './case.js';
import { diffAgainstChampion, type EvalRunResult } from './runner.js';

export interface RegressionTolerance {
  /** How far `metrics.passRate` may drop from `baseline` to `current` before the gate
   * fails — e.g. `0.05` allows up to a 5-percentage-point drop. A team's own declared
   * number, not a default this file guesses at. */
  readonly maxPassRateDrop: number;
}

export type GateReasonCode = 'pass_rate_regressed' | 'must_not_regress_case_failed';

export interface GateRefusal {
  readonly code: GateReasonCode;
  readonly detail: string;
}

export type GateVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusals: readonly GateRefusal[] };

/**
 * Decides whether `current` may land, compared against `baseline` — the last known-good
 * run for this agent, however a caller obtained it (a stored champion result, the base
 * branch's own run, whatever "known good" means to the pipeline calling this). `baseline
 * === null` means there is nothing to regress against yet (a brand new agent, or its first
 * ever CI run) — the gate passes, the same "nothing to compare against" shape
 * `diffAgainstChampion` and `decidePromotion` already give a `null` champion.
 */
export function evaluateGate(
  current: EvalRunResult,
  baseline: EvalRunResult | null,
  tolerance: RegressionTolerance,
): GateVerdict {
  if (baseline === null) return { ok: true };

  const refusals: GateRefusal[] = [];

  const diff = diffAgainstChampion(current, baseline);
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

  const drop = baseline.metrics.passRate - current.metrics.passRate;
  if (drop > tolerance.maxPassRateDrop) {
    refusals.push({
      code: 'pass_rate_regressed',
      detail:
        `Pass rate dropped by ${(drop * 100).toFixed(1)} points ` +
        `(${(baseline.metrics.passRate * 100).toFixed(1)}% -> ` +
        `${(current.metrics.passRate * 100).toFixed(1)}%), exceeding the declared ` +
        `tolerance of ${(tolerance.maxPassRateDrop * 100).toFixed(1)} points.`,
    });
  }

  return refusals.length === 0 ? { ok: true } : { ok: false, refusals };
}
