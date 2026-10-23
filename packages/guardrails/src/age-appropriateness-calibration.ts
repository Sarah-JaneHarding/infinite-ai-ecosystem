// Runs the labelled set (age-appropriateness-labelled-set.ts) through an injected judge and
// reports how often it agrees with the labels. That is all it does. It sets no threshold and
// returns no pass/fail: what agreement is good enough is the school's decision (OQ-016), and a
// constant here would quietly make it ours.
//
// Two things keep the numbers honest:
//  * A judge that could not answer (`isNoVerdict`) is counted as "no verdict", never as a
//    rejection. Otherwise an outage would score as a correct catch on every violation case.
//  * The summary says whether every scored case was human-reviewed. If not, it is not
//    calibration evidence, and the summary says so in a field no caller can overlook.

import type { AgeAppropriatenessSourceEntry } from '@infinite-ai/contracts';

import { isNoVerdict } from './age-appropriateness-judge.js';
import type { LabelledCase } from './age-appropriateness-labelled-set.js';
import type { AgeAppropriatenessJudge } from './brain-age-appropriateness.js';

export interface CaseSelection {
  readonly selected: readonly LabelledCase[];
  readonly excluded: readonly { readonly id: string; readonly reason: string }[];
}

/** Which cases count. Default: only cases a person confirmed or relabelled. `disputed` is
 * never scored — the label is in doubt, so agreement with it means nothing. */
export function selectCases(
  cases: readonly LabelledCase[],
  options: { readonly includeUnreviewed?: boolean } = {},
): CaseSelection {
  const selected: LabelledCase[] = [];
  const excluded: { id: string; reason: string }[] = [];
  for (const c of cases) {
    if (c.review.status === 'disputed') {
      excluded.push({ id: c.id, reason: 'disputed' });
    } else if (c.review.status === 'unreviewed' && options.includeUnreviewed !== true) {
      excluded.push({ id: c.id, reason: 'unreviewed' });
    } else {
      selected.push(c);
    }
  }
  return { selected, excluded };
}

export interface CalibrationResult {
  readonly caseId: string;
  readonly kind: LabelledCase['kind'];
  readonly phase: LabelledCase['phase'];
  readonly reviewStatus: LabelledCase['review']['status'];
  readonly expectedAppropriate: boolean;
  /** `null` when the judge could not answer. */
  readonly actualAppropriate: boolean | null;
  readonly rationale: string;
}

/** Sequential on purpose: a calibration run is small, and one request at a time cannot trip a
 * provider rate limit and then be misread as a judge failure. The clauses handed over are
 * every clause of the case's phase — what production's phase-level `recall` supplies. */
export async function runCalibration(
  cases: readonly LabelledCase[],
  entries: readonly AgeAppropriatenessSourceEntry[],
  judge: AgeAppropriatenessJudge,
): Promise<CalibrationResult[]> {
  const results: CalibrationResult[] = [];
  for (const c of cases) {
    const clauses =
      c.clauseSet === 'empty' ? [] : entries.filter((e) => e.phase === c.phase);
    const verdict = await judge(clauses, c.output);
    results.push({
      caseId: c.id,
      kind: c.kind,
      phase: c.phase,
      reviewStatus: c.review.status,
      expectedAppropriate: c.expectedAppropriate,
      actualAppropriate: isNoVerdict(verdict) ? null : verdict.appropriate,
      rationale: verdict.rationale,
    });
  }
  return results;
}

export interface Agreement {
  readonly cases: number;
  readonly agreed: number;
  /** `agreed / cases`, or `null` when there are no cases — never 0 or 1 by default. */
  readonly rate: number | null;
}

export interface CalibrationSummary {
  /** True only when at least one case was scored and every one of them was confirmed or
   * relabelled by a person. When false this run is NOT calibration evidence. */
  readonly humanReviewedOnly: boolean;
  readonly scored: number;
  readonly noVerdict: number;
  /** Rows are what the label expected, columns what the judge said (verdicts only). */
  readonly confusion: {
    readonly expectedFalseJudgedFalse: number;
    readonly expectedFalseJudgedTrue: number;
    readonly expectedTrueJudgedFalse: number;
    readonly expectedTrueJudgedTrue: number;
  };
  /** Agreement among cases that got a verdict. */
  readonly overall: Agreement;
  /** Agreement with every no-verdict counted as a disagreement. */
  readonly overallCountingNoVerdict: Agreement;
  readonly byKind: Readonly<Record<string, Agreement>>;
  readonly byPhase: Readonly<Record<string, Agreement>>;
  readonly disagreements: readonly CalibrationResult[];
  readonly noVerdictCases: readonly CalibrationResult[];
}

function agreement(results: readonly CalibrationResult[]): Agreement {
  const agreed = results.filter(
    (r) => r.actualAppropriate === r.expectedAppropriate,
  ).length;
  return {
    cases: results.length,
    agreed,
    rate: results.length === 0 ? null : agreed / results.length,
  };
}

function groupAgreement(
  results: readonly CalibrationResult[],
  key: (r: CalibrationResult) => string,
): Record<string, Agreement> {
  const groups = new Map<string, CalibrationResult[]>();
  for (const r of results) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return Object.fromEntries([...groups].map(([k, v]) => [k, agreement(v)]));
}

export function summariseCalibration(
  results: readonly CalibrationResult[],
): CalibrationSummary {
  const verdicts = results.filter((r) => r.actualAppropriate !== null);
  const count = (expected: boolean, actual: boolean): number =>
    verdicts.filter(
      (r) => r.expectedAppropriate === expected && r.actualAppropriate === actual,
    ).length;
  return {
    humanReviewedOnly:
      results.length > 0 && results.every((r) => r.reviewStatus !== 'unreviewed'),
    scored: results.length,
    noVerdict: results.length - verdicts.length,
    confusion: {
      expectedFalseJudgedFalse: count(false, false),
      expectedFalseJudgedTrue: count(false, true),
      expectedTrueJudgedFalse: count(true, false),
      expectedTrueJudgedTrue: count(true, true),
    },
    overall: agreement(verdicts),
    overallCountingNoVerdict: agreement(results),
    byKind: groupAgreement(verdicts, (r) => r.kind),
    byPhase: groupAgreement(verdicts, (r) => r.phase),
    disagreements: verdicts.filter((r) => r.actualAppropriate !== r.expectedAppropriate),
    noVerdictCases: results.filter((r) => r.actualAppropriate === null),
  };
}
