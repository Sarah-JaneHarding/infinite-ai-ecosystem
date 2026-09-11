// Benjamin Pine SBA Blueprint template ingestion tests — Stage 08 / MOD-01.
//
// Two concerns: (1) the TemplateDefinition constant is structurally valid so
// checkArtefactStructure can be wired to it, and (2) the SbaBlueprint Zod schema
// enforces the constraints that prevent incomplete or tenant-less records reaching L3.

import { describe, expect, it } from 'vitest';

import {
  TemplateDefinition,
  checkArtefactStructure,
} from '../src/curriculum/template.js';
import { ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE } from '../src/curriculum/sources/template-assessment-task-benjamin-pine.js';
import {
  SbaBlueprint,
  SbaBlueprintRow,
  SbaCognitiveTier,
} from '../src/curriculum/assessment.js';

// ---------------------------------------------------------------------------
// ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE — structural validity
// ---------------------------------------------------------------------------

describe('ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE', () => {
  it('is a valid TemplateDefinition — dense section order, no duplicate names', () => {
    const result = TemplateDefinition.safeParse(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE);
    expect(result.success).toBe(true);
  });

  it('is typed as ASSESSMENT_TASK artefact', () => {
    expect(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.artefactType).toBe('ASSESSMENT_TASK');
  });

  it('has exactly 4 sections in order 0–3', () => {
    const orders = ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it('section names match the DBE SBA Blueprint headings', () => {
    const names = ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.name);
    expect(names).toEqual([
      'Task Context and ATP Alignment',
      'Assessment Blueprint',
      'Cognitive Demand Analysis Profile',
      'Pre-Moderation Verification Checklist',
    ]);
  });

  it('all four sections are required', () => {
    expect(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.sections.every((s) => s.required)).toBe(
      true,
    );
  });

  it('is unratified at ingestion — ratifiedAt is null', () => {
    expect(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.ratifiedAt).toBeNull();
  });

  it('source document id is stable and unique from the lesson and unit plan templates', () => {
    expect(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.source.documentId).toBe(
      'benjamin-pine-sba-blueprint-2026',
    );
  });

  it('Sub-Q field in Section 2 is optional; all other fields are required', () => {
    const blueprintSection = ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE.sections[1];
    const subQ = blueprintSection?.fields.find((f) => f.name === 'Sub-Q');
    expect(subQ?.required).toBe(false);
    const others = blueprintSection?.fields.filter((f) => f.name !== 'Sub-Q');
    expect(others?.every((f) => f.required)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkArtefactStructure — fidelity against this template
// ---------------------------------------------------------------------------

describe('checkArtefactStructure against ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE', () => {
  const definition = TemplateDefinition.parse(ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE);

  it('passes for a fully-populated artefact covering all required sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Task Context and ATP Alignment',
          fields: [
            'Subject',
            'Grade',
            'Term',
            'Assessment Task Name',
            'ATP Week(s) Covered',
            'Total Task Marks',
          ],
        },
        {
          name: 'Assessment Blueprint',
          fields: [
            'Question No.',
            'Sub-Q',
            'Topic / Content Area',
            'Cognitive Level Area',
            'Expected Marks',
            'Actual Marks',
            '% Weighting',
            'Type of Tool',
          ],
        },
        {
          name: 'Cognitive Demand Analysis Profile',
          fields: [
            'Level 1 and 2 — Low (target 30–40%)',
            'Level 3 — Medium (target 40–50%)',
            'Level 4 — High (target 15–20%)',
          ],
        },
        {
          name: 'Pre-Moderation Verification Checklist',
          fields: [
            'ATP Alignment',
            'Explicit Mark Allocation',
            'Corresponding Assessment Tools',
            'Teacher Signature and Date',
            'HOD Signature and Date (Pre-Moderation)',
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
          name: 'Task Context and ATP Alignment',
          fields: [
            'Subject',
            'Grade',
            'Term',
            'Assessment Task Name',
            'ATP Week(s) Covered',
            'Total Task Marks',
          ],
        },
        // Assessment Blueprint omitted — should be flagged
        {
          name: 'Cognitive Demand Analysis Profile',
          fields: [
            'Level 1 and 2 — Low (target 30–40%)',
            'Level 3 — Medium (target 40–50%)',
            'Level 4 — High (target 15–20%)',
          ],
        },
        {
          name: 'Pre-Moderation Verification Checklist',
          fields: [
            'ATP Alignment',
            'Explicit Mark Allocation',
            'Corresponding Assessment Tools',
            'Teacher Signature and Date',
            'HOD Signature and Date (Pre-Moderation)',
          ],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_section',
      section: 'Assessment Blueprint',
    });
  });
});

// ---------------------------------------------------------------------------
// SbaCognitiveTier enum
// ---------------------------------------------------------------------------

describe('SbaCognitiveTier', () => {
  it('accepts the three DBE cognitive demand levels', () => {
    expect(SbaCognitiveTier.safeParse('low').success).toBe(true);
    expect(SbaCognitiveTier.safeParse('medium').success).toBe(true);
    expect(SbaCognitiveTier.safeParse('high').success).toBe(true);
  });

  it('rejects a freeform string', () => {
    expect(SbaCognitiveTier.safeParse('Level 1').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SbaBlueprintRow schema
// ---------------------------------------------------------------------------

describe('SbaBlueprintRow', () => {
  const valid = {
    questionNumber: 1,
    subQuestion: null,
    topicArea: 'Number Sense — Place Value',
    cognitiveTier: 'low' as const,
    expectedMarks: 5,
    actualMarks: null,
    toolType: 'Written test',
  };

  it('accepts a complete row with no sub-question', () => {
    expect(SbaBlueprintRow.safeParse(valid).success).toBe(true);
  });

  it('accepts a row with a sub-question label', () => {
    expect(SbaBlueprintRow.safeParse({ ...valid, subQuestion: '1.1' }).success).toBe(
      true,
    );
  });

  it('accepts a row with actualMarks filled in after marking', () => {
    expect(SbaBlueprintRow.safeParse({ ...valid, actualMarks: 4 }).success).toBe(true);
  });

  it('rejects a row with zero expectedMarks', () => {
    expect(SbaBlueprintRow.safeParse({ ...valid, expectedMarks: 0 }).success).toBe(false);
  });

  it('rejects a row with a negative actualMarks value', () => {
    expect(SbaBlueprintRow.safeParse({ ...valid, actualMarks: -1 }).success).toBe(false);
  });

  it('rejects a row with an invalid cognitive tier', () => {
    expect(
      SbaBlueprintRow.safeParse({ ...valid, cognitiveTier: 'Level 4' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SbaBlueprint schema
// ---------------------------------------------------------------------------

const TENANT = '00000000-0000-0000-0000-000000000001';

const validBlueprint = {
  tenantId: TENANT,
  subject: 'Mathematics',
  grade: '4',
  termNumber: 2,
  assessmentTaskName: 'Term 2 Mathematics Test',
  atpWeeksCovered: 'Weeks 4–6',
  totalTaskMarks: 50,
  rows: [
    {
      questionNumber: 1,
      subQuestion: null,
      topicArea: 'Number Sense — Fractions',
      cognitiveTier: 'low',
      expectedMarks: 10,
      actualMarks: null,
      toolType: 'Written test',
    },
    {
      questionNumber: 2,
      subQuestion: '2.1',
      topicArea: 'Measurement — Time',
      cognitiveTier: 'medium',
      expectedMarks: 20,
      actualMarks: null,
      toolType: 'Written test',
    },
    {
      questionNumber: 3,
      subQuestion: null,
      topicArea: 'Data Handling — Interpreting graphs',
      cognitiveTier: 'high',
      expectedMarks: 20,
      actualMarks: null,
      toolType: 'Written test',
    },
  ],
  lowDemandPercent: 20,
  mediumDemandPercent: 40,
  highDemandPercent: 40,
  atpAlignmentConfirmed: true,
  explicitMarkAllocationConfirmed: true,
  correspondingToolsConfirmed: true,
  teacherSignatureDate: null,
  hodSignatureDate: null,
  templateId: 'benjamin-pine-sba-blueprint-2026',
  academicYear: 2026,
};

describe('SbaBlueprint', () => {
  it('accepts a complete, valid blueprint', () => {
    expect(SbaBlueprint.safeParse(validBlueprint).success).toBe(true);
  });

  it('rejects a blueprint without a tenant — RLS invariant', () => {
    const { tenantId: _omit, ...withoutTenant } = validBlueprint;
    expect(SbaBlueprint.safeParse(withoutTenant).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(
      SbaBlueprint.safeParse({ ...validBlueprint, tenantId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects an invalid grade label', () => {
    expect(SbaBlueprint.safeParse({ ...validBlueprint, grade: '13' }).success).toBe(
      false,
    );
  });

  it('rejects a term number outside 1–4', () => {
    expect(SbaBlueprint.safeParse({ ...validBlueprint, termNumber: 0 }).success).toBe(
      false,
    );
    expect(SbaBlueprint.safeParse({ ...validBlueprint, termNumber: 5 }).success).toBe(
      false,
    );
  });

  it('rejects an empty rows array — a blueprint with no questions is not a blueprint', () => {
    expect(SbaBlueprint.safeParse({ ...validBlueprint, rows: [] }).success).toBe(false);
  });

  it('rejects zero totalTaskMarks', () => {
    expect(SbaBlueprint.safeParse({ ...validBlueprint, totalTaskMarks: 0 }).success).toBe(
      false,
    );
  });

  it('allows null signature dates before moderation is complete', () => {
    const draft = {
      ...validBlueprint,
      teacherSignatureDate: null,
      hodSignatureDate: null,
    };
    expect(SbaBlueprint.safeParse(draft).success).toBe(true);
  });

  it('accepts filled signature dates after moderation', () => {
    const moderated = {
      ...validBlueprint,
      teacherSignatureDate: '2026-04-15',
      hodSignatureDate: '2026-04-16',
    };
    expect(SbaBlueprint.safeParse(moderated).success).toBe(true);
  });

  it('rejects an academic year before 2000', () => {
    expect(
      SbaBlueprint.safeParse({ ...validBlueprint, academicYear: 1999 }).success,
    ).toBe(false);
  });
});
