// CAPS Unit Blueprint Template ingestion tests — Stage 08 / MOD-01.
//
// Two concerns: (1) the TemplateDefinition constant is structurally valid so
// checkArtefactStructure can be wired to it, and (2) the UnitPlanDocument Zod schema
// enforces the constraints that prevent incomplete or tenant-less records reaching L3.

import { describe, expect, it } from 'vitest';

import {
  TemplateDefinition,
  checkArtefactStructure,
} from '../src/curriculum/template.js';
import { UNIT_PLAN_TEMPLATE_BENJAMIN_PINE } from '../src/curriculum/sources/template-unit-plan-benjamin-pine.js';
import {
  CoverageStatus,
  UnitPlanDocument,
  UnitPlanLessonRow,
} from '../src/curriculum/planning.js';

// ---------------------------------------------------------------------------
// UNIT_PLAN_TEMPLATE_BENJAMIN_PINE — structural validity
// ---------------------------------------------------------------------------

describe('UNIT_PLAN_TEMPLATE_BENJAMIN_PINE', () => {
  it('is a valid TemplateDefinition — dense section order, no duplicate names', () => {
    const result = TemplateDefinition.safeParse(UNIT_PLAN_TEMPLATE_BENJAMIN_PINE);
    expect(result.success).toBe(true);
  });

  it('is typed as UNIT_PLAN artefact', () => {
    expect(UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.artefactType).toBe('UNIT_PLAN');
  });

  it('has exactly 7 sections in order 0–6', () => {
    const orders = UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('section names match the CAPS Unit Blueprint headings', () => {
    const names = UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.name);
    expect(names).toEqual([
      'Administrative and Contextual Details',
      'Curriculum Alignment (CAPS)',
      'Learning Objectives and Outcomes',
      'Assessment Strategy',
      'Unit Scope, Sequence and Learning Plan',
      'Learning and Teaching Support Materials (LTSM)',
      'Teacher Reflection and Curriculum Tracking',
    ]);
  });

  it('Sections 1–5 are required; Sections 6–7 are optional', () => {
    const sections = UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.sections;
    expect(sections.slice(0, 5).every((s) => s.required)).toBe(true);
    expect(sections.slice(5).every((s) => !s.required)).toBe(true);
  });

  it('is unratified at ingestion — ratifiedAt is null', () => {
    expect(UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.ratifiedAt).toBeNull();
  });

  it('source document id is stable and unique from the lesson plan template', () => {
    expect(UNIT_PLAN_TEMPLATE_BENJAMIN_PINE.source.documentId).toBe(
      'benjamin-pine-unit-plan-2026',
    );
  });
});

// ---------------------------------------------------------------------------
// checkArtefactStructure — fidelity against this template
// ---------------------------------------------------------------------------

describe('checkArtefactStructure against UNIT_PLAN_TEMPLATE_BENJAMIN_PINE', () => {
  const definition = TemplateDefinition.parse(UNIT_PLAN_TEMPLATE_BENJAMIN_PINE);

  it('passes for a fully-populated artefact covering all required sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Administrative and Contextual Details',
          fields: [
            'School Name',
            'District / Circuit',
            'Subject',
            'Grade',
            'Term',
            'Week (From)',
            'Week (To)',
            'Unit / Theme Title',
            'Total Time Allocation',
          ],
        },
        {
          name: 'Curriculum Alignment (CAPS)',
          fields: [
            'CAPS Topic / Sub-topic',
            'Core Concepts and Content',
            'Skills to be Developed',
          ],
        },
        {
          name: 'Learning Objectives and Outcomes',
          fields: [
            'Level 1 — Low (Knowledge / Recall)',
            'Level 2 — Medium (Understanding / Application)',
            'Level 3 — High (Analysis / Evaluation / Creation)',
          ],
        },
        {
          name: 'Assessment Strategy',
          fields: [
            'Formative Assessment — Assessment FOR Learning',
            'Formal Assessment Task (FAT) — Assessment OF Learning',
          ],
        },
        {
          name: 'Unit Scope, Sequence and Learning Plan',
          fields: [
            'Lesson / Day',
            'Core Lesson Objective',
            'Teacher Activities (Methodology)',
            'Learner Activities (Evidence)',
            'Resources Needed',
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
          name: 'Administrative and Contextual Details',
          fields: [
            'School Name',
            'District / Circuit',
            'Subject',
            'Grade',
            'Term',
            'Week (From)',
            'Week (To)',
            'Unit / Theme Title',
            'Total Time Allocation',
          ],
        },
        // Curriculum Alignment omitted — should be flagged
        {
          name: 'Learning Objectives and Outcomes',
          fields: [
            'Level 1 — Low (Knowledge / Recall)',
            'Level 2 — Medium (Understanding / Application)',
            'Level 3 — High (Analysis / Evaluation / Creation)',
          ],
        },
        {
          name: 'Assessment Strategy',
          fields: [
            'Formative Assessment — Assessment FOR Learning',
            'Formal Assessment Task (FAT) — Assessment OF Learning',
          ],
        },
        {
          name: 'Unit Scope, Sequence and Learning Plan',
          fields: [
            'Lesson / Day',
            'Core Lesson Objective',
            'Teacher Activities (Methodology)',
            'Learner Activities (Evidence)',
            'Resources Needed',
          ],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_section',
      section: 'Curriculum Alignment (CAPS)',
    });
  });

  it('does not flag omitting the optional LTSM or Reflection sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Administrative and Contextual Details',
          fields: [
            'School Name',
            'District / Circuit',
            'Subject',
            'Grade',
            'Term',
            'Week (From)',
            'Week (To)',
            'Unit / Theme Title',
            'Total Time Allocation',
          ],
        },
        {
          name: 'Curriculum Alignment (CAPS)',
          fields: [
            'CAPS Topic / Sub-topic',
            'Core Concepts and Content',
            'Skills to be Developed',
          ],
        },
        {
          name: 'Learning Objectives and Outcomes',
          fields: [
            'Level 1 — Low (Knowledge / Recall)',
            'Level 2 — Medium (Understanding / Application)',
            'Level 3 — High (Analysis / Evaluation / Creation)',
          ],
        },
        {
          name: 'Assessment Strategy',
          fields: [
            'Formative Assessment — Assessment FOR Learning',
            'Formal Assessment Task (FAT) — Assessment OF Learning',
          ],
        },
        {
          name: 'Unit Scope, Sequence and Learning Plan',
          fields: [
            'Lesson / Day',
            'Core Lesson Objective',
            'Teacher Activities (Methodology)',
            'Learner Activities (Evidence)',
            'Resources Needed',
          ],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(
      violations.some((v) => v.kind === 'missing_section' && v.section.includes('LTSM')),
    ).toBe(false);
    expect(
      violations.some(
        (v) => v.kind === 'missing_section' && v.section.includes('Reflection'),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UnitPlanLessonRow schema
// ---------------------------------------------------------------------------

describe('UnitPlanLessonRow', () => {
  const valid = {
    lessonDay: 'Day 1',
    coreObjective: 'Identify the five major food groups.',
    teacherActivities: 'Show food pyramid poster; ask probing questions.',
    learnerActivities: 'Complete DBE Workbook p. 12 activity.',
    resources: 'DBE Rainbow Workbook Vol. 1 p. 12',
  };

  it('accepts a complete lesson row', () => {
    expect(UnitPlanLessonRow.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty resources string — resources column is optional text', () => {
    expect(UnitPlanLessonRow.safeParse({ ...valid, resources: '' }).success).toBe(true);
  });

  it('rejects a row missing a required column', () => {
    const { coreObjective: _omit, ...withoutObjective } = valid;
    expect(UnitPlanLessonRow.safeParse(withoutObjective).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CoverageStatus enum
// ---------------------------------------------------------------------------

describe('CoverageStatus', () => {
  it('accepts the three DBE tracking states', () => {
    expect(CoverageStatus.safeParse('on_track').success).toBe(true);
    expect(CoverageStatus.safeParse('behind').success).toBe(true);
    expect(CoverageStatus.safeParse('ahead').success).toBe(true);
  });

  it('rejects a freeform string', () => {
    expect(CoverageStatus.safeParse('mostly done').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UnitPlanDocument schema
// ---------------------------------------------------------------------------

const TENANT = '00000000-0000-0000-0000-000000000001';

const validDocument = {
  tenantId: TENANT,
  schoolName: 'Benjamin Pine Primary School',
  district: 'Pinetown District',
  subject: 'Life Skills',
  grade: '3',
  termNumber: 1,
  weekFrom: 2,
  weekTo: 4,
  unitTitle: 'My Body, My Health',
  timeAllocation: '6 Hours',
  capsTopicSubtopic: 'Health and Hygiene — Personal Hygiene',
  coreConcepts: 'Personal cleanliness; food groups; exercise.',
  skillsToDevelop: 'Identifying, classifying, communicating.',
  objectiveLow: 'Name the five food groups.',
  objectiveMedium: 'Explain why each food group is important.',
  objectiveHigh: "Evaluate a day's meals and suggest improvements.",
  formativeAssessment: 'Daily oral questioning; DBE Workbook activities.',
  formalAssessmentTask: 'Term 1 project — My Healthy Plate.',
  enrichment: 'Research a traditional South African dish and classify its food groups.',
  remediation: 'Peer-support pair work on food group flashcards.',
  lessons: [
    {
      lessonDay: 'Day 1',
      coreObjective: 'Name the five food groups.',
      teacherActivities: 'Display food pyramid; class discussion.',
      learnerActivities: 'Sort food pictures into groups.',
      resources: 'DBE Workbook p. 12',
    },
  ],
  ltsmApprovedTextbooks: 'Via Afrika Life Skills Grade 3 p. 45–52',
  ltsmDbeWorkbooks: 'Volume 1 p. 12–14',
  ltsmPosters: true,
  ltsmDigital: false,
  coverageStatus: null,
  gapsIdentified: null,
  interventionPlan: null,
  successesAndImprovements: null,
  templateId: 'benjamin-pine-unit-plan-2026',
  academicYear: 2026,
};

describe('UnitPlanDocument', () => {
  it('accepts a complete, valid document', () => {
    expect(UnitPlanDocument.safeParse(validDocument).success).toBe(true);
  });

  it('rejects a document without a tenant — RLS invariant', () => {
    const { tenantId: _omit, ...withoutTenant } = validDocument;
    expect(UnitPlanDocument.safeParse(withoutTenant).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(
      UnitPlanDocument.safeParse({ ...validDocument, tenantId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects an invalid grade label', () => {
    expect(UnitPlanDocument.safeParse({ ...validDocument, grade: '13' }).success).toBe(
      false,
    );
  });

  it('rejects a term number outside 1–4', () => {
    expect(UnitPlanDocument.safeParse({ ...validDocument, termNumber: 0 }).success).toBe(
      false,
    );
    expect(UnitPlanDocument.safeParse({ ...validDocument, termNumber: 5 }).success).toBe(
      false,
    );
  });

  it('rejects an empty lessons array — a unit with no lessons is not a plan', () => {
    expect(UnitPlanDocument.safeParse({ ...validDocument, lessons: [] }).success).toBe(
      false,
    );
  });

  it('allows null reflection fields before the unit is taught', () => {
    const draft = {
      ...validDocument,
      coverageStatus: null,
      gapsIdentified: null,
      interventionPlan: null,
      successesAndImprovements: null,
    };
    expect(UnitPlanDocument.safeParse(draft).success).toBe(true);
  });

  it('accepts a completed reflection after teaching', () => {
    const completed = {
      ...validDocument,
      coverageStatus: 'on_track',
      gapsIdentified: 'None — all content covered.',
      interventionPlan: 'N/A',
      successesAndImprovements: 'Learners engaged well with the food sorting activity.',
    };
    expect(UnitPlanDocument.safeParse(completed).success).toBe(true);
  });

  it('rejects an invalid coverage status value', () => {
    expect(
      UnitPlanDocument.safeParse({ ...validDocument, coverageStatus: 'complete' })
        .success,
    ).toBe(false);
  });

  it('rejects an academic year before 2000', () => {
    expect(
      UnitPlanDocument.safeParse({ ...validDocument, academicYear: 1999 }).success,
    ).toBe(false);
  });
});
