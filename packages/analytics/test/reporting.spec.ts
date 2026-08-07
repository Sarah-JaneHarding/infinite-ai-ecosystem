// Reporting pack — unit tests (Stage 10 step 6)

import { describe, expect, it } from 'vitest';

import {
  MIN_COHORT_SIZE,
  rollupClass,
  rollupGrade,
  rollupSchool,
  type LearnerReport,
} from '../src/reporting.js';

const TERM = '33333333-0000-0000-0000-000000000001';

function learner(tier: string, active = false): LearnerReport {
  return {
    learnerId: crypto.randomUUID(),
    termId: TERM,
    siasStatus: 'INTERVENTION_ACTIVE',
    currentTier: tier,
    trendDirection: 'stable',
    recommendation: 'continue',
    interventionActive: active,
    weeksInIntervention: active ? 6 : 0,
  };
}

function learners(specs: Array<[string, boolean?]>): LearnerReport[] {
  return specs.map(([tier, active]) => learner(tier, active));
}

// ---------------------------------------------------------------------------
// Class rollup
// ---------------------------------------------------------------------------

describe('rollupClass', () => {
  it('produces a visible distribution for a cohort above the minimum', () => {
    const reports = learners([
      ['TIER_1'],
      ['TIER_1'],
      ['TIER_2'],
      ['TIER_2'],
      ['TIER_3'],
    ]);
    const cr = rollupClass('cls-1', TERM, reports);
    expect(cr.tierDistribution.suppressed).toBe(false);
    if (!cr.tierDistribution.suppressed) {
      expect(cr.tierDistribution.total).toBe(5);
      expect(cr.tierDistribution.TIER_1).toBe(2);
      expect(cr.tierDistribution.TIER_2).toBe(2);
      expect(cr.tierDistribution.TIER_3).toBe(1);
    }
  });

  it('suppresses a cohort below the minimum', () => {
    const reports = learners([['TIER_1'], ['TIER_2'], ['TIER_3']]);
    const cr = rollupClass('cls-2', TERM, reports);
    expect(cr.tierDistribution.suppressed).toBe(true);
  });

  it(`suppresses exactly at MIN_COHORT_SIZE - 1 (${MIN_COHORT_SIZE - 1} learners)`, () => {
    const reports = learners(
      Array.from({ length: MIN_COHORT_SIZE - 1 }, () => ['TIER_1'] as [string]),
    );
    const cr = rollupClass('cls-3', TERM, reports);
    expect(cr.tierDistribution.suppressed).toBe(true);
  });

  it(`is visible at exactly MIN_COHORT_SIZE (${MIN_COHORT_SIZE} learners)`, () => {
    const reports = learners(
      Array.from({ length: MIN_COHORT_SIZE }, () => ['TIER_1'] as [string]),
    );
    const cr = rollupClass('cls-4', TERM, reports);
    expect(cr.tierDistribution.suppressed).toBe(false);
  });

  it('computes intervention rate correctly', () => {
    const reports = learners([
      ['TIER_1', false],
      ['TIER_2', true],
      ['TIER_2', true],
      ['TIER_3', true],
      ['TIER_1', false],
    ]);
    const cr = rollupClass('cls-5', TERM, reports);
    expect(cr.interventionRate).toBeCloseTo(3 / 5);
  });

  it('provides fidelity rate when counts are supplied', () => {
    const reports = learners([
      ['TIER_1'],
      ['TIER_2'],
      ['TIER_2'],
      ['TIER_3'],
      ['TIER_1'],
    ]);
    const cr = rollupClass('cls-6', TERM, reports, { adequate: 3, total: 4 });
    expect(cr.fidelityRate).toBeCloseTo(0.75);
  });

  it('counts REFERRAL tier', () => {
    const reports = learners([
      ['TIER_1'],
      ['TIER_1'],
      ['TIER_1'],
      ['TIER_1'],
      ['REFERRAL'],
    ]);
    const cr = rollupClass('cls-7', TERM, reports);
    if (!cr.tierDistribution.suppressed) {
      expect(cr.tierDistribution.REFERRAL).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Grade rollup
// ---------------------------------------------------------------------------

describe('rollupGrade', () => {
  it('aggregates class reports into a grade report', () => {
    const cr1 = rollupClass(
      'cls-A',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3']]),
    );
    const cr2 = rollupClass(
      'cls-B',
      TERM,
      learners([['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3'], ['REFERRAL']]),
    );
    const gr = rollupGrade('grd-1', TERM, [cr1, cr2]);
    expect(gr.classCount).toBe(2);
    if (!gr.tierDistribution.suppressed) {
      expect(gr.tierDistribution.total).toBe(10);
      expect(gr.tierDistribution.REFERRAL).toBe(1);
    }
  });

  it('suppresses grade when any class is suppressed', () => {
    const cr1 = rollupClass(
      'cls-A',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3']]),
    );
    const cr2 = rollupClass('cls-B', TERM, learners([['TIER_1']])); // suppressed
    const gr = rollupGrade('grd-2', TERM, [cr1, cr2]);
    expect(gr.tierDistribution.suppressed).toBe(true);
  });

  it('returns empty grade when no class reports provided', () => {
    const gr = rollupGrade('grd-3', TERM, []);
    expect(gr.classCount).toBe(0);
    expect(gr.interventionRate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// School rollup
// ---------------------------------------------------------------------------

describe('rollupSchool', () => {
  it('aggregates grade reports into a school report', () => {
    const cr1 = rollupClass(
      'cls-A',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3']]),
    );
    const cr2 = rollupClass(
      'cls-B',
      TERM,
      learners([['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3'], ['REFERRAL']]),
    );
    const gr1 = rollupGrade('grd-1', TERM, [cr1, cr2]);

    const cr3 = rollupClass(
      'cls-C',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2']]),
    );
    const gr2 = rollupGrade('grd-2', TERM, [cr3]);

    const sr = rollupSchool('sch-1', TERM, [gr1, gr2]);
    expect(sr.gradeCount).toBe(2);
    if (!sr.tierDistribution.suppressed) {
      expect(sr.tierDistribution.total).toBe(15);
    }
  });

  it('suppresses school when any grade is suppressed', () => {
    const suppressedGr = rollupGrade('grd-x', TERM, [
      rollupClass('cls-tiny', TERM, learners([['TIER_1']])), // suppressed class
    ]);
    const cr = rollupClass(
      'cls-ok',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3']]),
    );
    const visibleGr = rollupGrade('grd-ok', TERM, [cr]);
    const sr = rollupSchool('sch-2', TERM, [suppressedGr, visibleGr]);
    expect(sr.tierDistribution.suppressed).toBe(true);
  });

  it('reports gradeCount correctly', () => {
    const cr = rollupClass(
      'cls-1',
      TERM,
      learners([['TIER_1'], ['TIER_1'], ['TIER_2'], ['TIER_2'], ['TIER_3']]),
    );
    const gr = rollupGrade('grd-1', TERM, [cr]);
    const sr = rollupSchool('sch-3', TERM, [gr, gr, gr]);
    expect(sr.gradeCount).toBe(3);
  });
});
