// Rerank — Stage 05 step 4, second-to-last stage.
//
// A deterministic, documented score rather than a learned reranker or a model call: every
// input (confidence, recency, graph distance) is already on the candidate, so the score is
// auditable and reproducible — exactly what `explain()` (step 9) will need to walk later.
// A black-box reranker would be a second thing this stage would have to explain, on top of
// provenance the Brain already carries for every fact.

import type { RetrievalCandidate } from './retrieval-types.js';

export interface ScoredCandidate {
  readonly candidate: RetrievalCandidate;
  readonly score: number;
}

/** Roughly six months: old enough that a stale fact should not dominate a fresh one at
 * equal confidence, not so short that yesterday's episode outweighs everything else. */
const RECENCY_HALF_LIFE_DAYS = 180;
const MS_PER_DAY = 86_400_000;

function recencyWeight(recency: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - recency.getTime()) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** A node reached by graph expansion is discounted per hop from the vector seed that led
 * to it — two hops away is a weaker association than the seed itself. Vector matches and
 * episodes (no `graphHops`) are unaffected. */
function graphPenalty(candidate: RetrievalCandidate): number {
  if (candidate.kind !== 'node' || candidate.graphHops === null) return 1;
  return 1 / (1 + candidate.graphHops);
}

/** Highest score first. Ties are not broken further — `assembleContext`'s greedy packer
 * takes them in whatever stable order they arrive in. */
export function rerank(
  candidates: readonly RetrievalCandidate[],
  now: Date,
): readonly ScoredCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score:
        candidate.confidence *
        recencyWeight(candidate.recency, now) *
        graphPenalty(candidate),
    }))
    .sort((a, b) => b.score - a.score);
}
