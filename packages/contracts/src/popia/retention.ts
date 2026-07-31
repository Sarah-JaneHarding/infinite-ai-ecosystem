// The retention schedule's shape — Stage 03 step 8.
//
// POPIA §14(1) is short and demanding: personal information must not be retained any
// longer than is necessary for the purpose it was collected for, unless a law requires
// otherwise. For a South African school, "unless a law requires otherwise" is doing most
// of the work — admission registers, attendance registers and mark schedules all carry
// statutory retention periods set outside this system.
//
// **So this file defines the shape of a schedule and the arithmetic that evaluates it. It
// contains no periods.** Not one. The numbers are a legal determination for each school to
// make and ratify in its L0 constitution, and CLAUDE.md rule 11 is explicit that policy is
// not invented here. A plausible-looking default would be the worst outcome available: it
// would be wrong in a way nobody checks, and it would destroy records on a schedule no
// human ever agreed to.
//
// The consequence is deliberate and worth stating. A category with no ratified rule is
// never tombstoned automatically — it is reported as unscheduled, loudly and every run,
// until someone decides. Erring toward retention is itself a §14 exposure, which is why
// the gap is a reported finding rather than a silence. See OQ-007.

import { z } from 'zod';

import { DataCategory } from './purpose.js';

/**
 * The event a retention period is measured from.
 *
 * Anchoring matters more than the period does. "Five years" means nothing until you say
 * five years from what — and the difference between measuring from record creation and
 * from the learner leaving the school is, for a Grade R learner who stays to Grade 7,
 * about seven years of records.
 */
export const RetentionAnchor = z.enum([
  /** The row was written. Suits transient operational data. */
  'RECORD_CREATED',
  /** The academic year the record belongs to ended. Suits marks and attendance. */
  'ACADEMIC_YEAR_END',
  /** The learner left the school — transferred, graduated or withdrawn. */
  'SUBJECT_EXIT',
  /** The support case was formally closed. Suits SIAS intervention records. */
  'CASE_CLOSED',
]);
export type RetentionAnchor = z.infer<typeof RetentionAnchor>;

/**
 * One ratified rule: how long this category is kept, from when, and on whose authority.
 *
 * `authority` is required and is not decorative. It is the citation — an Act, a regulation,
 * a provincial circular, or a minuted governing-body resolution — that makes the period
 * defensible. A rule nobody can source is a rule that will be withdrawn under pressure at
 * precisely the wrong moment, so the schema refuses to hold one.
 */
export const RetentionRule = z.object({
  category: DataCategory,
  anchor: RetentionAnchor,
  /** Whole months from the anchor. Months rather than days: schedules are written that way. */
  retainMonths: z.number().int().positive(),
  /** The legal or governance source for this period. Free text, but never empty. */
  authority: z.string().min(10),
  /** When the governing body ratified it. */
  ratifiedAt: z.coerce.date(),
  ratifiedBy: z.string().min(1),
});
export type RetentionRule = z.infer<typeof RetentionRule>;

/**
 * A tenant's schedule. Incomplete by default, and honest about it.
 *
 * There is no "default rule" field and there will not be one. A catch-all would let a
 * school ratify one number and have it silently govern categories nobody considered —
 * which is how special personal information ends up on the same clock as a class list.
 */
export const RetentionSchedule = z.object({
  tenantId: z.string().uuid(),
  rules: z.array(RetentionRule).superRefine((rules, ctx) => {
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule.category)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Two rules for ${rule.category}. One category, one period.`,
        });
      }
      seen.add(rule.category);
    }
  }),
});
export type RetentionSchedule = z.infer<typeof RetentionSchedule>;

/** Categories with no ratified rule. Every one of these is an open §14 exposure. */
export function unscheduledCategories(
  schedule: RetentionSchedule,
): readonly DataCategory[] {
  const scheduled = new Set(schedule.rules.map((rule) => rule.category));
  return DataCategory.options.filter((category) => !scheduled.has(category));
}

export function ruleFor(
  schedule: RetentionSchedule,
  category: DataCategory,
): RetentionRule | undefined {
  return schedule.rules.find((rule) => rule.category === category);
}

/**
 * Adds whole months, clamping to the end of the target month.
 *
 * Written out rather than pulled in from a date library because the clamping behaviour is
 * the point: 31 January plus one month is 28 February, not 3 March. A record that expires
 * three days early is a record destroyed three days before anyone agreed it could be.
 */
export function addMonths(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const day = from.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTarget),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

/** A record the retention job is considering. */
export interface RetainableRecord {
  readonly subjectToken: string;
  readonly category: DataCategory;
  /** The date the anchor occurred, or null if it has not happened yet. */
  readonly anchoredAt: Date | null;
  readonly anchor: RetentionAnchor;
}

export type RetentionVerdict =
  | {
      readonly action: 'retain';
      readonly reason: 'within_period';
      readonly expiresAt: Date;
    }
  | { readonly action: 'retain'; readonly reason: 'anchor_not_reached' }
  | { readonly action: 'retain'; readonly reason: 'no_rule' }
  | { readonly action: 'retain'; readonly reason: 'anchor_mismatch' }
  | { readonly action: 'tombstone'; readonly expiredAt: Date };

/**
 * Decides what happens to one record at one moment.
 *
 * Every outcome except `tombstone` is a `retain`, and each carries the reason it was
 * retained. That asymmetry is deliberate: the destructive branch is reachable by exactly
 * one path — a ratified rule, whose anchor matches, whose period has elapsed — and every
 * uncertainty anywhere else lands on `retain`.
 */
export function evaluateRetention(
  schedule: RetentionSchedule,
  record: RetainableRecord,
  now: Date,
): RetentionVerdict {
  const rule = ruleFor(schedule, record.category);
  if (rule === undefined) return { action: 'retain', reason: 'no_rule' };
  // The rule was ratified against a particular anchor. A record anchored differently is
  // not covered by it, and quietly applying the period anyway would mean destroying data
  // on a clock the governing body did not approve.
  if (rule.anchor !== record.anchor)
    return { action: 'retain', reason: 'anchor_mismatch' };
  if (record.anchoredAt === null)
    return { action: 'retain', reason: 'anchor_not_reached' };

  const expiresAt = addMonths(record.anchoredAt, rule.retainMonths);
  // Strictly after: a record is kept through the whole of its final day.
  if (now.getTime() > expiresAt.getTime()) {
    return { action: 'tombstone', expiredAt: expiresAt };
  }
  return { action: 'retain', reason: 'within_period', expiresAt };
}
