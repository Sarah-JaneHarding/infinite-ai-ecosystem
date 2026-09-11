// Benjamin Pine Marking Guidelines / Memorandum template ingestion tests — Stage 08 / MOD-01.
//
// Two concerns: (1) the TemplateDefinition constant is structurally valid so
// checkArtefactStructure can be wired to it, and (2) the MarkingMemo Zod schema
// enforces the constraints that prevent incomplete or tenant-less records reaching L3.

import { describe, expect, it } from 'vitest';

import {
  TemplateDefinition,
  checkArtefactStructure,
} from '../src/curriculum/template.js';
import { MARKING_MEMO_TEMPLATE_BENJAMIN_PINE } from '../src/curriculum/sources/template-marking-memo-benjamin-pine.js';
import { MarkingMemo, MarkingMemoMatrix } from '../src/curriculum/assessment.js';

// ---------------------------------------------------------------------------
// MARKING_MEMO_TEMPLATE_BENJAMIN_PINE — structural validity
// ---------------------------------------------------------------------------

describe('MARKING_MEMO_TEMPLATE_BENJAMIN_PINE', () => {
  it('is a valid TemplateDefinition — dense section order, no duplicate names', () => {
    const result = TemplateDefinition.safeParse(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE);
    expect(result.success).toBe(true);
  });

  it('is typed as RUBRIC_MARKING_MEMO artefact', () => {
    expect(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.artefactType).toBe('RUBRIC_MARKING_MEMO');
  });

  it('has exactly 6 sections in order 0–5', () => {
    const orders = MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('section names match the DBE Marking Guidelines headings', () => {
    const names = MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.sections.map((s) => s.name);
    expect(names).toEqual([
      'Assessment Details',
      'Instructions and Information for Markers',
      'Assessment Blueprint & Cognitive Weighting Matrix',
      'Question-by-Question Marking Memo',
      'Generic DBE Assessment Rubric Template',
      'Sign-Off',
    ]);
  });

  it('all six sections are required', () => {
    expect(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.sections.every((s) => s.required)).toBe(
      true,
    );
  });

  it('is unratified at ingestion — ratifiedAt is null', () => {
    expect(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.ratifiedAt).toBeNull();
  });

  it('source document id is stable and unique from other Benjamin Pine templates', () => {
    expect(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.source.documentId).toBe(
      'benjamin-pine-marking-memo-2026',
    );
  });

  it('all fields in Section 2 (Cognitive Weighting Matrix) are required', () => {
    const matrixSection = MARKING_MEMO_TEMPLATE_BENJAMIN_PINE.sections[2];
    expect(matrixSection?.fields.every((f) => f.required)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkArtefactStructure — fidelity against this template
// ---------------------------------------------------------------------------

describe('checkArtefactStructure against MARKING_MEMO_TEMPLATE_BENJAMIN_PINE', () => {
  const definition = TemplateDefinition.parse(MARKING_MEMO_TEMPLATE_BENJAMIN_PINE);

  it('passes for a fully-populated artefact covering all required sections', () => {
    const artefact = {
      sections: [
        {
          name: 'Assessment Details',
          fields: [
            'Subject Name',
            'Examination / Assessment',
            'Total Marks',
            'Time Allocation',
          ],
        },
        {
          name: 'Instructions and Information for Markers',
          fields: [
            'Objective Marking',
            'No Double Penalties',
            'Exceeding Word / Length Constraints',
            'Language and Spelling',
            'Tick Allocation',
          ],
        },
        {
          name: 'Assessment Blueprint & Cognitive Weighting Matrix',
          fields: [
            'Question No.',
            'Topic / Content Area',
            'Level 1 & 2 (Knowledge & Recall — 40%)',
            'Level 3 (Application & Analysis — 40%)',
            'Level 4 & 5 (Evaluation & Synthesis — 20%)',
            'Total Marks',
          ],
        },
        {
          name: 'Question-by-Question Marking Memo',
          fields: [
            'Section A — Short / Objective Questions',
            'Section B — Structured / Paragraph Questions',
            'Section C — Essay / Extended Responses (Rubric-Based)',
          ],
        },
        {
          name: 'Generic DBE Assessment Rubric Template',
          fields: [
            'Criteria 1: Content & Planning',
            'Criteria 2: Language, Style & Editing',
            'Criteria 3: Structure & Presentation',
          ],
        },
        {
          name: 'Sign-Off',
          fields: ['Subject Head / Moderator Signature & Date', 'HOD Signature & Date'],
        },
      ],
    };
    expect(checkArtefactStructure(definition, artefact)).toEqual([]);
  });

  it('flags a missing required section', () => {
    const artefact = {
      sections: [
        {
          name: 'Assessment Details',
          fields: [
            'Subject Name',
            'Examination / Assessment',
            'Total Marks',
            'Time Allocation',
          ],
        },
        // Instructions and Information for Markers omitted — should be flagged
        {
          name: 'Assessment Blueprint & Cognitive Weighting Matrix',
          fields: [
            'Question No.',
            'Topic / Content Area',
            'Level 1 & 2 (Knowledge & Recall — 40%)',
            'Level 3 (Application & Analysis — 40%)',
            'Level 4 & 5 (Evaluation & Synthesis — 20%)',
            'Total Marks',
          ],
        },
        {
          name: 'Question-by-Question Marking Memo',
          fields: [
            'Section A — Short / Objective Questions',
            'Section B — Structured / Paragraph Questions',
            'Section C — Essay / Extended Responses (Rubric-Based)',
          ],
        },
        {
          name: 'Generic DBE Assessment Rubric Template',
          fields: [
            'Criteria 1: Content & Planning',
            'Criteria 2: Language, Style & Editing',
            'Criteria 3: Structure & Presentation',
          ],
        },
        {
          name: 'Sign-Off',
          fields: ['Subject Head / Moderator Signature & Date', 'HOD Signature & Date'],
        },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_section',
      section: 'Instructions and Information for Markers',
    });
  });
});

// ---------------------------------------------------------------------------
// MarkingMemoMatrix schema
// ---------------------------------------------------------------------------

const TENANT = '00000000-0000-0000-0000-000000000001';

describe('MarkingMemoMatrix', () => {
  const validRow = {
    questionNumber: 1,
    topicArea: 'Number Sense — Fractions',
    knowledgeRecallMarks: 10,
    applicationAnalysisMarks: 15,
    evaluationSynthesisMarks: 5,
    totalMarks: 30,
  };

  it('accepts a valid matrix row', () => {
    expect(MarkingMemoMatrix.safeParse(validRow).success).toBe(true);
  });

  it('accepts a row with zero marks for a cognitive tier', () => {
    expect(
      MarkingMemoMatrix.safeParse({ ...validRow, evaluationSynthesisMarks: 0 }).success,
    ).toBe(true);
  });

  it('rejects a row with zero totalMarks', () => {
    expect(MarkingMemoMatrix.safeParse({ ...validRow, totalMarks: 0 }).success).toBe(
      false,
    );
  });

  it('rejects a row with a negative questionNumber', () => {
    expect(MarkingMemoMatrix.safeParse({ ...validRow, questionNumber: -1 }).success).toBe(
      false,
    );
  });

  it('rejects a row with negative cognitive marks', () => {
    expect(
      MarkingMemoMatrix.safeParse({ ...validRow, knowledgeRecallMarks: -1 }).success,
    ).toBe(false);
  });

  it('rejects a row with an empty topicArea', () => {
    expect(MarkingMemoMatrix.safeParse({ ...validRow, topicArea: '' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// MarkingMemo schema
// ---------------------------------------------------------------------------

const validMemo = {
  tenantId: TENANT,
  subject: 'Mathematics',
  examinationName: 'Term 2 Mathematics Test',
  totalMarks: 50,
  timeAllocationMinutes: 60,
  matrix: [
    {
      questionNumber: 1,
      topicArea: 'Number Sense — Place Value',
      knowledgeRecallMarks: 10,
      applicationAnalysisMarks: 10,
      evaluationSynthesisMarks: 5,
      totalMarks: 25,
    },
    {
      questionNumber: 2,
      topicArea: 'Fractions',
      knowledgeRecallMarks: 5,
      applicationAnalysisMarks: 15,
      evaluationSynthesisMarks: 5,
      totalMarks: 25,
    },
  ],
  sectionAMemo: 'Answer all questions. 1 mark per correct answer.',
  sectionBMemo: 'Show all working. Award marks for method.',
  sectionCMemo:
    'Use the rubric. Four levels: Outstanding / Adequate / Elementary / Not Achieved.',
  subjectModeratorSignatureDate: null,
  hodSignatureDate: null,
  templateId: 'benjamin-pine-marking-memo-2026',
  academicYear: 2026,
};

describe('MarkingMemo', () => {
  it('accepts a complete, valid memo', () => {
    expect(MarkingMemo.safeParse(validMemo).success).toBe(true);
  });

  it('rejects a memo without a tenant — RLS invariant', () => {
    const { tenantId: _omit, ...withoutTenant } = validMemo;
    expect(MarkingMemo.safeParse(withoutTenant).success).toBe(false);
  });

  it('rejects a malformed tenant UUID', () => {
    expect(MarkingMemo.safeParse({ ...validMemo, tenantId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects zero totalMarks', () => {
    expect(MarkingMemo.safeParse({ ...validMemo, totalMarks: 0 }).success).toBe(false);
  });

  it('rejects zero timeAllocationMinutes', () => {
    expect(
      MarkingMemo.safeParse({ ...validMemo, timeAllocationMinutes: 0 }).success,
    ).toBe(false);
  });

  it('rejects an empty matrix array', () => {
    expect(MarkingMemo.safeParse({ ...validMemo, matrix: [] }).success).toBe(false);
  });

  it('allows null signature dates before moderation', () => {
    const draft = {
      ...validMemo,
      subjectModeratorSignatureDate: null,
      hodSignatureDate: null,
    };
    expect(MarkingMemo.safeParse(draft).success).toBe(true);
  });

  it('accepts filled signature dates after moderation', () => {
    const moderated = {
      ...validMemo,
      subjectModeratorSignatureDate: '2026-04-15',
      hodSignatureDate: '2026-04-16',
    };
    expect(MarkingMemo.safeParse(moderated).success).toBe(true);
  });

  it('rejects an academic year before 2000', () => {
    expect(MarkingMemo.safeParse({ ...validMemo, academicYear: 1999 }).success).toBe(
      false,
    );
  });
});
