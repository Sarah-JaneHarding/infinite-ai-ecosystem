// Benjamin Pine Lesson Plan Blueprint template ingestion tests — Stage 08 / MOD-01.
//
// Two concerns: (1) the TemplateDefinition constant is structurally valid so
// checkArtefactStructure can be wired to it, and (2) the LessonPlanBlueprint Zod schema
// enforces the constraints that prevent incomplete or tenant-less records reaching L3.
//
// This template uses the four-stage timed structure (Introduction / Development /
// Classwork / Conclusion) and is distinct from the LESSON_PLAN_TEMPLATE_BENJAMIN_PINE
// (12-section WALT/LI/SC template from the school's .docx).

import { describe, expect, it } from 'vitest';

import {
  TemplateDefinition,
  checkArtefactStructure,
} from '../src/curriculum/template.js';
import { LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE } from '../src/curriculum/sources/template-lesson-plan-blueprint-benjamin-pine.js';
import { LessonPlanBlueprint } from '../src/curriculum/lesson.js';

// ---------------------------------------------------------------------------
// LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE — structural validity
// ---------------------------------------------------------------------------

describe('LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE', () => {
  it('is a valid TemplateDefinition — dense section order, no duplicate names', () => {
    const result = TemplateDefinition.safeParse(
      LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE,
    );
    expect(result.success).toBe(true);
  });

  it('is typed as LESSON_PLAN artefact', () => {
    expect(LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.artefactType).toBe('LESSON_PLAN');
  });

  it('has exactly 4 sections in order 0–3', () => {
    const orders = LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.sections.map(
      (s) => s.order,
    );
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it('section names match the DBE CAPS-Aligned Lesson Plan Blueprint headings', () => {
    const names = LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.sections.map(
      (s) => s.name,
    );
    expect(names).toEqual([
      'Administrative Details',
      'Core Planning Elements',
      'Lesson Structure',
      'Reflection and Assessment',
    ]);
  });

  it('all four sections are required', () => {
    expect(
      LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.sections.every((s) => s.required),
    ).toBe(true);
  });

  it('is unratified at ingestion — ratifiedAt is null', () => {
    expect(LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.ratifiedAt).toBeNull();
  });

  it('source document id is distinct from the WALT/LI/SC lesson plan template', () => {
    expect(LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.source.documentId).toBe(
      'benjamin-pine-lesson-plan-blueprint-2026',
    );
  });

  it('Lesson Structure section has the four CAPS-aligned stages', () => {
    const lessonSection = LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.sections[2];
    const fieldNames = lessonSection?.fields.map((f) => f.name);
    expect(fieldNames).toEqual([
      'Introduction (Warm-Up)',
      'Development (Core Lesson)',
      'Classwork',
      'Conclusion & Homework',
    ]);
  });

  it('Assessment Type in Section 3 is required; all other reflection fields are optional', () => {
    const reflectionSection = LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE.sections[3];
    const assessmentType = reflectionSection?.fields.find(
      (f) => f.name === 'Assessment Type',
    );
    expect(assessmentType?.required).toBe(true);
    const optional = reflectionSection?.fields.filter(
      (f) => f.name !== 'Assessment Type',
    );
    expect(optional?.every((f) => !f.required)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkArtefactStructure — fidelity against this template
// ---------------------------------------------------------------------------

describe('checkArtefactStructure against LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE', () => {
  const definition = TemplateDefinition.parse(
    LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE,
  );

  it('passes for a fully-populated artefact covering all required sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Administrative Details',
          fields: [
            'Subject',
            'Grade / Class',
            'Date',
            'Duration (minutes)',
            'Topic / Theme',
          ],
        },
        {
          name: 'Core Planning Elements',
          fields: ['Aims / Objectives', 'Prior Knowledge', 'Resources / LTSM'],
        },
        {
          name: 'Lesson Structure',
          fields: [
            'Introduction (Warm-Up)',
            'Development (Core Lesson)',
            'Classwork',
            'Conclusion & Homework',
          ],
        },
        {
          name: 'Reflection and Assessment',
          fields: [
            'Assessment Type',
            'Assessment Notes',
            'What Worked',
            "What Didn't / Challenges",
            'Adjustments for Next Time',
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
          name: 'Administrative Details',
          fields: [
            'Subject',
            'Grade / Class',
            'Date',
            'Duration (minutes)',
            'Topic / Theme',
          ],
        },
        // Core Planning Elements omitted — should be flagged
        {
          name: 'Lesson Structure',
          fields: [
            'Introduction (Warm-Up)',
            'Development (Core Lesson)',
            'Classwork',
            'Conclusion & Homework',
          ],
        },
        {
          name: 'Reflection and Assessment',
          fields: ['Assessment Type'],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_section',
      section: 'Core Planning Elements',
    });
  });
});

// ---------------------------------------------------------------------------
// LessonPlanBlueprint schema
// ---------------------------------------------------------------------------

const TENANT = '00000000-0000-0000-0000-000000000001';

const validBlueprint = {
  tenantId: TENANT,
  subject: 'Mathematics',
  grade: '4',
  date: '2026-05-12',
  durationMinutes: 60,
  topicTheme: 'Fractions — halves and quarters',
  aimsObjectives:
    'Learners will identify and compare halves and quarters of whole shapes.',
  priorKnowledge: 'Counting to 100; equal sharing concepts from Grade 3.',
  resourcesLtsm: 'Textbook p. 45–47; fraction circles; whiteboard.',
  introduction: '5 min: Warm-up — share a pizza scenario. Activate prior knowledge.',
  development: '20 min: Teacher models halves and quarters using fraction circles.',
  classwork: '25 min: Learners complete worksheet pp. 45–47 in pairs.',
  conclusionHomework: '10 min: Class discussion; homework — p. 48 questions 1–5.',
  assessmentType: 'Informal — classwork observation and worksheet marking.',
  assessmentNotes: null,
  whatWorked: null,
  challenges: null,
  adjustmentsNextTime: null,
  templateId: 'benjamin-pine-lesson-plan-blueprint-2026',
  academicYear: 2026,
};

describe('LessonPlanBlueprint', () => {
  it('accepts a complete, valid blueprint', () => {
    expect(LessonPlanBlueprint.safeParse(validBlueprint).success).toBe(true);
  });

  it('rejects a blueprint without a tenant — RLS invariant', () => {
    const { tenantId: _omit, ...withoutTenant } = validBlueprint;
    expect(LessonPlanBlueprint.safeParse(withoutTenant).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(
      LessonPlanBlueprint.safeParse({ ...validBlueprint, tenantId: 'not-a-uuid' })
        .success,
    ).toBe(false);
  });

  it('rejects an invalid grade label', () => {
    expect(
      LessonPlanBlueprint.safeParse({ ...validBlueprint, grade: '13' }).success,
    ).toBe(false);
  });

  it('rejects zero durationMinutes', () => {
    expect(
      LessonPlanBlueprint.safeParse({ ...validBlueprint, durationMinutes: 0 }).success,
    ).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(
      LessonPlanBlueprint.safeParse({ ...validBlueprint, subject: '' }).success,
    ).toBe(false);
  });

  it('allows null optional reflection fields on a pre-lesson blueprint', () => {
    const prelesson = {
      ...validBlueprint,
      assessmentNotes: null,
      whatWorked: null,
      challenges: null,
      adjustmentsNextTime: null,
    };
    expect(LessonPlanBlueprint.safeParse(prelesson).success).toBe(true);
  });

  it('accepts filled reflection fields after the lesson', () => {
    const postLesson = {
      ...validBlueprint,
      assessmentNotes: 'Observed all learners completing questions 1–3 correctly.',
      whatWorked: 'Fraction circle manipulatives were highly effective.',
      challenges: 'Three learners struggled with quarters; will revisit.',
      adjustmentsNextTime: 'Use smaller groups for the development phase.',
    };
    expect(LessonPlanBlueprint.safeParse(postLesson).success).toBe(true);
  });

  it('rejects an academic year before 2000', () => {
    expect(
      LessonPlanBlueprint.safeParse({ ...validBlueprint, academicYear: 1999 }).success,
    ).toBe(false);
  });
});
