// CE-09 Coverage Auditor contract types — Stage 08 step 5.
//
// CE-09 is a scheduled agent that reads L2 episode records (actual lessons delivered)
// against the ratified term plan (CE-03 output) and produces a drift report identifying:
//   - Topics planned but not yet taught
//   - Topics taught that were not in the plan (unplanned deviations)
//   - Topics planned but not yet assessed
//   - Topics assessed that have no corresponding plan entry
//
// A CoverageAudit is a read-only diagnostic — it writes to the Brain as a new record
// but never modifies term plans, unit blueprints or lesson plans. The agent produces
// needs_input when the term plan is not ratified or no episode log exists for the term.

import { z } from 'zod';

import { GradeLabel, SourceRef } from './framework.js';

// ---------------------------------------------------------------------------
// CE-09 Coverage Auditor
// ---------------------------------------------------------------------------

export const CE09Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
});
export type CE09Input = z.infer<typeof CE09Input>;

export const DriftKind = z.enum([
  'planned_not_taught',
  'taught_not_planned',
  'planned_not_assessed',
  'assessed_not_planned',
]);
export type DriftKind = z.infer<typeof DriftKind>;

export const DriftItem = z.object({
  topicId: z.string().min(1),
  topicDescription: z.string().min(1),
  kind: DriftKind,
  /** ATP week number the plan entry falls in, or null when the drift is not week-scoped. */
  weekNumber: z.number().int().positive().nullable(),
  detail: z.string().min(1),
});
export type DriftItem = z.infer<typeof DriftItem>;

export const CoverageAudit = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000),
  /** Percentage of planned topics that appear in both the episode log and an assessment
   * record. Range 0–100. */
  coverageRatePct: z.number().min(0).max(100),
  /** All drift items found. Empty array when coverage is perfect. */
  driftItems: z.array(DriftItem),
  sourceDocuments: z.array(SourceRef).min(1),
  auditedAt: z.string().datetime(),
});
export type CoverageAudit = z.infer<typeof CoverageAudit>;

export const CoverageAuditNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  missing: z
    .array(
      z.object({
        documentKind: z.enum(['TERM_PLAN', 'L2_EPISODE_LOG']),
        detail: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type CoverageAuditNeedsInput = z.infer<typeof CoverageAuditNeedsInput>;

export const CoverageAuditResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), audit: CoverageAudit }),
  CoverageAuditNeedsInput,
]);
export type CoverageAuditResult = z.infer<typeof CoverageAuditResult>;
