// The nine named scorers — Stage 07 step 2.
//
// "Implement scorers: exact match, JSON-schema conformance, numeric tolerance, set overlap
// (for topic and code alignment), readability band, template fidelity, citation presence
// and validity, refusal correctness, and an LLM-as-judge scorer..." One function per
// scorer, plus `scoreExpectation`, the dispatcher `runCase` (step 3) will actually call —
// each takes the case's own `Expectation` and the agent's real `output`, and returns a
// `ScoreResult`, never throws for the ordinary case, the same "a decision, never an
// exception" shape `packages/guardrails`'s own `GuardrailVerdict` already holds to.
//
// Three scorers reuse `packages/guardrails` directly rather than reimplementing: readability
// (`scoreReadability`, the exact Flesch-Kincaid formula the output-checks engine already
// scores against), citation presence-and-validity (`checkGrounding`, the same
// dangling-citation check), and refusal correctness (`checkRefusalPolicy`, the same shape
// check for a claimed refusal). Duplicating any of the three here would let this package's
// notion of "valid" drift from what actually runs at guardrail time — the two are supposed
// to agree, so they share the one implementation.
//
// `llm_judge` is the one scorer this file does not fully build. "Calibrated against at
// least 50 human-labelled cases, and re-calibrated whenever its own model changes" (the
// manual's own text) is a real dataset and a real calibration workflow this sandbox has
// neither — inventing either would be exactly the kind of unsourced process rule §0.3
// forbids. What this file does build is the mechanism: `LlmJudge`, an injected async
// function through which a real caller wires an actual Model Gateway call (rule 3: no
// second path to a provider) once one exists. See `docs/OPEN_QUESTIONS.md` OQ-016.

import {
  checkGrounding,
  checkRefusalPolicy,
  scoreReadability,
  type GuardrailVerdict,
} from '@infinite-ai/guardrails';

import type { Expectation } from './case.js';

export interface ScoreResult {
  readonly passed: boolean;
  /** A numeric score where the scorer has a natural one (the overlap fraction, the LLM
   * judge's own rubric score); omitted for scorers that are inherently boolean. */
  readonly score?: number;
  readonly detail: string;
}

function pass(detail: string, score?: number): ScoreResult {
  return score === undefined ? { passed: true, detail } : { passed: true, detail, score };
}

function fail(detail: string, score?: number): ScoreResult {
  return score === undefined
    ? { passed: false, detail }
    : { passed: false, detail, score };
}

/** Reads a dot-path (`"a.b.c"`) out of `value`. Returns `undefined` for any segment that
 * does not resolve — a missing field is "nothing there," not a thrown error, the same way
 * every scorer below treats a structurally-wrong output as a failed score rather than a
 * crash. */
function getAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function scoreExactMatch(
  expectation: Extract<Expectation, { type: 'exact_match' }>,
  output: unknown,
): ScoreResult {
  const actual = getAtPath(output, expectation.field);
  const matches =
    JSON.stringify(actual) === JSON.stringify(expectation.value) && actual !== undefined;
  return matches
    ? pass(`"${expectation.field}" matches the expected value exactly.`)
    : fail(
        `"${expectation.field}" was ${JSON.stringify(actual)}, expected ` +
          `${JSON.stringify(expectation.value)}.`,
      );
}

export function scoreJsonSchema(
  expectation: Extract<Expectation, { type: 'json_schema' }>,
  output: unknown,
): ScoreResult {
  const result = expectation.schema.safeParse(output);
  return result.success
    ? pass('Output conforms to the declared schema.')
    : fail(`Output failed schema validation: ${result.error.message}`);
}

export function scoreNumericTolerance(
  expectation: Extract<Expectation, { type: 'numeric_tolerance' }>,
  output: unknown,
): ScoreResult {
  const actual = getAtPath(output, expectation.field);
  if (typeof actual !== 'number') {
    return fail(
      `"${expectation.field}" is not a number (got ${JSON.stringify(actual)}).`,
    );
  }
  const diff = Math.abs(actual - expectation.expected);
  return diff <= expectation.tolerance
    ? pass(
        `"${expectation.field}" = ${actual}, within tolerance of ${expectation.expected}.`,
      )
    : fail(
        `"${expectation.field}" = ${actual}, outside tolerance ${expectation.tolerance} of ` +
          `${expectation.expected} (diff ${diff}).`,
      );
}

