// Benjamin Pine Primary School — 2026 Lesson Plan Preparation Template.
// Supplied as a .docx file and ingested 2026-08-19.
// Partially closes OQ-003: one school has now supplied its lesson plan template.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-lesson-plan-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 lesson plan template.
 *
 * Section ordering follows the template document exactly. Required sections are those
 * that appear unconditionally; optional sections (Glossary) may be omitted when not
 * applicable. All field names are verbatim from the template headings so CE-05's renderer
 * can produce a byte-for-byte-matching label and `checkArtefactStructure` can confirm it.
 */
export const LESSON_PLAN_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'LESSON_PLAN',
  version: '1.0.0',
  source: ref('Cover page — Lesson Planning and Preparation'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Lesson Header',
      order: 0,
      required: true,
      fields: [
        { name: 'Subject', required: true },
        { name: 'Grade', required: true },
        { name: 'Duration', required: true },
        { name: 'Date', required: true },
        { name: 'Topic', required: true },
      ],
    },
    {
      name: 'Glossary',
      order: 1,
      required: false,
      fields: [{ name: 'Glossary', required: false }],
    },
    {
      name: 'Prior Knowledge',
      order: 2,
      required: true,
      fields: [{ name: 'What to remember from previous lessons', required: true }],
    },
    {
      name: 'Resources',
      order: 3,
      required: true,
      fields: [{ name: 'Resources', required: true }],
    },
    {
      name: 'Learning Intentions',
      order: 4,
      required: true,
      fields: [
        { name: 'Learning Intentions: We are learning to (WALT)', required: true },
      ],
    },
    {
      name: 'Success Criteria',
      order: 5,
      required: true,
      fields: [
        {
          name: 'Success Criteria: I know I have achieved the learning intentions when I can',
          required: true,
        },
      ],
    },
    {
      name: 'Activities',
      order: 6,
      required: true,
      fields: [
        {
          name: 'Activities that learners will be doing',
          required: true,
        },
      ],
    },
    {
      name: 'LI and SC Delivery',
      order: 7,
      required: true,
      fields: [
        { name: 'How will I share the LI and SC with learners', required: true },
        { name: 'How will I check if learners understand the LI and SC', required: true },
        { name: 'How will I remind my learners about the LI and SC', required: true },
        {
          name: 'How will I check if the SC have been attained before the end of the lesson',
          required: true,
        },
      ],
    },
    {
      name: 'Formative Assessment',
      order: 8,
      required: true,
      fields: [
        {
          name: 'What formative assessment techniques am I going to use in this lesson',
          required: true,
        },
      ],
    },
    {
      name: 'High Cognitive Demand Questions',
      order: 9,
      required: true,
      fields: [{ name: 'High Cognitive demand questions I will ask', required: true }],
    },
    {
      name: 'Feedback',
      order: 10,
      required: true,
      fields: [
        { name: 'Provide written feedback for this lesson', required: true },
        { name: 'My feedback will focus on', required: true },
      ],
    },
    {
      name: 'Learner Assessment',
      order: 11,
      required: true,
      fields: [{ name: 'Learners will use the following assessment', required: true }],
    },
  ],
};
