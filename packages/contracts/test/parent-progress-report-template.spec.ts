// Benjamin Pine Parent Progress Report template ingestion tests — Stage 08 / MOD-01.
//
// Two concerns: (1) the TemplateDefinition constant is structurally valid so
// checkArtefactStructure can be wired to it, and (2) the ParentProgressReport Zod schema
// enforces the DBE constraints that prevent incomplete or tenant-less records reaching L3.

import { describe, expect, it } from 'vitest';

import {
  TemplateDefinition,
  checkArtefactStructure,
} from '../src/curriculum/template.js';
import { PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE } from '../src/curriculum/sources/template-parent-progress-report-benjamin-pine.js';
import {
  BehaviourRating,
  BehaviourRow,
  ParentProgressReport,
  PerformanceRow,
} from '../src/curriculum/reporting.js';

// ---------------------------------------------------------------------------
// PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE — structural validity
// ---------------------------------------------------------------------------

describe('PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE', () => {
  it('is a valid TemplateDefinition — dense section order, no duplicate names', () => {
    const result = TemplateDefinition.safeParse(
      PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE,
    );
    expect(result.success).toBe(true);
  });

  it('is typed as PARENT_PROGRESS_REPORT artefact', () => {
    expect(PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.artefactType).toBe(
      'PARENT_PROGRESS_REPORT',
    );
  });

  it('has exactly 6 sections in order 0–5', () => {
    const orders = PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.sections.map(
      (s) => s.order,
    );
    expect(orders).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('section names match the DBE Parent Progress Report headings', () => {
    const names = PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.sections.map(
      (s) => s.name,
    );
    expect(names).toEqual([
      'Learner & Term Information',
      'Attendance Record',
      'Academic Performance Dashboard',
      'Official DBE Achievement Scale (Grades 1–12)',
      'Behavioural & Personal Development',
      'Official Comments & Sign-Off',
    ]);
  });

  it('all six sections are required', () => {
    expect(
      PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.sections.every((s) => s.required),
    ).toBe(true);
  });

  it('is unratified at ingestion — ratifiedAt is null', () => {
    expect(PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.ratifiedAt).toBeNull();
  });

  it('source document id is stable and unique from other Benjamin Pine templates', () => {
    expect(PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.source.documentId).toBe(
      'benjamin-pine-parent-progress-report-2026',
    );
  });

  it('Teacher Initial in Section 2 is optional; all other fields in that section are required', () => {
    const dashboardSection = PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE.sections[2];
    const teacherInitial = dashboardSection?.fields.find(
      (f) => f.name === 'Teacher Initial',
    );
    expect(teacherInitial?.required).toBe(false);
    const others = dashboardSection?.fields.filter((f) => f.name !== 'Teacher Initial');
    expect(others?.every((f) => f.required)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkArtefactStructure — fidelity against this template
// ---------------------------------------------------------------------------

describe('checkArtefactStructure against PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE', () => {
  const definition = TemplateDefinition.parse(
    PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE,
  );

  it('passes for a fully-populated artefact covering all required sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Learner & Term Information',
          fields: [
            'Surname',
            'First Name(s)',
            'Grade & Section',
            'SA-SAMS Learner ID',
            'Academic Year',
            'Reporting Period',
          ],
        },
        {
          name: 'Attendance Record',
          fields: ['Days Possible', 'Days Absent', 'Late Arrivals'],
        },
        {
          name: 'Academic Performance Dashboard',
          fields: [
            'Subject / Learning Area',
            'Term Mark (%)',
            'Achievement Level (1–7)',
            'Teacher Initial',
          ],
        },
        {
          name: 'Official DBE Achievement Scale (Grades 1–12)',
          fields: [
            'Level 7: Outstanding Achievement (80%–100%)',
            'Level 6: Meritorious Achievement (70%–79%)',
            'Level 5: Substantial Achievement (60%–69%)',
            'Level 4: Adequate Achievement (50%–59%)',
            'Level 3: Moderate Achievement (40%–49%)',
            'Level 2: Elementary Achievement (30%–39%)',
            'Level 1: Not Achieved (0%–29%)',
          ],
        },
        {
          name: 'Behavioural & Personal Development',
          fields: [
            'Classroom Behaviour & Discipline',
            'Effort and Diligence',
            'Social Skills & Peer Relations',
            'Neatness of Work & Uniform',
            'Participation in Extra-Murals',
          ],
        },
        {
          name: 'Official Comments & Sign-Off',
          fields: [
            "Class Teacher's Comments",
            'Teacher Signature and Date',
            "School Principal's Comments",
            'Principal Signature and Date',
            'Parent / Guardian Acknowledgement',
            'Parent Signature and Date',
          ],
        },
      ],
    };
    expect(checkArtefactStructure(definition, artefact)).toEqual([]);
  });

  it('flags a missing required section', () => {
    const artefact = {
      sections: [
        {
          name: 'Learner & Term Information',
          fields: [
            'Surname',
            'First Name(s)',
            'Grade & Section',
            'SA-SAMS Learner ID',
            'Academic Year',
            'Reporting Period',
          ],
        },
        // Attendance Record omitted — should be flagged
        {
          name: 'Academic Performance Dashboard',
          fields: ['Subject / Learning Area', 'Term Mark (%)', 'Achievement Level (1–7)'],
        },
        {
          name: 'Official DBE Achievement Scale (Grades 1–12)',
          fields: [
            'Level 7: Outstanding Achievement (80%–100%)',
            'Level 6: Meritorious Achievement (70%–79%)',
            'Level 5: Substantial Achievement (60%–69%)',
            'Level 4: Adequate Achievement (50%–59%)',
            'Level 3: Moderate Achievement (40%–49%)',
            'Level 2: Elementary Achievement (30%–39%)',
            'Level 1: Not Achieved (0%–29%)',
          ],
        },
        {
          name: 'Behavioural & Personal Development',
          fields: [
            'Classroom Behaviour & Discipline',
            'Effort and Diligence',
            'Social Skills & Peer Relations',
            'Neatness of Work & Uniform',
            'Participation in Extra-Murals',
          ],
        },
        {
          name: 'Official Comments & Sign-Off',
          fields: [
            "Class Teacher's Comments",
            'Teacher Signature and Date',
            'Principal Signature and Date',
            'Parent Signature and Date',
          ],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_section',
      section: 'Attendance Record',
    });
  });
});

// ---------------------------------------------------------------------------
// BehaviourRating enum
// ---------------------------------------------------------------------------

describe('BehaviourRating', () => {
  it('accepts the four DBE behaviour rating codes', () => {
    expect(BehaviourRating.safeParse('E').success).toBe(true);
    expect(BehaviourRating.safeParse('G').success).toBe(true);
    expect(BehaviourRating.safeParse('S').success).toBe(true);
    expect(BehaviourRating.safeParse('NI').success).toBe(true);
  });

  it('rejects a freeform string', () => {
    expect(BehaviourRating.safeParse('Excellent').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(BehaviourRating.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BehaviourRow schema
// ---------------------------------------------------------------------------

describe('BehaviourRow', () => {
  const valid = { criterion: 'Classroom Behaviour & Discipline', rating: 'G' as const };

  it('accepts a valid behaviour row', () => {
    expect(BehaviourRow.safeParse(valid).success).toBe(true);
  });

  it('rejects a row with an empty criterion', () => {
    expect(BehaviourRow.safeParse({ ...valid, criterion: '' }).success).toBe(false);
  });

  it('rejects a row with an invalid rating', () => {
    expect(BehaviourRow.safeParse({ ...valid, rating: 'A' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PerformanceRow schema
// ---------------------------------------------------------------------------

describe('PerformanceRow', () => {
  const valid = {
    subject: 'Mathematics',
    termMarkPercent: 72,
    achievementLevel: 6,
    teacherInitial: 'SH',
  };

  it('accepts a complete performance row', () => {
    expect(PerformanceRow.safeParse(valid).success).toBe(true);
  });

  it('accepts a row with no teacher initial', () => {
    expect(PerformanceRow.safeParse({ ...valid, teacherInitial: null }).success).toBe(
      true,
    );
  });

  it('rejects a mark percent above 100', () => {
    expect(PerformanceRow.safeParse({ ...valid, termMarkPercent: 101 }).success).toBe(
      false,
    );
  });

  it('rejects an achievement level of 0 — DBE scale is 1–7', () => {
    expect(PerformanceRow.safeParse({ ...valid, achievementLevel: 0 }).success).toBe(
      false,
    );
  });

  it('rejects an achievement level of 8 — DBE scale is 1–7', () => {
    expect(PerformanceRow.safeParse({ ...valid, achievementLevel: 8 }).success).toBe(
      false,
    );
  });

  it('rejects a negative termMarkPercent', () => {
    expect(PerformanceRow.safeParse({ ...valid, termMarkPercent: -1 }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// ParentProgressReport schema
// ---------------------------------------------------------------------------

const TENANT = '00000000-0000-0000-0000-000000000001';

const validReport = {
  tenantId: TENANT,
  surname: 'Dlamini',
  firstNames: 'Ayanda',
  gradeSection: '4',
  saSamsLearnerId: 'BP2026-00042',
  academicYear: 2026,
  reportingPeriod: 'Term 2',
  daysPossible: 50,
  daysAbsent: 2,
  lateArrivals: 1,
  performanceRows: [
    {
      subject: 'Mathematics',
      termMarkPercent: 72,
      achievementLevel: 6,
      teacherInitial: 'SH',
    },
    {
      subject: 'English Home Language',
      termMarkPercent: 65,
      achievementLevel: 5,
      teacherInitial: null,
    },
  ],
  behaviourRows: [
    { criterion: 'Classroom Behaviour & Discipline', rating: 'G' },
    { criterion: 'Effort and Diligence', rating: 'E' },
  ],
  classTeacherComments: 'Ayanda shows strong work ethic and is a valued class member.',
  teacherSignatureDate: null,
  principalComments: null,
  principalSignatureDate: null,
  parentAcknowledgement: null,
  parentSignatureDate: null,
  templateId: 'benjamin-pine-parent-progress-report-2026',
};

describe('ParentProgressReport', () => {
  it('accepts a complete, valid report', () => {
    expect(ParentProgressReport.safeParse(validReport).success).toBe(true);
  });

  it('rejects a report without a tenant — RLS invariant', () => {
    const { tenantId: _omit, ...withoutTenant } = validReport;
    expect(ParentProgressReport.safeParse(withoutTenant).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, tenantId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects an empty performanceRows array — a report with no subjects is not a report', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, performanceRows: [] }).success,
    ).toBe(false);
  });

  it('rejects an empty behaviourRows array — behavioural section is required', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, behaviourRows: [] }).success,
    ).toBe(false);
  });

  it('rejects zero daysPossible', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, daysPossible: 0 }).success,
    ).toBe(false);
  });

  it('allows null signature dates before the report is signed', () => {
    const draft = {
      ...validReport,
      teacherSignatureDate: null,
      principalSignatureDate: null,
      parentSignatureDate: null,
    };
    expect(ParentProgressReport.safeParse(draft).success).toBe(true);
  });

  it('rejects an invalid grade label', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, gradeSection: '13' }).success,
    ).toBe(false);
  });

  it('rejects an academic year before 2000', () => {
    expect(
      ParentProgressReport.safeParse({ ...validReport, academicYear: 1999 }).success,
    ).toBe(false);
  });
});