/** "Set overlap (for topic and code alignment)." `field` must hold an array; overlap is
 * the fraction of `expectedSet` also present in that array (Jaccard against the expected
 * side only — a candidate set with extra, unexpected members is not itself penalised, the
 * same "did it cover what was expected" question the manual's own topic-alignment framing
 * asks). */
export function scoreSetOverlap(
  expectation: Extract<Expectation, { type: 'set_overlap' }>,
  output: unknown,
): ScoreResult {
  const actual = getAtPath(output, expectation.field);
  if (!Array.isArray(actual)) {
    return fail(
      `"${expectation.field}" is not an array (got ${JSON.stringify(actual)}).`,
      0,
    );
  }
  const actualSet = new Set(actual);
  const matched = expectation.expectedSet.filter((item) => actualSet.has(item));
  const overlap = matched.length / expectation.expectedSet.length;
  return overlap >= expectation.minOverlap
    ? pass(
        `${matched.length}/${expectation.expectedSet.length} expected items present ` +
          `(overlap ${overlap.toFixed(2)}).`,
        overlap,
      )
    : fail(
        `Only ${matched.length}/${expectation.expectedSet.length} expected items present ` +
          `(overlap ${overlap.toFixed(2)}, need >= ${expectation.minOverlap}).`,
        overlap,
      );
}

function verdictToResult(verdict: GuardrailVerdict, passDetail: string): ScoreResult {
  return verdict.passed ? pass(passDetail) : fail(verdict.refusal.explanation);
}

export function scoreReadabilityBand(
  expectation: Extract<Expectation, { type: 'readability_band' }>,
  output: unknown,
): ScoreResult {
  const text =
    expectation.field === undefined ? output : getAtPath(output, expectation.field);
  if (typeof text !== 'string') {
    const where = expectation.field ?? '(the output itself)';
    return fail(`"${where}" is not a string (got ${JSON.stringify(text)}).`);
  }
  const { gradeLevel } = scoreReadability(text);
  const inRange =
    gradeLevel >= expectation.minGrade && gradeLevel <= expectation.maxGrade;
  return inRange
    ? pass(`Grade level ${gradeLevel.toFixed(1)} is within the target band.`, gradeLevel)
    : fail(
        `Grade level ${gradeLevel.toFixed(1)} is outside ` +
          `[${expectation.minGrade}, ${expectation.maxGrade}].`,
        gradeLevel,
      );
}

/** No template is ratified yet (OQ-003, same as the guardrail engine's own
 * `checkTemplateFidelity`): with no `checker` supplied for this case's own `templateId`,
 * this scores as an inconclusive pass rather than refusing against a rule nobody wrote. */
export type TemplateFidelityCheckers = Readonly<
  Record<string, (output: unknown) => boolean>
>;

export function scoreTemplateFidelity(
  expectation: Extract<Expectation, { type: 'template_fidelity' }>,
  output: unknown,
  checkers?: TemplateFidelityCheckers,
): ScoreResult {
  const checker = checkers?.[expectation.templateId];
  if (checker === undefined) {
    return pass(
      `No checker registered for template "${expectation.templateId}" — skipped.`,
    );
  }
  return checker(output)
    ? pass(`Output matches template "${expectation.templateId}".`)
    : fail(`Output does not match template "${expectation.templateId}".`);
}

/** Presence AND validity, reusing `packages/guardrails`'s own `checkGrounding` for the
 * validity half so this package's notion of "grounded" never drifts from the guardrail
 * engine's. */
