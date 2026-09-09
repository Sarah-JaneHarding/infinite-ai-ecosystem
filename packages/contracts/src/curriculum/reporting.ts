// Teacher-facing Parent Progress Report document types — Stage 08 / MOD-01.
//
// These types represent the teacher-completed DBE Parent Progress Report template
// (PARENT_PROGRESS_REPORT). The AI agents do not fill this form; teachers do.
// The schema enforces the DBE Achievement Scale constraints and prevents incomplete
// or tenant-less records reaching L3.

import { z } from 'zod';

import { GradeLabel } from './framework.js';

// ---------------------------------------------------------------------------
// Parent Progress Report (DBE Parent Progress Report template)
// ---------------------------------------------------------------------------

// DBE four-point behaviour rating scale: Excellent / Good / Satisfactory / Needs Improvement.
export const BehaviourRating = z.enum(['E', 'G', 'S', 'NI']);
export type BehaviourRating = z.infer<typeof BehaviourRating>;

export const BehaviourRow = z.object({
  criterion: z.string().min(1),
  rating: BehaviourRating,
});
export type BehaviourRow = z.infer<typeof BehaviourRow>;

// One row of the Academic Performance Dashboard — marks must be in range, achievement
// level must be on the DBE 1–7 scale.
export const PerformanceRow = z.object({
  subject: z.string().min(1),
  termMarkPercent: z.number().min(0).max(100),
  achievementLevel: z.number().int().min(1).max(7),
  teacherInitial: z.string().nullable(),
});
export type PerformanceRow = z.infer<typeof PerformanceRow>;

export const ParentProgressReport = z.object({
  tenantId: z.string().uuid(),
  surname: z.string().min(1),
  firstNames: z.string().min(1),
  gradeSection: GradeLabel,
  saSamsLearnerId: z.string().min(1),
  academicYear: z.number().int().min(2000).max(2100),
  reportingPeriod: z.string().min(1),
  daysPossible: z.number().int().positive(),
  daysAbsent: z.number().int().min(0),
  lateArrivals: z.number().int().min(0),
  performanceRows: z.array(PerformanceRow).min(1),
  behaviourRows: z.array(BehaviourRow).min(1),
  classTeacherComments: z.string().min(1),
  teacherSignatureDate: z.string().nullable(),
  principalComments: z.string().nullable(),
  principalSignatureDate: z.string().nullable(),
  parentAcknowledgement: z.string().nullable(),
  parentSignatureDate: z.string().nullable(),
  templateId: z.string().min(1),
});
export type ParentProgressReport = z.infer<typeof ParentProgressReport>;
