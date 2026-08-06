// The golden-set growth loop — Stage 07 step 6.
//
// "Every human rejection or material edit in a HITL gate becomes a candidate eval case,
// de-identified, reviewed, then added with source: correction." Three steps, built as two
// functions with a real human in between: `buildCorrectionCandidate` turns a rejected or
// edited `human_gate` decision (Stage 06 step 5's own `HumanGateDecisionInput` outcome)
// into a `CorrectionCandidate` — de-identified, but with no `expectations` yet, because
// what the case should actually assert is exactly the judgment call "reviewed" names: this
// file has no way to know, from a rejection or an edit diff alone, which of the nine
// scorers should check it or with what parameters, and guessing would misrepresent a
// human's own review as this pipeline's automated output. `acceptCorrectionCandidate` is
// the "reviewed, then added" half — a human supplies real `expectations`, and only then
// does a candidate become a real, validated `EvalCase` with `source: 'correction'`.
//
// De-identification is injected (`deidentify`), the same "mechanism now, real wiring once
// the source exists" shape this build uses throughout: `packages/deident`'s own `scrub`
// needs a tenant lexicon and a live tenant context this pure function does not have and
// should not reach for itself (`packages/evals` has no dependency on `packages/db`) — a
// real caller, inside a tenant transaction, is what wires a real de-identifying function
// in.

import type { EvalCase, EvalCaseSource, Expectation } from './case.js';
import { validateEvalCase } from './case.js';

export type HumanGateOutcome = 'REJECTED' | 'EDITED';

export interface CorrectionCandidateInput {
  readonly agentId: string;
  /** What the agent was actually given for the run that reached the gate. */
  readonly input: unknown;
  readonly context: unknown;
  readonly decision: HumanGateOutcome;
  /** The decision's own reason — Stage 06's own `HumanGateDecisionInput.reason`, required
   * for every outcome. */
  readonly reason: string;
  /** Present only for `decision: 'EDITED'` — the edit diff Stage 06's own approval task
   * already records. */
  readonly editDiff?: unknown;
}

/** A raw growth-loop candidate: de-identified, but not yet a real eval case — it has no
 * `expectations`, because deciding what this case should assert is the "reviewed" step's
 * own job, not this function's. `reviewed: false` always, at creation; there is no path
 * that produces one already marked reviewed, because nothing here has actually reviewed
 * anything. */
export interface CorrectionCandidate {
  readonly agentId: string;
  readonly input: unknown;
  readonly context: unknown;
  readonly decision: HumanGateOutcome;
  readonly reason: string;
  readonly editDiff: unknown | null;
  readonly reviewed: false;
}

/**
 * Builds a growth-loop candidate from one rejected or edited `human_gate` decision.
 * `deidentify` is applied to `input`/`context`/`editDiff` independently — a candidate that
 * is only partly de-identified is not de-identified, so every field that could carry a
 * learner's own words goes through the same function.
 */
export function buildCorrectionCandidate(
  decision: CorrectionCandidateInput,
  deidentify: (value: unknown) => unknown,
): CorrectionCandidate {
  return {
    agentId: decision.agentId,
    input: deidentify(decision.input),
    context: deidentify(decision.context),
    decision: decision.decision,
    reason: decision.reason,
    editDiff: decision.editDiff === undefined ? null : deidentify(decision.editDiff),
    reviewed: false,
  };
}

/**
 * The "reviewed, then added" step: a human has decided what this candidate should assert
 * — `expectations` — and this turns it into a real, validated `EvalCase`. `source` is
 * always `'correction'`: that is what distinguishes a case that entered the golden set
 * through this loop from one written from a specification or an incident, and nothing
 * about accepting a candidate changes which of those it was.
 */
export function acceptCorrectionCandidate(
  candidate: CorrectionCandidate,
  id: string,
  expectations: readonly Expectation[],
  options: { readonly rubric?: string; readonly tags?: readonly string[] } = {},
): EvalCase {
  const source: EvalCaseSource = 'correction';
  return validateEvalCase({
    id,
    agentId: candidate.agentId,
    input: candidate.input,
    context: candidate.context,
    expectations,
    ...(options.rubric !== undefined && { rubric: options.rubric }),
    tags: options.tags ?? [],
    source,
  });
}
