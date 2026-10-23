import { AGE_APPROPRIATENESS_ENTRIES } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import {
  createGatewayAgeAppropriatenessJudge,
  isNoVerdict,
} from '../src/age-appropriateness-judge.js';
import {
  runCalibration,
  selectCases,
  summariseCalibration,
  type CalibrationResult,
} from '../src/age-appropriateness-calibration.js';
import type { LabelledCase } from '../src/age-appropriateness-labelled-set.js';

const reviewed = {
  status: 'confirmed',
  reviewer: 'A. Teacher',
  reviewedOn: '2026-10-02',
  note: null,
} as const;
const unreviewed = {
  status: 'unreviewed',
  reviewer: null,
  reviewedOn: null,
  note: null,
} as const;

function labelled(id: string, over: Partial<LabelledCase> = {}): LabelledCase {
  return {
    id,
    kind: 'violation',
    phase: 'INTERMEDIATE',
    grade: '5',
    subject: 'Mathematics',
    clauseSet: 'phase',
    output: `output of ${id}`,
    expectedAppropriate: false,
    drivingClauses: ['age-appropriateness-094'],
    construction: 'x',
    labelledBy: 'constructed',
    review: reviewed,
    ...over,
  };
}

function result(over: Partial<CalibrationResult>): CalibrationResult {
  return {
    caseId: 'c',
    kind: 'violation',
    phase: 'INTERMEDIATE',
    reviewStatus: 'confirmed',
    expectedAppropriate: false,
    actualAppropriate: false,
    rationale: 'r',
    ...over,
  };
}

describe('selectCases', () => {
  const cases = [
    labelled('a'),
    labelled('b', { review: unreviewed }),
    labelled('c', { review: { ...reviewed, status: 'disputed' } }),
    labelled('d', { review: { ...reviewed, status: 'relabelled' } }),
  ];

  it('scores confirmed and relabelled cases only by default', () => {
    const { selected, excluded } = selectCases(cases);
    expect(selected.map((c) => c.id)).toEqual(['a', 'd']);
    expect(excluded).toEqual([
      { id: 'b', reason: 'unreviewed' },
      { id: 'c', reason: 'disputed' },
    ]);
  });

  it('can include unreviewed cases, but never disputed ones', () => {
    const { selected, excluded } = selectCases(cases, { includeUnreviewed: true });
    expect(selected.map((c) => c.id)).toEqual(['a', 'b', 'd']);
    expect(excluded).toEqual([{ id: 'c', reason: 'disputed' }]);
  });
});

describe('runCalibration', () => {
  it('hands the judge every clause of the case phase, or none for an empty clause set', async () => {
    const seen: { count: number; phases: string[]; output: unknown }[] = [];
    const judge = (clauses: readonly { phase: string }[], output: unknown) => {
      seen.push({
        count: clauses.length,
        phases: [...new Set(clauses.map((c) => c.phase))],
        output,
      });
      return Promise.resolve({ appropriate: true, rationale: 'ok' });
    };
    await runCalibration(
      [
        labelled('a'),
        labelled('b', { kind: 'control', clauseSet: 'empty', drivingClauses: [] }),
      ],
      AGE_APPROPRIATENESS_ENTRIES,
      judge,
    );
    const intermediate = AGE_APPROPRIATENESS_ENTRIES.filter(
      (e) => e.phase === 'INTERMEDIATE',
    );
    expect(seen[0]).toEqual({
      count: intermediate.length,
      phases: ['INTERMEDIATE'],
      output: 'output of a',
    });
    expect(seen[1]?.count).toBe(0);
  });

  it('records a failed judge as no verdict, not as a rejection', async () => {
    const down = createGatewayAgeAppropriatenessJudge(
      () => Promise.reject(new Error('connection refused')),
      '10000000-0000-4000-8000-000000000001',
      'prompt',
      { deidentified: true, saltVersion: 0, dropped: [] },
    );
    const [r] = await runCalibration([labelled('a')], AGE_APPROPRIATENESS_ENTRIES, down);
    expect(r?.actualAppropriate).toBeNull();
    expect(r?.rationale).toContain('connection refused');
  });

  it('records a genuine rejection as a verdict', async () => {
    const [r] = await runCalibration([labelled('a')], AGE_APPROPRIATENESS_ENTRIES, () =>
      Promise.resolve({ appropriate: false, rationale: 'clause 094 forbids this' }),
    );
    expect(r?.actualAppropriate).toBe(false);
  });
});

describe('isNoVerdict', () => {
  it('is false for an ordinary rationale, even one that mentions failing', () => {
    expect(isNoVerdict({ rationale: 'This fails clause 094.' })).toBe(false);
  });
});

describe('summariseCalibration', () => {
  it('builds the confusion table and agreement from verdicts only', () => {
    const s = summariseCalibration([
      result({ caseId: '1', expectedAppropriate: false, actualAppropriate: false }),
      result({ caseId: '2', expectedAppropriate: false, actualAppropriate: true }),
      result({
        caseId: '3',
        kind: 'conformant',
        expectedAppropriate: true,
        actualAppropriate: true,
      }),
      result({
        caseId: '4',
        kind: 'conformant',
        expectedAppropriate: true,
        actualAppropriate: false,
      }),
      result({
        caseId: '5',
        kind: 'conformant',
        expectedAppropriate: true,
        actualAppropriate: true,
        phase: 'SENIOR',
      }),
    ]);
    expect(s.confusion).toEqual({
      expectedFalseJudgedFalse: 1,
      expectedFalseJudgedTrue: 1,
      expectedTrueJudgedFalse: 1,
      expectedTrueJudgedTrue: 2,
    });
    expect(s.overall).toEqual({ cases: 5, agreed: 3, rate: 0.6 });
    expect(s.byKind.conformant).toEqual({ cases: 3, agreed: 2, rate: 2 / 3 });
    expect(s.byPhase.SENIOR).toEqual({ cases: 1, agreed: 1, rate: 1 });
    expect(s.disagreements.map((d) => d.caseId)).toEqual(['2', '4']);
  });

  it('keeps no-verdict out of the confusion table and counts it as a miss in the stricter rate', () => {
    const s = summariseCalibration([
      result({ caseId: '1', actualAppropriate: false }),
      result({ caseId: '2', actualAppropriate: null }),
    ]);
    expect(s.noVerdict).toBe(1);
    expect(s.noVerdictCases.map((d) => d.caseId)).toEqual(['2']);
    expect(s.overall).toEqual({ cases: 1, agreed: 1, rate: 1 });
    expect(s.overallCountingNoVerdict).toEqual({ cases: 2, agreed: 1, rate: 0.5 });
    expect(s.disagreements).toEqual([]);
  });

  it('is not calibration evidence unless every scored case was human-reviewed', () => {
    expect(summariseCalibration([result({})]).humanReviewedOnly).toBe(true);
    expect(
      summariseCalibration([result({}), result({ reviewStatus: 'unreviewed' })])
        .humanReviewedOnly,
    ).toBe(false);
  });

  it('reports nothing as nothing: no rate, and not human-reviewed', () => {
    const s = summariseCalibration([]);
    expect(s.overall.rate).toBeNull();
    expect(s.overallCountingNoVerdict.rate).toBeNull();
    expect(s.humanReviewedOnly).toBe(false);
  });
});
