// CE-03 Term Planner and CE-04 Unit Architect contract type tests — Stage 08 step 3.
//
// These tests prove the type-level constraints that enforce the "never invent curriculum
// policy" rule. If a schema accepts uncited data, the invariant is already broken.

import { describe, expect, it } from 'vitest';

import {
  CE03Input,
  CE04Input,
  CognitiveLevel,
  SuccessCriterion,
  TermPlanResult,
  UnitBlueprintResult,
} from '../src/curriculum/planning.js';

const source = {
  documentId: 'caps-senior-mathematics-gr7-9',
  documentVersion: '2011-09-12',
  clause: '§3.1',
  page: 14,
  ratifiedBy: null,
};

describe('CE03Input', () => {
  const validInput = {
    grade: '7',
    subjects: ['Mathematics', 'Life Sciences'],
    termNumber: 1,
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts a complete, valid CE-03 input', () => {
    expect(CE03Input.safeParse(validInput).success).toBe(true);
  });

  it('rejects an empty subjects array — a term plan for no subjects is not a plan', () => {
    expect(CE03Input.safeParse({ ...validInput, subjects: [] }).success).toBe(false);
  });

  it('rejects a term number outside 1-4', () => {
    expect(CE03Input.safeParse({ ...validInput, termNumber: 5 }).success).toBe(false);
    expect(CE03Input.safeParse({ ...validInput, termNumber: 0 }).success).toBe(false);
  });

  it('rejects an academic year before 2000', () => {
    expect(CE03Input.safeParse({ ...validInput, academicYear: 1999 }).success).toBe(
      false,
    );
  });

  it('rejects a malformed tenant UUID', () => {
    expect(CE03Input.safeParse({ ...validInput, tenantId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects Grade 13 — only R through 12 are valid', () => {
    expect(CE03Input.safeParse({ ...validInput, grade: '13' }).success).toBe(false);
  });
});

describe('CE04Input', () => {
  const validInput = {
    grade: '9',
    subject: 'Mathematics',
    termNumber: 2,
    contentArea: 'Algebra',
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts a complete, valid CE-04 input', () => {
    expect(CE04Input.safeParse(validInput).success).toBe(true);
  });

  it('rejects an empty content area — the agent needs a specific area to architect', () => {
    expect(CE04Input.safeParse({ ...validInput, contentArea: '' }).success).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(CE04Input.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });

  it('rejects academic year above 2100', () => {
    expect(CE04Input.safeParse({ ...validInput, academicYear: 2101 }).success).toBe(
      false,
    );
  });

  it('rejects a missing tenant', () => {
    const { tenantId: _omitted, ...withoutTenant } = validInput;
    expect(CE04Input.safeParse(withoutTenant).success).toBe(false);
  });
});

describe('CognitiveLevel', () => {
  it('accepts all six Bloom taxonomy levels', () => {
    for (const level of [
      'knowledge',
      'comprehension',
      'application',
      'analysis',
      'synthesis',
      'evaluation',
    ]) {
      expect(CognitiveLevel.safeParse(level).success).toBe(true);
    }
  });

  it('rejects a level outside the taxonomy — "memorisation" is not a Bloom level', () => {
    expect(CognitiveLevel.safeParse('memorisation').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(CognitiveLevel.safeParse('').success).toBe(false);
  });
});

describe('SuccessCriterion', () => {
  const validCriterion = {
    criterion: 'Learner can solve linear equations with one variable.',
    cognitiveLevel: 'application',
    source,
  };

  it('accepts a well-formed success criterion with a source', () => {
    expect(SuccessCriterion.safeParse(validCriterion).success).toBe(true);
  });

  it('rejects a criterion with an empty description', () => {
    expect(SuccessCriterion.safeParse({ ...validCriterion, criterion: '' }).success).toBe(
      false,
    );
  });

  it('rejects a criterion with an invalid cognitive level', () => {
    expect(
      SuccessCriterion.safeParse({ ...validCriterion, cognitiveLevel: 'recall' }).success,
    ).toBe(false);
  });

  it('rejects a criterion without a source — uncited criteria cannot be verified', () => {
    const { source: _omitted, ...withoutSource } = validCriterion;
    expect(SuccessCriterion.safeParse(withoutSource).success).toBe(false);
  });
});

describe('TermPlanResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming at least one missing document', () => {
    const result = TermPlanResult.safeParse({
      status: 'needs_input',
      grade: '7',
      termNumber: 1,
      missing: [
        {
          documentKind: 'ATP_SCHEDULE',
          subjectName: 'Mathematics',
          why: 'No ATP schedule has been ratified for Grade 7 Mathematics.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      TermPlanResult.safeParse({
        status: 'needs_input',
        grade: '7',
        termNumber: 1,
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status — there is no partial success state', () => {
    expect(TermPlanResult.safeParse({ status: 'partial', grade: '7' }).success).toBe(
      false,
    );
  });

  it('rejects a needs_input with an unrecognised documentKind', () => {
    expect(
      TermPlanResult.safeParse({
        status: 'needs_input',
        grade: '7',
        termNumber: 1,
        missing: [{ documentKind: 'UNKNOWN_KIND', subjectName: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });
});

describe('UnitBlueprintResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming at least one missing document', () => {
    const result = UnitBlueprintResult.safeParse({
      status: 'needs_input',
      grade: '9',
      subject: 'Mathematics',
      contentArea: 'Algebra',
      missing: [
        {
          documentKind: 'TERM_PLAN',
          subjectName: 'Mathematics',
          why: 'No ratified term plan exists for Grade 9 Mathematics Term 2.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      UnitBlueprintResult.safeParse({
        status: 'needs_input',
        grade: '9',
        subject: 'Mathematics',
        contentArea: 'Algebra',
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(UnitBlueprintResult.safeParse({ status: 'error', grade: '9' }).success).toBe(
      false,
    );
  });

  it('rejects a needs_input with an unrecognised documentKind', () => {
    expect(
      UnitBlueprintResult.safeParse({
        status: 'needs_input',
        grade: '9',
        subject: 'Mathematics',
        contentArea: 'Algebra',
        missing: [{ documentKind: 'ATP_SCHEDULE', subjectName: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });
});
