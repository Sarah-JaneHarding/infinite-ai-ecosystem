// Maturity report — Stage 13 step 9.
//
// Computes a school's Learning Engine maturity level from telemetry metrics.
// The four levels come directly from the manual: cold start → locally calibrated →
// evidence-led → institutional.

import type { MaturityLevel } from '@infinite-ai/contracts';

export interface MaturityMetrics {
  readonly editRate: number;
  readonly firstPassAcceptanceRate: number;
  readonly validatedPatternCount: number;
  readonly promotedExemplarCount: number;
  /** Null when insufficient outcome data exists. */
  readonly meanOutcomeDelta: number | null;
  /** Median minutes to artefact approval. */
  readonly medianTimeToArtefactMinutes: number;
}

/**
 * Assigns a maturity level from the school's operational metrics.
 *
 * Thresholds (from the manual's description):
 * - `cold_start`           — no validated patterns yet.
 * - `locally_calibrated`   — patterns are being mined (≥1 validated pattern).
 * - `evidence_led`         — outcome-attributed patterns exist (meanOutcomeDelta not null).
 * - `institutional`        — ≥3 promoted exemplars AND meanOutcomeDelta not null
 *                            AND first-pass acceptance rate ≥ 0.7.
 */
export function assignMaturityLevel(metrics: MaturityMetrics): MaturityLevel {
  if (metrics.validatedPatternCount === 0) {
    return 'cold_start';
  }

  const hasOutcomeEvidence = metrics.meanOutcomeDelta !== null;

  if (
    metrics.promotedExemplarCount >= 3 &&
    hasOutcomeEvidence &&
    metrics.firstPassAcceptanceRate >= 0.7
  ) {
    return 'institutional';
  }

  if (hasOutcomeEvidence) {
    return 'evidence_led';
  }

  return 'locally_calibrated';
}
