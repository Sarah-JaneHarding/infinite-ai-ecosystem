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

// ---------------------------------------------------------------------------
// Reviewing a schedule a school has filled in
// ---------------------------------------------------------------------------

/**
 * Text that shows the Authority column was never actually filled in.
 *
 * A form gets circulated, and somewhere between the draft and the signature a placeholder
 * survives. The schema only requires ten characters, which `TBC — to follow` satisfies
 * comfortably. This is the check that catches the row nobody came back to.
 */
const PLACEHOLDER_AUTHORITY =
  /^\W*$|\b(tbc|tba|todo|xxx|placeholder|pending|n\/?a)\b|\bto (be (advised|confirmed|determined|decided)|follow)\b|_{3,}/i;

export interface ScheduleFinding {
  readonly category: DataCategory;
  readonly problem: 'placeholder_authority';
  readonly detail: string;
}

export type ScheduleReview =
  | { readonly valid: false; readonly issues: readonly string[] }
  | {
      readonly valid: true;
      readonly schedule: RetentionSchedule;
      /** Categories carrying a ratified rule. */
      readonly scheduled: readonly DataCategory[];
      /** Categories with no rule. Never tombstoned; reported on every run. */
      readonly unscheduled: readonly DataCategory[];
      /** Rules that parsed but should not be trusted. */
      readonly findings: readonly ScheduleFinding[];
    };

/**
 * Checks a schedule a school has filled in, before it reaches the database.
 *
 * Returns findings rather than throwing on the soft problems, because "you have nine
 * unscheduled categories" is information rather than an error — an incomplete schedule is a
 * legitimate and safe state, and refusing to load one would push a school toward inventing
 * numbers to make the tool stop complaining. That is the exact failure this whole design
 * exists to avoid.
 *
 * A placeholder authority is a finding rather than a hard failure for the same reason, but
 * `pnpm check:retention` exits non-zero on one: a rule that will delete records on an
 * authority of "TBC" should not reach production quietly.
 */
export function reviewSchedule(candidate: unknown): ScheduleReview {
  const parsed = RetentionSchedule.safeParse(candidate);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    };
  }

  const schedule = parsed.data;
  const findings: ScheduleFinding[] = [];
  for (const rule of schedule.rules) {
    if (PLACEHOLDER_AUTHORITY.test(rule.authority)) {
      findings.push({
        category: rule.category,
        problem: 'placeholder_authority',
        detail: `Authority reads "${rule.authority}", which looks like a placeholder rather than a source.`,
      });
    }
  }

  return {
    valid: true,
    schedule,
    scheduled: schedule.rules.map((rule) => rule.category),
    unscheduled: unscheduledCategories(schedule),
    findings,
  };
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
