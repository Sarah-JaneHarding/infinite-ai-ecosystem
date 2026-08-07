// CE-06 Assessment Designer and CE-07 Rubric Builder contract type tests — Stage 08 step 3.
//
// The key invariant here: mark allocations and cognitive spreads come from policy, not from
// the agent. The CognitiveLevelSpread sum-to-100 constraint is what enforces that — an
// arbitrary spread would mean the agent made up the weighting.

import { describe, expect, it } from 'vitest';

import {
  AssessmentTaskDesignResult,
  AssessmentTaskKind,
  CE06Input,
  CE07Input,
  CognitiveLevelSpread,
  RubricResult,
} from '../src/curriculum/assessment.js';

describe('CE06Input', () => {
  const validInput = {
    grade: '10',
    subject: 'Mathematics',
    termNumber: 2,
    taskKind: 'test',
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts a complete, valid CE-06 input', () => {
    expect(CE06Input.safeParse(validInput).success).toBe(true);
  });

  it('accepts all six task kinds', () => {
    for (const kind of [
      'test',
      'assignment',
      'project',
      'oral',
      'practical',
      'examination',
    ]) {
      expect(CE06Input.safeParse({ ...validInput, taskKind: kind }).success).toBe(true);
    }
  });

  it('rejects an unrecognised task kind', () => {
    expect(CE06Input.safeParse({ ...validInput, taskKind: 'quiz' }).success).toBe(false);
  });

  it('rejects a term number above 4', () => {
    expect(CE06Input.safeParse({ ...validInput, termNumber: 5 }).success).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(CE06Input.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(CE06Input.safeParse({ ...validInput, tenantId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });
});

describe('CE07Input', () => {
  const validInput = {
    grade: '10',
    subject: 'Mathematics',
    taskKind: 'test' as const,
    tenantId: '00000000-0000-0000-0000-000000000001',
    totalMarks: 50,
  };

  it('accepts a complete, valid CE-07 input', () => {
    expect(CE07Input.safeParse(validInput).success).toBe(true);
  });

  it('rejects zero total marks — a rubric for zero marks is not a rubric', () => {
    expect(CE07Input.safeParse({ ...validInput, totalMarks: 0 }).success).toBe(false);
  });

  it('rejects negative total marks', () => {
    expect(CE07Input.safeParse({ ...validInput, totalMarks: -10 }).success).toBe(false);
  });

  it('rejects a non-integer total marks value', () => {
    expect(CE07Input.safeParse({ ...validInput, totalMarks: 49.5 }).success).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(CE07Input.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });
});

describe('AssessmentTaskKind', () => {
  it('accepts all six recognised task kinds', () => {
    for (const kind of [
      'test',
      'assignment',
      'project',
      'oral',
      'practical',
      'examination',
    ]) {
      expect(AssessmentTaskKind.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects kinds not in CAPS policy', () => {
    expect(AssessmentTaskKind.safeParse('quiz').success).toBe(false);
    expect(AssessmentTaskKind.safeParse('homework').success).toBe(false);
  });
});

describe('CognitiveLevelSpread — must sum to 100', () => {
  const spreadOf = (
    k: number,
    c: number,
    ap: number,
    an: number,
    s: number,
    e: number,
  ) => ({
    knowledge: k,
    comprehension: c,
    application: ap,
    analysis: an,
    synthesis: s,
    evaluation: e,
  });

  it('accepts a spread that sums to exactly 100', () => {
    expect(CognitiveLevelSpread.safeParse(spreadOf(20, 20, 20, 20, 10, 10)).success).toBe(
      true,
    );
  });

  it('accepts a spread with floating-point components summing to 100', () => {
    expect(
      CognitiveLevelSpread.safeParse(spreadOf(33.34, 33.33, 33.33, 0, 0, 0)).success,
    ).toBe(true);
  });

  it('rejects a spread that sums to 99', () => {
    // A 1% gap is not floating-point noise — it means a level was dropped.
    expect(CognitiveLevelSpread.safeParse(spreadOf(20, 20, 20, 19, 10, 10)).success).toBe(
      false,
    );
  });

  it('rejects a spread that sums to 101', () => {
    expect(CognitiveLevelSpread.safeParse(spreadOf(20, 20, 21, 20, 10, 10)).success).toBe(
      false,
    );
  });

  it('rejects a spread with a negative component', () => {
    expect(
      CognitiveLevelSpread.safeParse(spreadOf(30, 30, 30, 30, -10, -10)).success,
    ).toBe(false);
  });

  it('rejects a spread with a component above 100', () => {
    expect(CognitiveLevelSpread.safeParse(spreadOf(110, 0, 0, 0, 0, 0)).success).toBe(
      false,
    );
  });
});

describe('AssessmentTaskDesignResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming a missing assessment policy', () => {
    const result = AssessmentTaskDesignResult.safeParse({
      status: 'needs_input',
      grade: '10',
      subject: 'Mathematics',
      missing: [
        {
          documentKind: 'ASSESSMENT_POLICY',
          detail: null,
          why: 'No assessment policy has been ratified — mark allocations cannot be determined.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      AssessmentTaskDesignResult.safeParse({
        status: 'needs_input',
        grade: '10',
        subject: 'Mathematics',
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(
      AssessmentTaskDesignResult.safeParse({ status: 'incomplete', grade: '10' }).success,
    ).toBe(false);
  });

  it('rejects a needs_input with an unrecognised documentKind', () => {
    expect(
      AssessmentTaskDesignResult.safeParse({
        status: 'needs_input',
        grade: '10',
        subject: 'Mathematics',
        missing: [{ documentKind: 'LESSON_PLAN', detail: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });
});

describe('RubricResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming a missing assessment task design', () => {
    const result = RubricResult.safeParse({
      status: 'needs_input',
      grade: '10',
      subject: 'Mathematics',
      missing: [
        {
          documentKind: 'ASSESSMENT_TASK_DESIGN',
          detail: null,
          why: 'No ratified assessment task design exists — CE-07 cannot build a rubric without the question structure.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      RubricResult.safeParse({
        status: 'needs_input',
        grade: '10',
        subject: 'Mathematics',
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(RubricResult.safeParse({ status: 'waiting', grade: '10' }).success).toBe(
      false,
    );
  });

  it('rejects a needs_input with a documentKind outside the rubric dependency set', () => {
    // CE-07 depends on GRADE_FRAMEWORK, ASSESSMENT_TASK_DESIGN, ASSESSMENT_POLICY,
    // CAPS_SUBJECT_STATEMENT — not on LESSON_PLAN or UNIT_BLUEPRINT.
    expect(
      RubricResult.safeParse({
        status: 'needs_input',
        grade: '10',
        subject: 'Mathematics',
        missing: [{ documentKind: 'LESSON_PLAN', detail: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });
});
