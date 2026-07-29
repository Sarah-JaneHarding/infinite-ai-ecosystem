// The curriculum framework contract.
//
// These tests exist to prove one thing: an uncited policy value cannot be constructed.
// That is the manual's "never invent weightings" rule expressed as a type rather than a
// convention, and a convention nobody checks is a rule that has already been broken.

import { describe, expect, it } from 'vitest';

import {
  AssessmentWeighting,
  FrameworkResult,
  GradeFramework,
  SourceRef,
  TimeAllocation,
} from '../src/curriculum/framework.js';

const source = {
  documentId: 'caps-ip-mathematics-gr4-6',
  documentVersion: '2011-09-12',
  clause: '§2.3, Table 2.1',
  page: 8,
  ratifiedBy: null,
};

describe('SourceRef', () => {
  it('accepts a complete citation', () => {
    expect(SourceRef.safeParse(source).success).toBe(true);
  });

  it('rejects an empty clause — "the document" is not a citation', () => {
    expect(SourceRef.safeParse({ ...source, clause: '' }).success).toBe(false);
  });

  it('rejects a missing document version', () => {
    // Without a version, a value cannot be traced to the edition it came from, and a
    // curriculum revision would silently invalidate it.
    const { documentVersion: _omitted, ...withoutVersion } = source;
    expect(SourceRef.safeParse(withoutVersion).success).toBe(false);
  });

  it('allows ratifiedBy to be null but not absent', () => {
    expect(SourceRef.safeParse({ ...source, ratifiedBy: null }).success).toBe(true);
    const { ratifiedBy: _omitted, ...withoutRatifier } = source;
    expect(SourceRef.safeParse(withoutRatifier).success).toBe(false);
  });
});

describe('TimeAllocation cannot be uncited', () => {
  it('accepts an allocation with a source', () => {
    const result = TimeAllocation.safeParse({
      hoursPerWeek: { value: 6, source },
      conditions: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a bare number — this is the rule the whole file exists for', () => {
    expect(TimeAllocation.safeParse({ hoursPerWeek: 6, conditions: [] }).success).toBe(
      false,
    );
  });

  it('rejects a value whose source is missing', () => {
    expect(
      TimeAllocation.safeParse({ hoursPerWeek: { value: 6 }, conditions: [] }).success,
    ).toBe(false);
  });

  it('rejects a non-positive allocation', () => {
    expect(
      TimeAllocation.safeParse({ hoursPerWeek: { value: 0, source }, conditions: [] })
        .success,
    ).toBe(false);
  });
});

describe('AssessmentWeighting', () => {
  const components = (...percentages: number[]) =>
    percentages.map((p, i) => ({
      name: `Component ${i + 1}`,
      percentage: { value: p, source },
    }));

  it('accepts components summing to 100', () => {
    expect(
      AssessmentWeighting.safeParse({ components: components(75, 25) }).success,
    ).toBe(true);
  });

  it('rejects components that do not sum to 100', () => {
    // A weighting table that does not total 100 is a transcription error. Catching it at
    // ingestion costs nothing; discovering it on a report card costs a great deal.
    expect(
      AssessmentWeighting.safeParse({ components: components(75, 20) }).success,
    ).toBe(false);
  });

  it('rejects an over-100 total', () => {
    expect(
      AssessmentWeighting.safeParse({ components: components(60, 60) }).success,
    ).toBe(false);
  });

  it('tolerates floating-point imprecision but not real error', () => {
    expect(
      AssessmentWeighting.safeParse({ components: components(33.33, 33.33, 33.34) })
        .success,
    ).toBe(true);
    expect(
      AssessmentWeighting.safeParse({ components: components(33, 33, 33) }).success,
    ).toBe(false);
  });

  it('requires at least one component', () => {
    expect(AssessmentWeighting.safeParse({ components: [] }).success).toBe(false);
  });
});

describe('GradeFramework', () => {
  const subject = (name: string, hours: number) => ({
    subjectName: name,
    capsCode: null,
    time: { hoursPerWeek: { value: hours, source }, conditions: [] },
    assessment: {
      components: [
        { name: 'School-Based Assessment', percentage: { value: 100, source } },
      ],
    },
    contentAreas: [],
  });

  it('accepts a framework whose subject hours match the stated total', () => {
    const result = GradeFramework.safeParse({
      grade: '6',
      phase: 'INTERMEDIATE',
      totalInstructionalHours: { value: 10, source },
      subjects: [subject('Mathematics', 6), subject('Life Skills', 4)],
      ratifiedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('flags a mismatch rather than reconciling it', () => {
    // Deliberately a hard failure. A discrepancy between the stated phase total and the
    // sum of its subjects is for a Head of Department to adjudicate — code that averaged
    // it away would be hiding the one signal that something was mis-transcribed.
    const result = GradeFramework.safeParse({
      grade: '6',
      phase: 'INTERMEDIATE',
      totalInstructionalHours: { value: 12, source },
      subjects: [subject('Mathematics', 6), subject('Life Skills', 4)],
      ratifiedAt: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain(
        'must be confirmed against the source',
      );
    }
  });

  it('requires at least one subject', () => {
    expect(
      GradeFramework.safeParse({
        grade: 'R',
        phase: 'FOUNDATION',
        totalInstructionalHours: { value: 10, source },
        subjects: [],
        ratifiedAt: null,
      }).success,
    ).toBe(false);
  });

  it('accepts Grade R and rejects a grade outside R-12', () => {
    const base = {
      phase: 'FOUNDATION',
      totalInstructionalHours: { value: 6, source },
      subjects: [subject('Home Language', 6)],
      ratifiedAt: null,
    };
    expect(GradeFramework.safeParse({ ...base, grade: 'R' }).success).toBe(true);
    expect(GradeFramework.safeParse({ ...base, grade: '13' }).success).toBe(false);
  });
});

describe('needs_input is a first-class result', () => {
  it('accepts a needs_input result naming what is missing', () => {
    const result = FrameworkResult.safeParse({
      status: 'needs_input',
      grade: '6',
      missing: [
        {
          documentKind: 'CAPS_SUBJECT_STATEMENT',
          subjectName: 'Mathematics',
          why: 'No CAPS subject statement has been ingested for Intermediate Phase Mathematics.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result that does not say what is missing', () => {
    // "I could not do it" without naming the gap is not actionable, and an agent that
    // returns it has produced a dead end rather than a request.
    expect(
      FrameworkResult.safeParse({ status: 'needs_input', grade: '6', missing: [] })
        .success,
    ).toBe(false);
  });

  it('has no third state — an agent either produces a framework or names the gap', () => {
    expect(FrameworkResult.safeParse({ status: 'partial', grade: '6' }).success).toBe(
      false,
    );
  });
});
