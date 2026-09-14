// Outcome Attributor — Stage 13 step 2.
//
// Pure attribution logic extracted from LE-03's rules so they can be unit-tested
// deterministically.
//
// Manual rule (§13 step 2): "Be honest about causality: record the attribution method
// and its confidence; never present correlation as proof."
//
// Method selection (strongest available wins):
//   pre_post_assessment  — ≥ MIN_COHORT_SIZE signals have both baseline and post scores.
//   cohort_comparison    — multiple distinct grade groups present (no pre/post baseline).
//   temporal_proximity   — outcome observed within window; no baseline or comparison group.
//
// teacher_reported is not selected automatically; it requires a separate input signal
// from the teacher's explicit feedback pathway, which is handled outside this function.

import type { AttributionMethod } from '@infinite-ai/contracts';

/** Minimum cohort entries (within the attribution window) required to produce an attribution. */
export const OUTCOME_MIN_COHORT_SIZE = 3 as const;

export interface OutcomeSignal {
  readonly cohortRef: string;
  readonly gradeLabel: string;
  readonly baselineScore: number | null;
  readonly postScore: number | null;
  readonly outcomeDate: string; // YYYY-MM-DD
}

export interface AttributionInput {
  readonly artefactId: string;
  readonly agentId: string;
  readonly capsTopicId: string;
  readonly outcomeSignals: readonly OutcomeSignal[];
  readonly deliveredAt: string; // ISO-8601 datetime
  readonly attributionWindowDays: number;
}

export type AttributionDecision =
  | {
      readonly status: 'ok';
      readonly method: AttributionMethod;
      readonly confidence: number;
      readonly methodNote: string;
      readonly cohortSize: number;
      readonly meanScoreDelta: number | null;
    }
  | {
      readonly status: 'insufficient_data';
      readonly requiredCohortSize: typeof OUTCOME_MIN_COHORT_SIZE;
      readonly actualCohortSize: number;
    };

function daysSinceDelivery(deliveredAt: string, outcomeDate: string): number {
  const delivered = new Date(deliveredAt).getTime();
  const outcome = new Date(outcomeDate + 'T00:00:00Z').getTime();
  return Math.floor((outcome - delivered) / (1000 * 60 * 60 * 24));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Selects the strongest available attribution method and computes attribution metrics.
 *
 * Returns `insufficient_data` when fewer than OUTCOME_MIN_COHORT_SIZE signals fall
 * within the attribution window — not a failure, just an honest statement that the
 * data is not yet sufficient.
 */
export function attributeOutcomes(input: AttributionInput): AttributionDecision {
  const windowedSignals = input.outcomeSignals.filter((s) => {
    const days = daysSinceDelivery(input.deliveredAt, s.outcomeDate);
    return days >= 0 && days <= input.attributionWindowDays;
  });

  if (windowedSignals.length < OUTCOME_MIN_COHORT_SIZE) {
    return {
      status: 'insufficient_data',
      requiredCohortSize: OUTCOME_MIN_COHORT_SIZE,
      actualCohortSize: windowedSignals.length,
    };
  }

  const withBoth = windowedSignals.filter(
    (s) => s.baselineScore !== null && s.postScore !== null,
  );
  const distinctGrades = new Set(windowedSignals.map((s) => s.gradeLabel));

  if (withBoth.length >= OUTCOME_MIN_COHORT_SIZE) {
    const deltas = withBoth.map(
      (s) => (s.postScore as number) - (s.baselineScore as number),
    );
    const meanScoreDelta = mean(deltas);
    // Confidence: 0.6 base, scaled up by fraction of cohorts with complete data, capped 0.9.
    const coverage = withBoth.length / windowedSignals.length;
    const confidence = Math.min(0.9, 0.6 + 0.3 * coverage);

    return {
      status: 'ok',
      method: 'pre_post_assessment',
      confidence,
      methodNote:
        'Pre/post assessment scores compared for the same cohorts within the attribution window. ' +
        'Observational method — confounding factors (teacher support, prior knowledge, ' +
        'learner motivation) are not controlled. Score delta indicates association, not causation.',
      cohortSize: windowedSignals.length,
      meanScoreDelta,
    };
  }

  if (distinctGrades.size > 1) {
    return {
      status: 'ok',
      method: 'cohort_comparison',
      confidence: 0.5,
      methodNote:
        'Post-delivery scores compared across multiple grade-level cohort groups. ' +
        'Quasi-experimental — groups differ on dimensions beyond artefact delivery. ' +
        'No within-cohort baseline is available; no causal claim is made.',
      cohortSize: windowedSignals.length,
      meanScoreDelta: null,
    };
  }

  return {
    status: 'ok',
    method: 'temporal_proximity',
    confidence: 0.3,
    methodNote:
      'Outcome observed within the attribution window after artefact delivery. ' +
      'Correlation only — no pre-delivery baseline and no comparison group are available. ' +
      'Many other factors could explain the observed outcome.',
    cohortSize: windowedSignals.length,
    meanScoreDelta: null,
  };
}
