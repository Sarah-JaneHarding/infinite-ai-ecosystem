// MOD-05 cohort suppression tests — Stage 12 step 6.
//
// Enforces the MINIMUM_COHORT_SIZE = 5 invariant at the contract level.
// When the teacher cohort is too small for a comparative aggregate to be
// privacy-safe, PD-04 must return CohortSuppressionResult, not an ok result.
//
// These are schema-level tests — no live model calls. They assert:
// 1. MINIMUM_COHORT_SIZE is exactly 5.
// 2. CohortSuppressionResult captures all required suppression metadata.
// 3. PD04Result accepts the suppressed path and the ok path.
// 4. The suppressed path never carries needAreas — nothing leaks through.
// 5. PD04Input accepts cohortSize = 0 (the check happens in the agent, not at schema entry).

import { describe, expect, it } from 'vitest';

import {
  CohortSuppressionResult,
  MINIMUM_COHORT_SIZE,
  PD04Input,
  PD04Result,
} from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const NOW = '2026-08-11T10:00:00.000Z';

const VALID_SUPPRESSION = {
  status: 'suppressed' as const,
  reason: 'cohort_below_minimum' as const,
  minimumRequired: 5,
  actual: 3,
  detail:
    'Cohort size 3 is below the minimum required (5) for comparative PD aggregation.',
};

// ---------------------------------------------------------------------------
// MINIMUM_COHORT_SIZE constant
// ---------------------------------------------------------------------------

describe('MINIMUM_COHORT_SIZE', () => {
  it('is exactly 5', () => {
    expect(MINIMUM_COHORT_SIZE).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// CohortSuppressionResult
// ---------------------------------------------------------------------------

describe('CohortSuppressionResult', () => {
  it('accepts a valid suppression result', () => {
    expect(CohortSuppressionResult.safeParse(VALID_SUPPRESSION).success).toBe(true);
  });

  it('requires status: "suppressed"', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, status: 'ok' }).success,
    ).toBe(false);
  });

  it('requires reason: "cohort_below_minimum"', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, reason: 'other_reason' })
        .success,
    ).toBe(false);
  });

  it('requires minimumRequired to be a positive integer', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, minimumRequired: 0 })
        .success,
    ).toBe(false);
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, minimumRequired: -1 })
        .success,
    ).toBe(false);
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, minimumRequired: 1.5 })
        .success,
    ).toBe(false);
  });

  it('accepts actual = 0 (empty cohort is a valid suppression case)', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, actual: 0 }).success,
    ).toBe(true);
  });

  it('rejects actual < 0', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, actual: -1 }).success,
    ).toBe(false);
  });

  it('requires a non-empty detail string', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, detail: '' }).success,
    ).toBe(false);
    expect(
      CohortSuppressionResult.safeParse({ ...VALID_SUPPRESSION, detail: undefined })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PD04Input — cohortSize accepted at any non-negative value
// ---------------------------------------------------------------------------

describe('PD04Input cohortSize', () => {
  const base = {
    tenantId: TENANT,
    signals: [{ signalType: 'coverage' }],
  };

  it('accepts cohortSize = 0 (empty cohort — suppression is enforced by the agent)', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: 0 }).success).toBe(true);
  });

  it('accepts cohortSize = 4 (below minimum — agent must suppress)', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: 4 }).success).toBe(true);
  });

  it('accepts cohortSize = 5 (at minimum threshold)', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: 5 }).success).toBe(true);
  });

  it('accepts cohortSize = 100', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: 100 }).success).toBe(true);
  });

  it('rejects cohortSize < 0', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: -1 }).success).toBe(false);
  });

  it('rejects non-integer cohortSize', () => {
    expect(PD04Input.safeParse({ ...base, cohortSize: 4.5 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PD04Result — suppressed path accepted; ok path requires cohortSize > 0
// ---------------------------------------------------------------------------

describe('PD04Result suppression path', () => {
  it('accepts a suppressed status — suppression is a first-class outcome', () => {
    expect(PD04Result.safeParse(VALID_SUPPRESSION).success).toBe(true);
  });

  it('suppressed result has no needAreas — nothing leaks through suppression', () => {
    const parsed = PD04Result.parse(VALID_SUPPRESSION);
    expect(parsed).not.toHaveProperty('needAreas');
  });

  it('suppressed result has no signalsAggregated — comparative data is withheld', () => {
    const parsed = PD04Result.parse(VALID_SUPPRESSION);
    expect(parsed).not.toHaveProperty('signalsAggregated');
  });

  it('suppressed result carries actual and minimumRequired for audit', () => {
    const parsed = PD04Result.parse(VALID_SUPPRESSION);
    if (parsed.status === 'suppressed') {
      expect(parsed.actual).toBe(3);
      expect(parsed.minimumRequired).toBe(5);
    } else {
      expect.fail('Expected suppressed status');
    }
  });
});

describe('PD04Result ok path', () => {
  const validOk = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    signalsAggregated: 2,
    cohortSize: 8,
    needAreas: [
      {
        area: 'formative_assessment',
        signalSources: ['coverage'],
        urgency: 'high',
        evidenceSummary: 'Topic delivery behind schedule by 3 weeks.',
      },
    ],
    summary: 'The cohort shows a consistent gap in formative assessment practices.',
  };

  it('accepts a valid ok result', () => {
    expect(PD04Result.safeParse(validOk).success).toBe(true);
  });

  it('ok result requires cohortSize > 0 (positive integer)', () => {
    expect(PD04Result.safeParse({ ...validOk, cohortSize: 0 }).success).toBe(false);
  });

  it('ok result requires at least one needArea', () => {
    expect(PD04Result.safeParse({ ...validOk, needAreas: [] }).success).toBe(false);
  });

  it('ok result requires signalsAggregated > 0', () => {
    expect(PD04Result.safeParse({ ...validOk, signalsAggregated: 0 }).success).toBe(
      false,
    );
  });
});
