// Benjamin Pine Primary School — 2026 CAPS Unit Blueprint Template.
// Ingested from the Infinite-AI Curriculum Engine Unit Blueprint artifact 2026-09-09.
// Closes OQ-003 for UNIT_PLAN: the school has now supplied its unit plan template.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-unit-plan-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 CAPS Unit Blueprint template.
 *
 * Section ordering and field names follow the DBE-aligned artifact exactly. Required
 * sections are those that appear unconditionally on every unit; optional sections (LTSM,
 * Teacher Reflection) may be omitted on in-progress drafts. All field names are verbatim
 * from the template headings so CE-04's renderer can produce a matching label and
 * `checkArtefactStructure` can confirm it.
 */
export const UNIT_PLAN_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'UNIT_PLAN',
  version: '1.0.0',
  source: ref('Cover — CAPS-Aligned Unit Blueprint Template'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Administrative and Contextual Details',
      order: 0,
      required: true,
      fields: [
        { name: 'School Name', required: true },
        { name: 'District / Circuit', required: true },
        { name: 'Subject', required: true },
        { name: 'Grade', required: true },
        { name: 'Term', required: true },
        { name: 'Week (From)', required: true },
        { name: 'Week (To)', required: true },
        { name: 'Unit / Theme Title', required: true },
        { name: 'Total Time Allocation', required: true },
      ],
    },
    {
      name: 'Curriculum Alignment (CAPS)',
      order: 1,
      required: true,
      fields: [
        { name: 'CAPS Topic / Sub-topic', required: true },
        { name: 'Core Concepts and Content', required: true },
        { name: 'Skills to be Developed', required: true },
      ],
    },
    {
      name: 'Learning Objectives and Outcomes',
      order: 2,
      required: true,
      fields: [
        { name: 'Level 1 — Low (Knowledge / Recall)', required: true },
        { name: 'Level 2 — Medium (Understanding / Application)', required: true },
        { name: 'Level 3 — High (Analysis / Evaluation / Creation)', required: true },
      ],
    },
    {
      name: 'Assessment Strategy',
      order: 3,
      required: true,
      fields: [
        { name: 'Formative Assessment — Assessment FOR Learning', required: true },
        { name: 'Formal Assessment Task (FAT) — Assessment OF Learning', required: true },
        { name: 'Enrichment (High Achievers)', required: false },
        { name: 'Remediation (SIAS Policy Framework)', required: false },
      ],
    },
    {
      name: 'Unit Scope, Sequence and Learning Plan',
      order: 4,
      required: true,
      fields: [
        { name: 'Lesson / Day', required: true },
        { name: 'Core Lesson Objective', required: true },
        { name: 'Teacher Activities (Methodology)', required: true },
        { name: 'Learner Activities (Evidence)', required: true },
        { name: 'Resources Needed', required: true },
      ],
    },
    {
      name: 'Learning and Teaching Support Materials (LTSM)',
      order: 5,
      required: false,
      fields: [
        { name: 'Approved Textbooks', required: false },
        { name: 'DBE Rainbow Workbooks', required: false },
        { name: 'Posters / Charts / Manipulatives', required: false },
        { name: 'Digital Resources / Slides / Audio Clips', required: false },
      ],
    },
    {
      name: 'Teacher Reflection and Curriculum Tracking',
      order: 6,
      required: false,
      fields: [
        { name: 'Curriculum Coverage Status', required: true },
        { name: 'Gaps Identified / Work Not Covered', required: false },
        { name: 'Intervention Plan to Catch Up', required: false },
        { name: 'Successes and Areas for Improvement', required: false },
        { name: 'Teacher Signature and Date', required: true },
        { name: 'HOD / Senior Teacher Signature and Date', required: true },
      ],
    },
  ],
};
