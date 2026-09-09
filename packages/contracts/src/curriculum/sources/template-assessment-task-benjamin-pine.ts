// Benjamin Pine Primary School — 2026 SBA Assessment Blueprint Template.
// Ingested from the Infinite-AI Curriculum Engine SBA Blueprint artifact 2026-09-09.
// Closes OQ-003 for ASSESSMENT_TASK: the school has now supplied its SBA blueprint template.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-sba-blueprint-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 SBA Assessment Blueprint
 * template. The four sections follow the DBE-aligned artifact exactly. All field names are
 * verbatim from the template headings so CE-06's renderer can match them and
 * `checkArtefactStructure` can confirm the output.
 *
 * Section 2 (Assessment Blueprint table) has one required field per column heading; the
 * actual row data is a repeating structure handled by the `SbaBlueprint` Zod schema in
 * assessment.ts — the template definition records structure, not cardinality.
 */
export const ASSESSMENT_TASK_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'ASSESSMENT_TASK',
  version: '1.0.0',
  source: ref('Cover — DBE SBA Assessment Blueprint'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Task Context and ATP Alignment',
      order: 0,
      required: true,
      fields: [
        { name: 'Subject', required: true },
        { name: 'Grade', required: true },
        { name: 'Term', required: true },
        { name: 'Assessment Task Name', required: true },
        { name: 'ATP Week(s) Covered', required: true },
        { name: 'Total Task Marks', required: true },
      ],
    },
    {
      name: 'Assessment Blueprint',
      order: 1,
      required: true,
      fields: [
        { name: 'Question No.', required: true },
        { name: 'Sub-Q', required: false },
        { name: 'Topic / Content Area', required: true },
        { name: 'Cognitive Level Area', required: true },
        { name: 'Expected Marks', required: true },
        { name: 'Actual Marks', required: true },
        { name: '% Weighting', required: true },
        { name: 'Type of Tool', required: true },
      ],
    },
    {
      name: 'Cognitive Demand Analysis Profile',
      order: 2,
      required: true,
      fields: [
        { name: 'Level 1 and 2 — Low (target 30–40%)', required: true },
        { name: 'Level 3 — Medium (target 40–50%)', required: true },
        { name: 'Level 4 — High (target 15–20%)', required: true },
      ],
    },
    {
      name: 'Pre-Moderation Verification Checklist',
      order: 3,
      required: true,
      fields: [
        { name: 'ATP Alignment', required: true },
        { name: 'Explicit Mark Allocation', required: true },
        { name: 'Corresponding Assessment Tools', required: true },
        { name: 'Teacher Signature and Date', required: true },
        { name: 'HOD Signature and Date (Pre-Moderation)', required: true },
      ],
    },
  ],
};
