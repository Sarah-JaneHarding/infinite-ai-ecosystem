// The permanent safety set — Stage 07 step 7.
//
// "Add safety evals as a permanent set, run on every change regardless of what changed:
// PII egress, prompt injection, diagnosis-refusal, age-appropriateness, safeguarding
// escalation, cross-tenant leakage." Six categories, none of them this file's content to
// invent: what actually constitutes an unsafe response in each category is a safeguarding,
// clinical-scope and content-policy question this codebase has no ratified source for
// (the exact same reasoning `docs/OPEN_QUESTIONS.md` OQ-014/OQ-015 already give for why
// the guardrail engine's own age-appropriateness and escalation checks take an injected
// checker rather than a built-in rule). `buildSafetyCase` is the one thing this file does
// build for real: a validated constructor that tags a case correctly, so every safety case
// in the tree is reliably findable by tag regardless of who wrote its actual payload and
// expectations — and `selectCasesToRun` is what makes "run on every change regardless of
// what changed" true in the CI gate (step 5): a safety-tagged case is never excluded by
// the affected-files classification, only ever added to it.

import {
  SAFETY_TAGS,
  validateEvalCase,
  type EvalCase,
  type Expectation,
  type SafetyTag,
} from './case.js';

export interface SafetyCaseInput {
  readonly id: string;
  readonly agentId: string;
  readonly input: unknown;
  readonly context: unknown;
  readonly expectations: readonly Expectation[];
  readonly rubric?: string;
  /** Tags beyond the safety category itself, e.g. grouping this case into a module's own
   * broader regression set as well. */
  readonly extraTags?: readonly string[];
}

/** Builds one case in the permanent safety set, tagged with `category` (and validated the
 * same way every other case is) so `selectCasesToRun` can always find it. `source` is
 * always `'specification'`: a ratified safety case comes from the safeguarding policy that
 * named the category, never from a correction — see `docs/OPEN_QUESTIONS.md` OQ-014/
 * OQ-015 for what that policy source still needs to be. */
export function buildSafetyCase(category: SafetyTag, params: SafetyCaseInput): EvalCase {
  return validateEvalCase({
    id: params.id,
    agentId: params.agentId,
    input: params.input,
    context: params.context,
    expectations: params.expectations,
    ...(params.rubric !== undefined && { rubric: params.rubric }),
    tags: [category, ...(params.extraTags ?? [])],
    source: 'specification',
  });
}

export function isSafetyCase(evalCase: EvalCase): boolean {
  return evalCase.tags.some((tag) => (SAFETY_TAGS as readonly string[]).includes(tag));
}

export function selectSafetyCases(cases: readonly EvalCase[]): readonly EvalCase[] {
  return cases.filter(isSafetyCase);
}

/**
 * The actual "run on every change regardless of what changed" selection: every case
 * belonging to an agent the change already affects (per `affectedAgentIds`, step 5),
 * *plus* every safety-tagged case regardless of its own agent — a safety case never needs
 * to be named by `affected` to be included, and is never excluded because it wasn't.
 * `affected === 'all'` already means every case runs; this only changes behaviour for a
 * specific, narrower `affected` list.
 */
export function selectCasesToRun(
  allCases: readonly EvalCase[],
  affected: 'all' | readonly string[],
): readonly EvalCase[] {
  if (affected === 'all') return allCases;
  const affectedSet = new Set(affected);
  return allCases.filter(
    (evalCase) => affectedSet.has(evalCase.agentId) || isSafetyCase(evalCase),
  );
}
