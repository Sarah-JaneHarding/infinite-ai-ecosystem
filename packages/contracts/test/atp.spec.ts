// CE-01/CE-02 input schemas and ATP schedule types — Stage 08 step 2.
//
// Proves the schema's own structural rules for CE01Input, CE02Input, ATPSchedule, and
// ATPResult, the same way template.spec.ts proves TemplateDefinition apart from the
// template-fidelity checker. Four violation kinds for ATPNeedsInput, calendar block
// validation, and the discriminated union shape.

import { describe, expect, it } from 'vitest';

import type { SourceRef } from '../src/curriculum/framework.js';
import {
  ATPNeedsInput,
  ATPResult,
  ATPSchedule,
  CE01Input,
  CE02Input,
  SchoolCalendarBlock,
  WeekKind,
} from '../src/curriculum/atp.js';

const source: SourceRef = {
  documentId: 'caps-ip-mathematics-gr4-6',
  documentVersion: '2011',
  clause: '§2.3, Table 2.1',
  ratifiedBy: null,
};

// ---------------------------------------------------------------------------
// CE01Input
// ---------------------------------------------------------------------------

describe('CE01Input', () => {
  it('accepts a valid input with one subject', () => {
    const result = CE01Input.safeParse({
      grade: '6',
      subjects: ['Mathematics'],
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid input with multiple subjects', () => {
    const result = CE01Input.safeParse({
      grade: 'R',
      subjects: ['Life Skills', 'Mathematics', 'English Home Language'],
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty subjects array', () => {
    const result = CE01Input.safeParse({
      grade: '4',
      subjects: [],
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a subject with an empty string', () => {
    const result = CE01Input.safeParse({
      grade: '4',
      subjects: [''],
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid grade', () => {
    const result = CE01Input.safeParse({
      grade: '13',
      subjects: ['Mathematics'],
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID tenantId', () => {
    const result = CE01Input.safeParse({
      grade: '4',
      subjects: ['Mathematics'],
      tenantId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CE02Input
// ---------------------------------------------------------------------------

describe('CE02Input', () => {
  it('accepts a valid input without a school calendar', () => {
    const result = CE02Input.safeParse({
      grade: '7',
      subjects: ['Mathematics'],
      academicYear: 2026,
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid input with a school calendar', () => {
    const result = CE02Input.safeParse({
      grade: '7',
      subjects: ['Mathematics'],
      academicYear: 2026,
      tenantId: '00000000-0000-0000-0000-000000000001',
      schoolCalendar: [
        {
          kind: 'holiday',
          startDate: '2026-03-23',
          endDate: '2026-04-04',
          label: 'Term 1 break',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an academicYear before 2000', () => {
    const result = CE02Input.safeParse({
      grade: '7',
      subjects: ['Mathematics'],
      academicYear: 1999,
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an academicYear after 2100', () => {
    const result = CE02Input.safeParse({
      grade: '7',
      subjects: ['Mathematics'],
      academicYear: 2101,
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty subjects array', () => {
    const result = CE02Input.safeParse({
      grade: '7',
      subjects: [],
      academicYear: 2026,
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SchoolCalendarBlock
// ---------------------------------------------------------------------------

describe('SchoolCalendarBlock', () => {
  it('accepts a valid block with all fields', () => {
    const result = SchoolCalendarBlock.safeParse({
      kind: 'holiday',
      startDate: '2026-03-23',
      endDate: '2026-04-04',
      label: 'Term 1 break',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a block without a label', () => {
    const result = SchoolCalendarBlock.safeParse({
      kind: 'exam',
      startDate: '2026-06-09',
      endDate: '2026-06-20',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a startDate not in YYYY-MM-DD format', () => {
    const result = SchoolCalendarBlock.safeParse({
      kind: 'holiday',
      startDate: '23 March 2026',
      endDate: '2026-04-04',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown WeekKind', () => {
    const result = SchoolCalendarBlock.safeParse({
      kind: 'sport_day',
      startDate: '2026-03-23',
      endDate: '2026-03-23',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WeekKind
// ---------------------------------------------------------------------------

describe('WeekKind', () => {
  it('accepts all five valid kinds', () => {
    for (const kind of [
      'teaching',
      'holiday',
      'exam',
      'revision',
      'assessment',
    ] as const) {
      expect(WeekKind.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects unknown kinds', () => {
    expect(WeekKind.safeParse('free_period').success).toBe(false);
    expect(WeekKind.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ATPNeedsInput
// ---------------------------------------------------------------------------

describe('ATPNeedsInput', () => {
  it('accepts a valid needs_input with one missing item', () => {
    const result = ATPNeedsInput.safeParse({
      status: 'needs_input',
      grade: '7',
      missing: [
        { documentKind: 'ATP', subjectName: 'Mathematics', why: 'No ATP document in L0' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null subjectName', () => {
    const result = ATPNeedsInput.safeParse({
      status: 'needs_input',
      grade: '4',
      missing: [
        {
          documentKind: 'SCHOOL_CALENDAR',
          subjectName: null,
          why: 'No school calendar supplied',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty missing array', () => {
    const result = ATPNeedsInput.safeParse({
      status: 'needs_input',
      grade: '4',
      missing: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown documentKind', () => {
    const result = ATPNeedsInput.safeParse({
      status: 'needs_input',
      grade: '4',
      missing: [{ documentKind: 'TEACHER_GUIDE', subjectName: null, why: 'missing' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing why string', () => {
    const result = ATPNeedsInput.safeParse({
      status: 'needs_input',
      grade: '4',
      missing: [{ documentKind: 'ATP', subjectName: 'Mathematics', why: '' }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ATPSchedule
// ---------------------------------------------------------------------------

describe('ATPSchedule', () => {
  const validSchedule = {
    grade: '7',
    academicYear: 2026,
    sourceDocuments: [source],
    weeks: [
      {
        weekNumber: 1,
        termNumber: 1,
        kind: 'teaching',
        entries: [
          {
            subjectName: 'Mathematics',
            contentArea: 'Numbers, Operations and Relationships',
            topics: ['Whole numbers'],
            source,
          },
        ],
        deviationReason: null,
      },
    ],
    ratifiedAt: null,
  };

  it('accepts a valid schedule', () => {
    expect(ATPSchedule.safeParse(validSchedule).success).toBe(true);
  });

  it('rejects an empty weeks array', () => {
    expect(ATPSchedule.safeParse({ ...validSchedule, weeks: [] }).success).toBe(false);
  });

  it('rejects an empty sourceDocuments array', () => {
    expect(ATPSchedule.safeParse({ ...validSchedule, sourceDocuments: [] }).success).toBe(
      false,
    );
  });

  it('rejects a termNumber outside 1–4', () => {
    const week = { ...validSchedule.weeks[0], termNumber: 5 };
    expect(ATPSchedule.safeParse({ ...validSchedule, weeks: [week] }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// ATPResult discriminated union
// ---------------------------------------------------------------------------

describe('ATPResult', () => {
  it('accepts an ok result', () => {
    const result = ATPResult.safeParse({
      status: 'ok',
      schedule: {
        grade: '4',
        academicYear: 2026,
        sourceDocuments: [source],
        weeks: [
          {
            weekNumber: 1,
            termNumber: 1,
            kind: 'holiday',
            entries: [],
            deviationReason: null,
          },
        ],
        ratifiedAt: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a needs_input result', () => {
    const result = ATPResult.safeParse({
      status: 'needs_input',
      grade: '4',
      missing: [{ documentKind: 'ATP', subjectName: 'Mathematics', why: 'No ATP in L0' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown status', () => {
    const result = ATPResult.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });
});