export function scoreCitationPresence(
  expectation: Extract<Expectation, { type: 'citation_presence' }>,
  output: unknown,
): ScoreResult {
  const cited = getAtPath(output, expectation.citedIdsField);
  if (!Array.isArray(cited) || !cited.every((id) => typeof id === 'string')) {
    return fail(
      `"${expectation.citedIdsField}" is not a string array (got ${JSON.stringify(cited)}).`,
    );
  }
  if (cited.length < expectation.minCitations) {
    return fail(
      `${cited.length} citation(s) present, fewer than the required ${expectation.minCitations}.`,
    );
  }
  const verdict = checkGrounding(cited, new Set(expectation.validIds));
  return verdictToResult(
    verdict,
    `${cited.length} citation(s) present, all resolve to a valid id.`,
  );
}

export function scoreRefusalCorrectness(
  expectation: Extract<Expectation, { type: 'refusal_correctness' }>,
  output: unknown,
): ScoreResult {
  const field = expectation.refusalField ?? 'refusal';
  const claimed = getAtPath(output, field) ?? null;

  const shapeVerdict = checkRefusalPolicy(claimed);
  if (!shapeVerdict.passed) {
    return fail(shapeVerdict.refusal.explanation);
  }

  const didRefuse = claimed !== null;
  if (didRefuse !== expectation.shouldRefuse) {
    return fail(
      expectation.shouldRefuse
        ? 'Expected a refusal, but the agent did not refuse.'
        : 'Expected no refusal, but the agent refused.',
    );
  }
  if (didRefuse && expectation.expectedReasonCode !== undefined) {
    const actualCode = (claimed as { code: string }).code;
    if (actualCode !== expectation.expectedReasonCode) {
      return fail(
        `Refused with code "${actualCode}", expected "${expectation.expectedReasonCode}".`,
      );
    }
  }
  return pass(didRefuse ? 'Refused correctly.' : 'Correctly did not refuse.');
}

/** Reads a real Model Gateway call (rule 3: no second path to a provider) and returns a
 * numeric score against `rubric` — the case's own top-level scoring guidance — plus a
 * rationale. Injected rather than built here: see this file's own header for why real
 * calibration data does not exist in this build yet. */
export type LlmJudge = (
  rubric: string,
  output: unknown,
  criterion: string | undefined,
) => Promise<{ readonly score: number; readonly rationale: string }>;

export async function scoreLlmJudge(
  expectation: Extract<Expectation, { type: 'llm_judge' }>,
  output: unknown,
  rubric: string | undefined,
  judge?: LlmJudge,
): Promise<ScoreResult> {
  if (rubric === undefined) {
    return fail('No rubric supplied on this case for the llm_judge expectation to read.');
  }
  if (judge === undefined) {
    return fail(
      'No LlmJudge implementation supplied — this scorer has no mechanism wired in.',
    );
  }
  const { score, rationale } = await judge(rubric, output, expectation.criterion);
  return score >= expectation.minScore ? pass(rationale, score) : fail(rationale, score);
}

export interface ScoreOptions {
  /** The llm_judge scorer's own instructions — a case's top-level `rubric`. */
  readonly rubric?: string;
  readonly judge?: LlmJudge;
  readonly templateFidelityCheckers?: TemplateFidelityCheckers;
}

/** Scores one `Expectation` against `output`, dispatching to the matching scorer above.
 * The one function `runCase` (step 3) actually calls, once per expectation on a case. */
export async function scoreExpectation(
  expectation: Expectation,
  output: unknown,
  options: ScoreOptions = {},
): Promise<ScoreResult> {
  switch (expectation.type) {
    case 'exact_match':
      return scoreExactMatch(expectation, output);
    case 'json_schema':
      return scoreJsonSchema(expectation, output);
    case 'numeric_tolerance':
      return scoreNumericTolerance(expectation, output);
    case 'set_overlap':
      return scoreSetOverlap(expectation, output);
    case 'readability_band':
      return scoreReadabilityBand(expectation, output);
    case 'template_fidelity':
      return scoreTemplateFidelity(expectation, output, options.templateFidelityCheckers);
    case 'citation_presence':
      return scoreCitationPresence(expectation, output);
    case 'refusal_correctness':
      return scoreRefusalCorrectness(expectation, output);
    case 'llm_judge':
      return scoreLlmJudge(expectation, output, options.rubric, options.judge);
  }
}
