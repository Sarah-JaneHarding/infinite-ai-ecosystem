// Benjamin Pine Primary School — 2026 Parent Progress Report Template.
// Ingested from the Infinite-AI Curriculum Engine Parent Progress Report artifact 2026-09-09.
// Partially closes OQ-003 for PARENT_PROGRESS_REPORT: the school has now supplied its report template.
// ratifiedAt: null until the principal or designate formally countersigns.

import type { TemplateDefinition } from '../template.js';
import type { SourceRef } from '../framework.js';

const DOC_ID = 'benjamin-pine-parent-progress-report-2026' as const;
const DOC_VERSION = '2026-v1' as const;

function ref(clause: string): SourceRef {
  return { documentId: DOC_ID, documentVersion: DOC_VERSION, clause, ratifiedBy: null };
}

/**
 * Structural definition of Benjamin Pine Primary School's 2026 Parent Progress Report
 * template. Six sections follow the DBE artifact exactly. All six are required — a report
 * that omits attendance, academic performance, behaviour, or signatures is not a
 * complete term report.
 *
 * Section 2 (Academic Performance Dashboard) has one required field per column heading;
 * row data is a repeating structure handled by the `PerformanceRow` Zod schema in
 * reporting.ts.
 */
export const PARENT_PROGRESS_REPORT_TEMPLATE_BENJAMIN_PINE: TemplateDefinition = {
  artefactType: 'PARENT_PROGRESS_REPORT',
  version: '1.0.0',
  source: ref('Cover — Official Term Progress Report'),
  ratifiedAt: null,
  sections: [
    {
      name: 'Learner & Term Information',
      order: 0,
      required: true,
      fields: [
        { name: 'Surname', required: true },
        { name: 'First Name(s)', required: true },
        { name: 'Grade & Section', required: true },
        { name: 'SA-SAMS Learner ID', required: true },
        { name: 'Academic Year', required: true },
        { name: 'Reporting Period', required: true },
      ],
    },
    {
      name: 'Attendance Record',
      order: 1,
      required: true,
      fields: [
        { name: 'Days Possible', required: true },
        { name: 'Days Absent', required: true },
        { name: 'Late Arrivals', required: true },
      ],
    },
    {
      name: 'Academic Performance Dashboard',
      order: 2,
      required: true,
      fields: [
        { name: 'Subject / Learning Area', required: true },
        { name: 'Term Mark (%)', required: true },
        { name: 'Achievement Level (1–7)', required: true },
        { name: 'Teacher Initial', required: false },
      ],
    },
    {
      name: 'Official DBE Achievement Scale (Grades 1–12)',
      order: 3,
      required: true,
      fields: [
        { name: 'Level 7: Outstanding Achievement (80%–100%)', required: true },
        { name: 'Level 6: Meritorious Achievement (70%–79%)', required: true },
        { name: 'Level 5: Substantial Achievement (60%–69%)', required: true },
        { name: 'Level 4: Adequate Achievement (50%–59%)', required: true },
        { name: 'Level 3: Moderate Achievement (40%–49%)', required: true },
        { name: 'Level 2: Elementary Achievement (30%–39%)', required: true },
        { name: 'Level 1: Not Achieved (0%–29%)', required: true },
      ],
    },
    {
      name: 'Behavioural & Personal Development',
      order: 4,
      required: true,
      fields: [
        { name: 'Classroom Behaviour & Discipline', required: true },
        { name: 'Effort and Diligence', required: true },
        { name: 'Social Skills & Peer Relations', required: true },
        { name: 'Neatness of Work & Uniform', required: true },
        { name: 'Participation in Extra-Murals', required: true },
      ],
    },
    {
      name: 'Official Comments & Sign-Off',
      order: 5,
      required: true,
      fields: [
        { name: "Class Teacher's Comments", required: true },
        { name: 'Teacher Signature and Date', required: true },
        { name: "School Principal's Comments", required: false },
        { name: 'Principal Signature and Date', required: true },
        { name: 'Parent / Guardian Acknowledgement', required: false },
        { name: 'Parent Signature and Date', required: true },
      ],
    },
  ],
};
