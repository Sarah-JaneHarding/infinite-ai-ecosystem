// ATP (Annual Teaching Plan) contract — Stage 08 step 2.
//
// CE-01's output is FrameworkResult (curriculum/framework.ts). CE-02's input and output
// shapes live here alongside the input contract for CE-01, because they all belong to the
// same curriculum-mapping domain and depend on the same SourceRef / GradeLabel types.
//
// The "empty vessel" principle from framework.ts applies here too: no real ATP values are
// stored in this file. The structures are the mechanism; the content arrives when the ATP
// source documents are ratified into L0.

import { z } from 'zod';

import { GradeLabel, SourceRef } from './framework.js';

// ---------------------------------------------------------------------------
// CE-01 input
// ---------------------------------------------------------------------------

/**
 * What CE-01 (CAPS Mapper) receives from its caller.
 *
 * `tenantId` is required because CE-01 retrieves CAPS subject statements from L0, and L0
 * is tenant-scoped — the agent must know which tenant's constitution to read from.
 */
export const CE01Input = z.object({
  grade: GradeLabel,
  /** The subjects to map. One or more — a caller requesting zero subjects has nothing to
   * do, so the schema refuses rather than returning an empty framework. */
  subjects: z.array(z.string().min(1)).min(1),
  tenantId: z.string().uuid(),
});
export type CE01Input = z.infer<typeof CE01Input>;

// ---------------------------------------------------------------------------
// ATP schedule (CE-02 output)
// ---------------------------------------------------------------------------

/** The character of a given school week. Teaching weeks carry topics; all other kinds
 * carry an empty `entries` array — the schedule exists, but the week is not instructional
 * time. */
export const WeekKind = z.enum(['teaching', 'holiday', 'exam', 'revision', 'assessment']);
export type WeekKind = z.infer<typeof WeekKind>;

/** One subject's scheduled content for a given teaching week. */
export const ATPTopicEntry = z.object({
  subjectName: z.string().min(1),
  /** A content area name, matching the content area in the `GradeFramework`. */
  contentArea: z.string().min(1),
  /** Individual topic names drawn from the content area, in the order the ATP sequences them. */
  topics: z.array(z.string().min(1)).min(1),
  /** The ATP document clause that authorises this week's pacing for this subject. */
  source: SourceRef,
});
export type ATPTopicEntry = z.infer<typeof ATPTopicEntry>;

/**
 * One week of the academic year in the sequenced plan.
 *
 * `deviationReason` is nullable but not optional — a missing field would let a deviation
 * slip through unchecked; an explicit null means "this week follows the ATP as published."
 */
export const ATPWeek = z.object({
  /** 1-based position within the academic year. Consecutive, no gaps. */
  weekNumber: z.number().int().positive(),
  /** Which of the four South African school terms this week falls in. */
  termNumber: z.number().int().min(1).max(4),
  kind: WeekKind,
  /** Topics scheduled this week. Always empty for non-teaching weeks. */
  entries: z.array(ATPTopicEntry),
  /** Null when the week follows the ATP's own pacing exactly. A stored reason is required
   * for any deviation — the coverage auditor (CE-09) surfaces deviations without one as
   * drift violations. */
  deviationReason: z.string().nullable(),
});
export type ATPWeek = z.infer<typeof ATPWeek>;

/**
 * The complete week-by-week schedule for a grade's subjects in one academic year.
 *
 * `ratifiedAt` is nullable for the same reason `GradeFramework.ratifiedAt` is: a human
 * must ratify the schedule before it may be published, and that ratification happens
 * outside this agent. CE-02 always produces `ratifiedAt: null`.
 */
export const ATPSchedule = z.object({
  grade: GradeLabel,
  academicYear: z.number().int().min(2000),
  /** Every ATP document this schedule was derived from, for the provenance chain. */
  sourceDocuments: z.array(SourceRef).min(1),
  /** Every week of the academic year, 1-based, in ascending order. */
  weeks: z.array(ATPWeek).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type ATPSchedule = z.infer<typeof ATPSchedule>;

/** What CE-02 returns when a required document is absent. Mirrors `FrameworkNeedsInput`
 * so the caller of either CE-01 or CE-02 sees the same shape on a missing-document path. */
export const ATPNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  missing: z
    .array(
      z.object({
        documentKind: z.enum(['ATP', 'SCHOOL_CALENDAR', 'CAPS_SUBJECT_STATEMENT']),
        subjectName: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type ATPNeedsInput = z.infer<typeof ATPNeedsInput>;

export const ATPResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), schedule: ATPSchedule }),
  ATPNeedsInput,
]);
export type ATPResult = z.infer<typeof ATPResult>;

// ---------------------------------------------------------------------------
// CE-02 input
// ---------------------------------------------------------------------------

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/** A school's own dated block that overrides or supplements the DBE calendar. */
export const SchoolCalendarBlock = z.object({
  kind: WeekKind,
  /** ISO 8601 date of the first day of this block (Monday, conventionally). */
  startDate: z.string().regex(YYYY_MM_DD, 'startDate must be a YYYY-MM-DD string'),
  /** ISO 8601 date of the last day of this block. */
  endDate: z.string().regex(YYYY_MM_DD, 'endDate must be a YYYY-MM-DD string'),
  /** Human-readable label, e.g. "Term 2 break". */
  label: z.string().optional(),
});
export type SchoolCalendarBlock = z.infer<typeof SchoolCalendarBlock>;

/**
 * What CE-02 (ATP Sequencer) receives from its caller.
 *
 * CE-02 retrieves the `GradeFramework` (CE-01's stored output) and the ATP source document
 * from L0 itself — neither arrives in `input`. The caller supplies the structural
 * parameters: which grade, which subjects, which year, and any school-specific calendar
 * overrides.
 */
export const CE02Input = z.object({
  grade: GradeLabel,
  subjects: z.array(z.string().min(1)).min(1),
  /** The academic year to sequence for, e.g. 2026. */
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
  /** School-specific calendar blocks. When present, they override the DBE calendar for
   * matching weeks. When absent, the ATP document's own calendar is used unchanged. */
  schoolCalendar: z.array(SchoolCalendarBlock).optional(),
});
export type CE02Input = z.infer<typeof CE02Input>;
