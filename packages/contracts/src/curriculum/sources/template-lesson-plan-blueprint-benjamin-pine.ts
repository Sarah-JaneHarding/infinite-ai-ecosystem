// Benjamin Pine Primary School — 2026 Lesson Plan Blueprint Template.
// Ingested from the Infinite-AI Curriculum Engine Lesson Plan Blueprint artifact 2026-09-09.
// Partially closes OQ-003 for LESSON_PLAN: supplements the school-supplied .docx template
// (template-lesson-plan-benjamin-pine.ts) with a four-stage timed lesson structure.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-lesson-plan-blueprint-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 Lesson Plan Blueprint
 * template. Four sections follow the DBE CAPS-aligned artifact exactly. All four are
 * required — administrative details, core planning, lesson structure (four timed stages),
 * and post-lesson reflection.
 *
 * This supplements the WALT/LI/SC template (template-lesson-plan-benjamin-pine.ts)
 * with a stage-timed structure better suited for CE-05's time-allocation output.
 */
export const LESSON_PLAN_BLUEPRINT_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'LESSON_PLAN',
  version: '1.0.0',
  source: ref('Cover — DBE CAPS-Aligned Lesson Plan Blueprint'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Administrative Details',
      order: 0,
      required: true,
      fields: [
        { name: 'Subject', required: true },
        { name: 'Grade / Class', required: true },
        { name: 'Date', required: true },
        { name: 'Duration (minutes)', required: true },
        { name: 'Topic / Theme', required: true },
      ],
    },
    {
      name: 'Core Planning Elements',
      order: 1,
      required: true,
      fields: [
        { name: 'Aims / Objectives', required: true },
        { name: 'Prior Knowledge', required: true },
        { name: 'Resources / LTSM', required: true },
      ],
    },
    {
      name: 'Lesson Structure',
      order: 2,
      required: true,
      fields: [
        { name: 'Introduction (Warm-Up)', required: true },
        { name: 'Development (Core Lesson)', required: true },
        { name: 'Classwork', required: true },
        { name: 'Conclusion & Homework', required: true },
      ],
    },
    {
      name: 'Reflection and Assessment',
      order: 3,
      required: true,
      fields: [
        { name: 'Assessment Type', required: true },
        { name: 'Assessment Notes', required: false },
        { name: 'What Worked', required: false },
        { name: "What Didn't / Challenges", required: false },
        { name: 'Adjustments for Next Time', required: false },
      ],
    },
  ],
};
