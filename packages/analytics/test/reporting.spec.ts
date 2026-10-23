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

  it('leaves a learner with no current tier out of every tier bucket but still counts them in the rate', () => {
    const reports = [
      ...learners([['TIER_1', true], ['TIER_1'], ['TIER_2'], ['TIER_3']]),
      { ...learner('TIER_1', true), currentTier: null },
    ];
    const cr = rollupClass('cls-1', TERM, reports);
    expect(cr.tierDistribution.suppressed).toBe(false);
    if (!cr.tierDistribution.suppressed) {
      expect(cr.tierDistribution.total).toBe(4);
    }
    expect(cr.interventionRate).toBeCloseTo(2 / 5);
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

  it('increments total but not any specific bucket for an unrecognised tier string', () => {
    // addToDistribution falls through its four if-guards to the bare `return next`
    // when the tier value does not match any known string — total still increases.
    const reports = [
      learner('TIER_1'),
      learner('TIER_1'),
      learner('TIER_1'),
      learner('TIER_1'),
      learner('UNKNOWN_TIER'),
    ];
    const cr = rollupClass('cls-8', TERM, reports);
    if (!cr.tierDistribution.suppressed) {
      expect(cr.tierDistribution.total).toBe(5);
      expect(cr.tierDistribution.TIER_1).toBe(4);
      expect(cr.tierDistribution.TIER_2).toBe(0);
      expect(cr.tierDistribution.TIER_3).toBe(0);
      expect(cr.tierDistribution.REFERRAL).toBe(0);
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

const visibleDistribution = (total: number) => ({
  suppressed: false as const,
  TIER_1: total,
  TIER_2: 0,
  TIER_3: 0,
  REFERRAL: 0,
  total,
});

describe('rollupGrade - classes with no known intervention rate', () => {
  it('weights only the classes that report a rate', () => {
    const known = {
      classId: 'a',
      termId: TERM,
      tierDistribution: visibleDistribution(10),
      interventionRate: 0.5,
      fidelityRate: null,
    };
    const unknown = {
      classId: 'b',
      termId: TERM,
      tierDistribution: visibleDistribution(30),
      interventionRate: null,
      fidelityRate: null,
    };
    expect(rollupGrade('g', TERM, [known, unknown]).interventionRate).toBeCloseTo(0.5);
  });

  it('reports no rate when no class has one', () => {
    const unknown = {
      classId: 'b',
      termId: TERM,
      tierDistribution: visibleDistribution(10),
      interventionRate: null,
      fidelityRate: null,
    };
    expect(rollupGrade('g', TERM, [unknown]).interventionRate).toBeNull();
  });
});

describe('rollupSchool - grades with no known intervention rate', () => {
  const grade = (id: string, total: number, rate: number | null) => ({
    gradeId: id,
    termId: TERM,
    tierDistribution: visibleDistribution(total),
    classCount: 1,
    interventionRate: rate,
  });

  it('weights only the grades that report a rate', () => {
    expect(
      rollupSchool('s', TERM, [grade('1', 10, 0.2), grade('2', 90, null)])
        .interventionRate,
    ).toBeCloseTo(0.2);
  });

  it('reports no rate when no grade has one', () => {
    expect(rollupSchool('s', TERM, [grade('1', 10, null)]).interventionRate).toBeNull();
  });
});

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
