// The labelled set for calibrating the age-appropriateness judge (OQ-015 / OQ-016).
//
// What this is: a schema, and a consistency check, for cases whose expected verdict is
// traceable to a specific ratified clause. What this is NOT: human labels. Every case in
// `calibration/age-appropriateness/cases.json` is `labelledBy: 'constructed'` — written
// from the clause text by an assistant — and starts `unreviewed`. OQ-016 asks for human
// labels; a constructed case only becomes evidence once a person has read it and recorded
// that they agree (`review.status: 'confirmed'`). Scoring is deliberately absent here: the
// agreement threshold is a decision for the school, not a constant in this file.

import { z } from 'zod';

import { ageAppropriatenessKeyFor as keyFor } from '@infinite-ai/brain';
import type { AgeAppropriatenessSourceEntry } from '@infinite-ai/contracts';

export const LabelledPhase = z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR']);

/** `violation`/`conformant` are a twin pair for one clause; `control` checks the judge's
 * contract (uncovered concern, empty clauses, empty output) and cites no clause. */
export const LabelledKind = z.enum(['violation', 'conformant', 'control']);

export const LabelledReview = z
  .object({
    status: z.enum(['unreviewed', 'confirmed', 'relabelled', 'disputed']),
    reviewer: z.string().min(1).nullable(),
    reviewedOn: z.string().date().nullable(),
    note: z.string().min(1).nullable(),
  })
  .refine((r) => (r.status === 'unreviewed') === (r.reviewer === null), {
    message: 'reviewer is set exactly when the case has been reviewed',
  });

export const LabelledCase = z
  .object({
    id: z.string().min(1),
    kind: LabelledKind,
    phase: LabelledPhase,
    grade: z.string().min(1),
    subject: z.string().min(1),
    /** `phase`: the judge receives every clause of the phase, as in production
     * (`recall` is phase-level). `empty`: it receives none. */
    clauseSet: z.enum(['phase', 'empty']),
    /** The text handed to the judge as `output`. May be empty for the empty-output control. */
    output: z.string(),
    expectedAppropriate: z.boolean(),
    drivingClauses: z.array(z.string().regex(/^age-appropriateness-\d{3}$/)),
    /** Why the label is what it is, citing the clause wording — what a reviewer checks. */
    construction: z.string().min(1),
    labelledBy: z.literal('constructed'),
    review: LabelledReview,
  })
  .superRefine((c, ctx) => {
    const expected = {
      violation: false,
      conformant: true,
      control: c.expectedAppropriate,
    }[c.kind];
    // A reviewer who disagrees with the construction records it by relabelling; that is the
    // one way a violation may expect a pass (or a conformant case a fail).
    if (c.review.status !== 'relabelled' && c.expectedAppropriate !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `${c.kind} must expect ${String(expected)}`,
      });
    }
    if ((c.kind === 'control') !== (c.drivingClauses.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'controls cite no clause; the others cite one',
      });
    }
    if (c.clauseSet === 'empty' && c.kind !== 'control') {
      ctx.addIssue({ code: 'custom', message: 'only controls may withhold the clauses' });
    }
  });
export type LabelledCase = z.infer<typeof LabelledCase>;

/** Which clauses the set exercises, and which it cannot. Anything in none of the three
 * lists is simply not yet classified — not "descriptive"; no one has said so. */
export const LabelledCoverage = z.object({
  tested: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  ambiguous: z.array(z.object({ clause: z.string(), reason: z.string().min(1) })),
  conflicting: z.array(
    z.object({ clauses: z.array(z.string()).min(2), reason: z.string().min(1) }),
  ),
});
export type LabelledCoverage = z.infer<typeof LabelledCoverage>;

/** Every way the set disagrees with itself or with the ratified source. Empty = consistent. */
export function checkLabelledSet(
  cases: readonly LabelledCase[],
  coverage: LabelledCoverage,
  entries: readonly AgeAppropriatenessSourceEntry[],
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const byId = new Map(cases.map((c) => [c.id, c]));
  const clauseIds = new Map(entries.map((e, i) => [keyFor(i), e]));

  for (const c of cases) {
    if (ids.has(c.id)) problems.push(`${c.id}: duplicate case id`);
    ids.add(c.id);
    for (const key of c.drivingClauses) {
      const clause = clauseIds.get(key);
      if (clause === undefined) {
        problems.push(`${c.id}: cites ${key}, which is not a ratified clause`);
      } else if (clause.phase !== c.phase) {
        problems.push(
          `${c.id}: cites ${key} of phase ${clause.phase}, case is ${c.phase}`,
        );
      }
    }
  }

  for (const [key, caseIds] of Object.entries(coverage.tested)) {
    if (!clauseIds.has(key)) problems.push(`coverage: ${key} is not a ratified clause`);
    const kinds = new Set<string>();
    for (const id of caseIds) {
      const c = byId.get(id);
      if (c === undefined) problems.push(`coverage: ${key} lists unknown case ${id}`);
      else if (!c.drivingClauses.includes(key))
        problems.push(`coverage: ${id} does not cite ${key}`);
      else kinds.add(c.kind);
    }
    if (!kinds.has('violation') || !kinds.has('conformant')) {
      problems.push(`coverage: ${key} needs both a violation and a conformant case`);
    }
  }
  for (const c of cases) {
    for (const key of c.drivingClauses) {
      if (!coverage.tested[key]?.includes(c.id)) {
        problems.push(`${c.id}: cites ${key} but coverage does not list it`);
      }
    }
  }

  const flagged = [
    ...coverage.ambiguous.map((a) => a.clause),
    ...coverage.conflicting.flatMap((x) => x.clauses),
  ];
  for (const key of flagged) {
    if (!clauseIds.has(key))
      problems.push(`coverage: flagged ${key} is not a ratified clause`);
    if (key in coverage.tested)
      problems.push(`coverage: ${key} is both tested and flagged`);
  }
  return problems;
}
