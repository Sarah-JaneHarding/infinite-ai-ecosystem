// Stage 55 — LE-03 Outcome Attributor unit tests.
//
// Definition of Done: happy path + at least two failure paths.
// Tests inject `today` / window boundaries deterministically; no real dates.

import { describe, expect, it } from 'vitest';
import {
  attributeOutcomes,
  OUTCOME_MIN_COHORT_SIZE,
  type AttributionInput,
  type OutcomeSignal,
} from '../src/outcome-attributor.js';

const DELIVERED_AT = '2026-09-01T08:00:00Z';
const WITHIN_WINDOW = '2026-09-20'; // 19 days after delivery (within 30-day window)
const OUTSIDE_WINDOW = '2026-10-15'; // 44 days after — outside 30-day window
const BEFORE_DELIVERY = '2026-08-25'; // before delivery — negative days

function makeSignal(
  cohortRef: string,
  gradeLabel: string,
  baselineScore: number | null,
  postScore: number | null,
  outcomeDate: string = WITHIN_WINDOW,
): OutcomeSignal {
  return { cohortRef, gradeLabel, baselineScore, postScore, outcomeDate };
}

const BASE_INPUT: AttributionInput = {
  artefactId: 'a0000000-0000-0000-0000-000000000001',
  agentId: 'TB-01',
  capsTopicId: 'CAPS-G4-MATH-T1',
  outcomeSignals: [],
  deliveredAt: DELIVERED_AT,
  attributionWindowDays: 30,
};

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('attributeOutcomes — pre_post_assessment', () => {
  it('selects pre_post_assessment when ≥ MIN signals have both scores', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 55, 68),
      makeSignal('c2', 'Grade 4', 60, 70),
      makeSignal('c3', 'Grade 4', 50, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.method).toBe('pre_post_assessment');
    expect(result.cohortSize).toBe(3);
    expect(result.meanScoreDelta).toBeCloseTo((13 + 10 + 15) / 3, 5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.confidence).toBeLessThanOrEqual(0.9);
  });

  it('confidence is highest (0.9) when every cohort has both scores', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70),
      makeSignal('c2', 'Grade 4', 55, 72),
      makeSignal('c3', 'Grade 4', 45, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.confidence).toBeCloseTo(0.9, 5);
  });

  it('confidence is < 0.9 when some cohorts lack a baseline (partial coverage)', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70),
      makeSignal('c2', 'Grade 4', 55, 72),
      makeSignal('c3', 'Grade 4', 45, 65),
      // c4 has no baseline — reduces coverage fraction
      makeSignal('c4', 'Grade 4', null, 68),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.method).toBe('pre_post_assessment');
    // coverage = 3/4 = 0.75 → confidence = 0.6 + 0.3 * 0.75 = 0.825
    expect(result.confidence).toBeCloseTo(0.825, 4);
  });

  it('methodNote warns that score delta indicates association, not causation', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70),
      makeSignal('c2', 'Grade 4', 55, 72),
      makeSignal('c3', 'Grade 4', 45, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.methodNote).toMatch(/association, not causation/i);
  });
});

describe('attributeOutcomes — cohort_comparison', () => {
  it('selects cohort_comparison when multiple grades present but no pre/post pairs', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', null, 68),
      makeSignal('c2', 'Grade 5', null, 72),
      makeSignal('c3', 'Grade 6', null, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.method).toBe('cohort_comparison');
    expect(result.confidence).toBe(0.5);
    expect(result.meanScoreDelta).toBeNull();
    expect(result.methodNote).toMatch(/no causal claim/i);
  });

  it('prefers pre_post_assessment over cohort_comparison when ≥ MIN have both scores', () => {
    // Multiple grades AND some have pre/post — pre_post wins
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70),
      makeSignal('c2', 'Grade 5', 55, 72),
      makeSignal('c3', 'Grade 6', 45, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.method).toBe('pre_post_assessment');
  });
});

describe('attributeOutcomes — temporal_proximity', () => {
  it('falls back to temporal_proximity when no baseline and single grade', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', null, 68),
      makeSignal('c2', 'Grade 4', null, 72),
      makeSignal('c3', 'Grade 4', null, 65),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.method).toBe('temporal_proximity');
    expect(result.confidence).toBe(0.3);
    expect(result.meanScoreDelta).toBeNull();
    expect(result.methodNote).toMatch(/[Cc]orrelation only/);
  });
});

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('attributeOutcomes — insufficient_data', () => {
  it('returns insufficient_data when zero signals fall within the window', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70, OUTSIDE_WINDOW),
      makeSignal('c2', 'Grade 4', 55, 72, OUTSIDE_WINDOW),
      makeSignal('c3', 'Grade 4', 45, 65, OUTSIDE_WINDOW),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('insufficient_data');
    if (result.status !== 'insufficient_data') return;
    expect(result.actualCohortSize).toBe(0);
    expect(result.requiredCohortSize).toBe(OUTCOME_MIN_COHORT_SIZE);
  });

  it('returns insufficient_data when fewer than MIN cohorts are within the window', () => {
    // Only 2 signals in window — one short of OUTCOME_MIN_COHORT_SIZE (3)
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70, WITHIN_WINDOW),
      makeSignal('c2', 'Grade 4', 55, 72, WITHIN_WINDOW),
      makeSignal('c3', 'Grade 4', 45, 65, OUTSIDE_WINDOW),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('insufficient_data');
    if (result.status !== 'insufficient_data') return;
    expect(result.actualCohortSize).toBe(2);
  });

  it('excludes signals with outcomeDate before delivery from the windowed count', () => {
    const signals = [
      makeSignal('c1', 'Grade 4', 50, 70, BEFORE_DELIVERY),
      makeSignal('c2', 'Grade 4', 55, 72, BEFORE_DELIVERY),
      makeSignal('c3', 'Grade 4', 45, 65, WITHIN_WINDOW),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('insufficient_data');
    if (result.status !== 'insufficient_data') return;
    // Only c3 is within window; c1 and c2 are before delivery (negative days)
    expect(result.actualCohortSize).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Window boundary
// ---------------------------------------------------------------------------

describe('attributeOutcomes — window boundary', () => {
  // deliveredAt = 2026-09-01T08:00:00Z, window = 30 days.
  // daysSinceDelivery uses floor((outcomeDate midnight UTC - deliveredAt) / 86400000).
  // 2026-10-02 midnight UTC is 30d 16h after 2026-09-01 08:00 UTC → floor = 30 → at boundary.
  // 2026-10-03 midnight UTC is 31d 16h after delivery → floor = 31 → outside window.

  it('includes signals on the exact last day of the attribution window (floor = 30)', () => {
    const boundaryDate = '2026-10-02'; // floor((30d 16h) / 1d) = 30 — at boundary
    const signals = [
      makeSignal('c1', 'Grade 4', null, 70, boundaryDate),
      makeSignal('c2', 'Grade 4', null, 72, boundaryDate),
      makeSignal('c3', 'Grade 4', null, 65, boundaryDate),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('ok');
  });

  it('excludes signals one day past the attribution window (floor = 31)', () => {
    const oneDayPast = '2026-10-03'; // floor((31d 16h) / 1d) = 31 > 30 — outside window
    const signals = [
      makeSignal('c1', 'Grade 4', null, 70, oneDayPast),
      makeSignal('c2', 'Grade 4', null, 72, oneDayPast),
      makeSignal('c3', 'Grade 4', null, 65, oneDayPast),
    ];
    const result = attributeOutcomes({ ...BASE_INPUT, outcomeSignals: signals });

    expect(result.status).toBe('insufficient_data');
  });
});
