// Estimated retention-period defaults for the demo/pilot release — Stage 17 onboarding.
//
// retention.ts's own header is explicit that this package never ships a retention
// period, because the real determination is a legal decision this codebase cannot make
// for a school (rule 11; OQ-007) — "a plausible-looking default would be the worst
// outcome available." This file does not change that. Nothing here is a fallback the
// arithmetic in retention.ts applies silently, and no `RetentionSchedule` exists until
// someone builds one. What this file is instead is a *starting template* — the same
// role `docs/RETENTION_SCHEDULE_TEMPLATE.md`'s blank form already plays, pre-filled with
// a reasonable estimate instead of a blank cell — presented during onboarding
// (`packages/provisioning`'s `ratify_retention_schedule` wizard step) for a real person
// at the school to accept or amend. Accepting it is what makes the resulting
// `RetentionRule` real: `ratifiedBy`/`ratifiedAt` capture who did that, for that one
// tenant, the same as ratifying any other L0 fact in this codebase — the numbers start
// as an estimate, but the ratification event is not simulated.
//
// Every estimate's `authority` text says plainly that it is an estimate, not a legal
// citation, so nothing downstream can mistake "an admin clicked accept during
// onboarding" for "the school's governing body researched and cited a real retention
// law." Both are real events; they are not the same event, and conflating them is
// exactly the failure `retention.ts`'s own header warns about. A school that wants the
// real thing still fills in `docs/RETENTION_SCHEDULE_TEMPLATE.md` for real and overrides
// these values — this file exists so a demo has something to show before that happens,
// not instead of it.

import type { DataCategory } from './purpose.js';
import { RetentionRule, RetentionSchedule, type RetentionAnchor } from './retention.js';

const DEMO_ESTIMATE_MARKER =
  "INFINITE-AI DEMO ESTIMATE — not a legal citation; confirm or replace with your own governing body's determination.";

export interface RetentionPeriodEstimate {
  readonly category: DataCategory;
  readonly anchor: RetentionAnchor;
  readonly retainMonths: number;
  /** Why this ballpark, shown next to the editable field in the onboarding step. */
  readonly rationale: string;
}

/**
 * One estimate per `DataCategory` — covers every category exactly once, the same
 * discipline `docs/RETENTION_SCHEDULE_TEMPLATE.md`'s own ten-row table already holds
 * itself to (asserted by this package's own test, not just by convention). Round
 * numbers, chosen for a demo/pilot release, not researched legal citations — see this
 * file's own header.
 */
export const DEMO_RETENTION_ESTIMATES: readonly RetentionPeriodEstimate[] = [
  {
    category: 'IDENTIFIER_TOKEN',
    anchor: 'RECORD_CREATED',
    retainMonths: 84,
    rationale:
      'Matches the direct-identifier estimate below — the token has no reason to outlive the identifier it stands in for.',
  },
  {
    category: 'DIRECT_IDENTIFIER',
    anchor: 'RECORD_CREATED',
    retainMonths: 84,
    rationale:
      '7 years — a common administrative-record ballpark, awaiting a school-specific citation.',
  },
  {
    category: 'ENROLMENT',
    anchor: 'ACADEMIC_YEAR_END',
    retainMonths: 84,
    rationale: '7 years from the academic year the enrolment record belongs to.',
  },
  {
    category: 'ACADEMIC_PERFORMANCE',
    anchor: 'ACADEMIC_YEAR_END',
    retainMonths: 84,
    rationale:
      '7 years — matches enrolment; marks and enrolment are usually reviewed together.',
  },
  {
    category: 'ATTENDANCE',
    anchor: 'ACADEMIC_YEAR_END',
    retainMonths: 36,
    rationale:
      '3 years — attendance is reviewed far more often than it is looked up historically.',
  },
  {
    category: 'BEHAVIOUR',
    anchor: 'CASE_CLOSED',
    retainMonths: 36,
    rationale:
      '3 years from the case closing (not from each incident), so a pattern across incidents stays visible while a case is open.',
  },
  {
    category: 'SUPPORT_NEED',
    anchor: 'CASE_CLOSED',
    retainMonths: 60,
    rationale:
      '5 years — SIAS-style support records often need continuity across a change of year or school, longer than a closed behaviour case.',
  },
  {
    category: 'SPECIAL_PERSONAL',
    anchor: 'CASE_CLOSED',
    retainMonths: 60,
    rationale:
      'Same as support need, since it is usually the same underlying case — POPIA §26 sensitivity argues for a school shortening this on review, not lengthening it.',
  },
  {
    category: 'FAMILY_CONTEXT',
    anchor: 'SUBJECT_EXIT',
    retainMonths: 24,
    rationale:
      '2 years after the learner leaves — the shortest estimate here, since this category carries no academic or statutory record-keeping argument for a longer one.',
  },
  {
    category: 'STAFF_PRACTICE',
    anchor: 'RECORD_CREATED',
    retainMonths: 36,
    rationale:
      "3 years — developmental-only data (see this category's own description in purpose.ts), not a permanent record.",
  },
];

/** One estimate's `RetentionRule`-shaped override fields, for a school that wants to
 * adjust a category during onboarding without typing out a full rule. */
export type RetentionEstimateOverride = Partial<
  Pick<RetentionRule, 'anchor' | 'retainMonths' | 'authority'>
>;

/**
 * Builds a real, schema-valid `RetentionSchedule` from the demo estimates — one
 * `RetentionRule` per category, `ratifiedBy`/`ratifiedAt` set to the actual person and
 * moment that accepted it during onboarding (never invented, never backdated). A school
 * may override any category's anchor, period, or authority before accepting; anything
 * not overridden keeps the estimate and its own `authority` text says so.
 *
 * Parses (not merely asserts) the result against `RetentionRule`/`RetentionSchedule`
 * before returning it — the same "unknown plus a Zod parse" discipline (rule 8) every
 * other write path in this codebase already holds to, so a bad override fails loudly
 * here rather than reaching the database.
 */
export function buildDemoRetentionSchedule(
  tenantId: string,
  ratifiedBy: string,
  now: Date,
  overrides: Partial<Record<DataCategory, RetentionEstimateOverride>> = {},
): RetentionSchedule {
  const rules = DEMO_RETENTION_ESTIMATES.map((estimate) => {
    const override = overrides[estimate.category];
    return RetentionRule.parse({
      category: estimate.category,
      anchor: override?.anchor ?? estimate.anchor,
      retainMonths: override?.retainMonths ?? estimate.retainMonths,
      authority: override?.authority ?? `${DEMO_ESTIMATE_MARKER} ${estimate.rationale}`,
      ratifiedAt: now,
      ratifiedBy,
    });
  });
  return RetentionSchedule.parse({ tenantId, rules });
}
