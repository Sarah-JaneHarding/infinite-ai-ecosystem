// EGRA screening — comparison of entered scores against benchmarks the SCHOOL supplies.
//
// OQ-035 (decided 2026-11-05, Sarah-Jane Harding): this app ships no benchmark numbers and
// recommends no tier. EGRA has no single fixed cut-score; the school (or DBE guidance) owns
// the benchmark, and the SBST person assigns the tier through the SIAS process. Nothing in
// this file may add a default benchmark or turn a count of flags into a tier. A test
// (`egra-screening.spec.ts`) guards both.
//
// The one rule that matters most: a score that was not entered is never read as reassurance. Blank,
// partial and invalid input is reported as exactly that.

export interface Subtest {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  /** Hard ceiling only where the unit makes it a fact (a percentage cannot exceed 100). */
  readonly ceiling: number | null;
}

// Labels and units are carried over from the earlier view. They are NOT yet checked against
// the EGRA MTSS Data System reference (which uses different subtests); that is OQ-035's
// remaining open part. No numeric threshold lives here.
export const SUBTESTS: readonly Subtest[] = [
  { id: 'LSI', label: 'Letter Sound Identification', unit: 'correct/min', ceiling: null },
  { id: 'PA', label: 'Phonological Awareness', unit: '% correct', ceiling: 100 },
  {
    id: 'NWF',
    label: 'Nonsense Word Fluency (Decoding)',
    unit: 'correct/min',
    ceiling: null,
  },
  { id: 'WR', label: 'Word Reading', unit: 'correct/min', ceiling: null },
  { id: 'ORF', label: 'Oral Reading Fluency', unit: 'WCPM', ceiling: null },
  { id: 'LC', label: 'Listening Comprehension', unit: '% correct', ceiling: 100 },
  { id: 'RC', label: 'Reading Comprehension', unit: '% correct', ceiling: 100 },
];

export type SubtestStatus =
  | 'not-entered'
  | 'invalid-score'
  | 'no-benchmark'
  | 'invalid-benchmark'
  | 'meets'
  | 'below';

export interface SubtestResult {
  readonly id: string;
  readonly status: SubtestStatus;
}

const DECIMAL = /^\d+(\.\d+)?$/;

/** Strict non-negative decimal. Blank, `1e3`, `-1`, `NaN`, `Infinity` and `0x10` are all null. */
export function parseNonNegative(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const isBlank = (raw: string | undefined): boolean =>
  raw === undefined || raw.trim() === '';

export function evaluateSubtest(
  subtest: Subtest,
  rawScore: string | undefined,
  rawBenchmark: string | undefined,
): SubtestResult {
  const result = (status: SubtestStatus): SubtestResult => ({ id: subtest.id, status });

  if (isBlank(rawScore)) return result('not-entered');

  const score = parseNonNegative(rawScore);
  if (score === null || (subtest.ceiling !== null && score > subtest.ceiling)) {
    return result('invalid-score');
  }

  if (isBlank(rawBenchmark)) return result('no-benchmark');
  const benchmark = parseNonNegative(rawBenchmark);
  if (benchmark === null || (subtest.ceiling !== null && benchmark > subtest.ceiling)) {
    return result('invalid-benchmark');
  }

  return result(score < benchmark ? 'below' : 'meets');
}

export function evaluateAll(
  scores: Readonly<Record<string, string | undefined>>,
  benchmarks: Readonly<Record<string, string | undefined>>,
): readonly SubtestResult[] {
  return SUBTESTS.map((s) => evaluateSubtest(s, scores[s.id], benchmarks[s.id]));
}

export const STATUS_TEXT: Readonly<Record<SubtestStatus, string>> = {
  'not-entered': 'Not entered — no result',
  'invalid-score': 'Score is not valid — no result',
  'no-benchmark': 'No benchmark entered — cannot compare',
  'invalid-benchmark': 'Benchmark is not valid — cannot compare',
  meets: 'Meets the benchmark you entered',
  below: 'Below the benchmark you entered',
};
