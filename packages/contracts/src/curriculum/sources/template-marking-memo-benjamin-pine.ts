// Benjamin Pine Primary School — 2026 Marking Guidelines / Memorandum Template.
// Ingested from the Infinite-AI Curriculum Engine Marking Guidelines artifact 2026-09-09.
// Partially closes OQ-003 for RUBRIC_MARKING_MEMO: the school has now supplied its memo template.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-marking-memo-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 Marking Guidelines /
 * Memorandum template. Six sections follow the DBE artifact exactly. Sections 0–4 are
 * required; the Sign-Off section is also required per pre-moderation protocol.
 *
 * Section 2 (Cognitive Weighting Matrix) has one required field per column heading; row
 * data is a repeating structure handled by the `MarkingMemoMatrix` Zod schema in
 * assessment.ts — the template definition records structure, not cardinality.
 */
export const MARKING_MEMO_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'RUBRIC_MARKING_MEMO',
  version: '1.0.0',
  source: ref('Cover — DBE Marking Guidelines and Memorandum'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Assessment Details',
      order: 0,
      required: true,
      fields: [
        { name: 'Subject Name', required: true },
        { name: 'Examination / Assessment', required: true },
        { name: 'Total Marks', required: true },
        { name: 'Time Allocation', required: true },
      ],
    },
    {
      name: 'Instructions and Information for Markers',
      order: 1,
      required: true,
      fields: [
        { name: 'Objective Marking', required: true },
        { name: 'No Double Penalties', required: true },
        { name: 'Exceeding Word / Length Constraints', required: true },
        { name: 'Language and Spelling', required: true },
        { name: 'Tick Allocation', required: true },
      ],
    },
    {
      name: 'Assessment Blueprint & Cognitive Weighting Matrix',
      order: 2,
      required: true,
      fields: [
        { name: 'Question No.', required: true },
        { name: 'Topic / Content Area', required: true },
        { name: 'Level 1 & 2 (Knowledge & Recall — 40%)', required: true },
        { name: 'Level 3 (Application & Analysis — 40%)', required: true },
        { name: 'Level 4 & 5 (Evaluation & Synthesis — 20%)', required: true },
        { name: 'Total Marks', required: true },
      ],
    },
    {
      name: 'Question-by-Question Marking Memo',
      order: 3,
      required: true,
      fields: [
        { name: 'Section A — Short / Objective Questions', required: true },
        { name: 'Section B — Structured / Paragraph Questions', required: true },
        { name: 'Section C — Essay / Extended Responses (Rubric-Based)', required: true },
      ],
    },
    {
      name: 'Generic DBE Assessment Rubric Template',
      order: 4,
      required: true,
      fields: [
        { name: 'Criteria 1: Content & Planning', required: true },
        { name: 'Criteria 2: Language, Style & Editing', required: true },
        { name: 'Criteria 3: Structure & Presentation', required: true },
      ],
    },
    {
      name: 'Sign-Off',
      order: 5,
      required: true,
      fields: [
        { name: 'Subject Head / Moderator Signature & Date', required: true },
        { name: 'HOD Signature & Date', required: true },
      ],
    },
  ],
};
