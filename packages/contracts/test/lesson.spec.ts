// CE-05 Lesson Plan Generator and CE-08 Differentiation Agent contract type tests — Stage 08 step 3.
//
// These tests lock down the structural rules that prevent lesson content from being
// generated without the ratified source documents it depends on.

import { describe, expect, it } from 'vitest';

import {
  ActivityKind,
  CE05Input,
  CE08Input,
  DifferentiationResult,
  LessonPlanResult,
} from '../src/curriculum/lesson.js';

describe('CE05Input', () => {
  const validInput = {
    grade: '5',
    subject: 'English Home Language',
    weekNumber: 3,
    termNumber: 1,
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
    templateId: 'lesson-template-v1',
  };

  it('accepts a complete, valid CE-05 input', () => {
    expect(CE05Input.safeParse(validInput).success).toBe(true);
  });

  it('rejects a week number of zero — week numbering starts at 1', () => {
    expect(CE05Input.safeParse({ ...validInput, weekNumber: 0 }).success).toBe(false);
  });

  it('rejects an empty templateId — CE-05 cannot generate without a template', () => {
    expect(CE05Input.safeParse({ ...validInput, templateId: '' }).success).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(CE05Input.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });

  it('rejects a term number above 4', () => {
    expect(CE05Input.safeParse({ ...validInput, termNumber: 5 }).success).toBe(false);
  });

  it('rejects a malformed UUID', () => {
    expect(CE05Input.safeParse({ ...validInput, tenantId: 'bad-uuid' }).success).toBe(
      false,
    );
  });
});

describe('CE08Input', () => {
  const validInput = {
    grade: '7',
    subject: 'Mathematics',
    weekNumber: 4,
    termNumber: 1,
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
    tiers: ['support', 'on-level', 'extension'],
  };

  it('accepts a complete, valid CE-08 input with all three tiers', () => {
    expect(CE08Input.safeParse(validInput).success).toBe(true);
  });

  it('accepts a single tier — extension-only differentiation is a valid request', () => {
    expect(CE08Input.safeParse({ ...validInput, tiers: ['extension'] }).success).toBe(
      true,
    );
  });

  it('rejects an empty tiers array', () => {
    expect(CE08Input.safeParse({ ...validInput, tiers: [] }).success).toBe(false);
  });

  it('rejects an unrecognised tier name', () => {
    expect(CE08Input.safeParse({ ...validInput, tiers: ['gifted'] }).success).toBe(false);
  });

  it('rejects a week number of zero', () => {
    expect(CE08Input.safeParse({ ...validInput, weekNumber: 0 }).success).toBe(false);
  });

  it('rejects a missing tenant', () => {
    const { tenantId: _omitted, ...withoutTenant } = validInput;
    expect(CE08Input.safeParse(withoutTenant).success).toBe(false);
  });
});

describe('ActivityKind', () => {
  it('accepts the three lesson activity kinds', () => {
    for (const kind of ['introduction', 'development', 'consolidation']) {
      expect(ActivityKind.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects an unrecognised kind', () => {
    expect(ActivityKind.safeParse('warm-up').success).toBe(false);
  });
});

describe('LessonPlanResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming a missing unit blueprint', () => {
    const result = LessonPlanResult.safeParse({
      status: 'needs_input',
      grade: '5',
      subject: 'English Home Language',
      weekNumber: 3,
      missing: [
        {
          documentKind: 'UNIT_BLUEPRINT',
          detail: 'Week 3 Term 1',
          why: 'No ratified unit blueprint exists for this week.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts null for the detail field', () => {
    const result = LessonPlanResult.safeParse({
      status: 'needs_input',
      grade: '5',
      subject: 'English Home Language',
      weekNumber: 3,
      missing: [
        {
          documentKind: 'TEMPLATE_DEFINITION',
          detail: null,
          why: 'No lesson template has been defined for this school.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      LessonPlanResult.safeParse({
        status: 'needs_input',
        grade: '5',
        subject: 'English Home Language',
        weekNumber: 3,
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(LessonPlanResult.safeParse({ status: 'draft', grade: '5' }).success).toBe(
      false,
    );
  });
});

describe('DifferentiationResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming a missing lesson plan', () => {
    const result = DifferentiationResult.safeParse({
      status: 'needs_input',
      grade: '7',
      subject: 'Mathematics',
      weekNumber: 4,
      missing: [
        {
          documentKind: 'LESSON_PLAN',
          detail: 'Week 4 Term 1',
          why: 'No ratified lesson plan exists for this week — CE-08 cannot differentiate without it.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an unrecognised documentKind', () => {
    expect(
      DifferentiationResult.safeParse({
        status: 'needs_input',
        grade: '7',
        subject: 'Mathematics',
        weekNumber: 4,
        missing: [{ documentKind: 'UNIT_BLUEPRINT', detail: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      DifferentiationResult.safeParse({
        status: 'needs_input',
        grade: '7',
        subject: 'Mathematics',
        weekNumber: 4,
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(
      DifferentiationResult.safeParse({ status: 'pending', grade: '7' }).success,
    ).toBe(false);
  });
});
