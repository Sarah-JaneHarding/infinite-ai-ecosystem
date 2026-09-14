// Exemplar Curator — Stage 13 step 4.
//
// Pure curation logic extracted from LE-05's rules so they can be unit-tested
// deterministically.
//
// Manual rule (§13 step 4): "Build LE-05 and LE-06 producing candidates only."
// An ExemplarCandidate is never directly promoted to L3 — it requires human
// ratification via LE-07 and the ratification surface. `promoted` is always `false`.
//
// Composite score = (evalScore + firstPassAcceptanceRate + attributionConfidence) / 3
// Candidates with compositeScore < EXEMPLAR_MIN_COMPOSITE_SCORE are excluded.
// Qualifying candidates are returned sorted by compositeScore descending.
//
// `candidateId` and `proposedAt` are injected via `ExemplarCuratorInput` for
// deterministic testing; callers supply `crypto.randomUUID` and `new Date().toISOString()`
// in production.

import type { ExemplarCandidate } from '@infinite-ai/contracts';

/** Minimum composite score for an artefact to qualify as an exemplar candidate. */
export const EXEMPLAR_MIN_COMPOSITE_SCORE = 0.5 as const;

export interface ExemplarCuratorCandidateInput {
  readonly artefactId: string;
  readonly evalScore: number;
  readonly firstPassAcceptanceRate: number;
  readonly attributionConfidence: number;
}

export interface ExemplarCuratorInput {
  readonly capsTopicId: string;
  readonly agentId: string;
  readonly candidates: readonly ExemplarCuratorCandidateInput[];
  /** ISO-8601 datetime stamped on every proposed candidate. */
  readonly now: string;
  /** Injected UUID generator — use `crypto.randomUUID` in production. */
  readonly idGenerator: () => string;
}

export type ExemplarCuratorDecision =
  | {
      readonly status: 'ok';
      readonly candidates: readonly ExemplarCandidate[];
    }
  | {
      readonly status: 'no_candidates';
      readonly detail: string;
    }
  | {
      readonly status: 'needs_input';
      readonly missingFields: readonly string[];
    };

function compositeScore(c: ExemplarCuratorCandidateInput): number {
  return (c.evalScore + c.firstPassAcceptanceRate + c.attributionConfidence) / 3;
}

/**
 * Selects exemplar candidates from a set of artefacts with eval scores.
 *
 * Returns `needs_input` when no candidates are supplied; `no_candidates` when no
 * artefact's composite score meets `EXEMPLAR_MIN_COMPOSITE_SCORE`; otherwise `ok`
 * with all qualifying candidates sorted by composite score descending.
 *
 * Every returned candidate has `promoted: false` — it is a proposal only. Human
 * ratification via LE-07 and the ratification surface is required before any
 * promotion to L3.
 */
export function curateExemplars(input: ExemplarCuratorInput): ExemplarCuratorDecision {
  if (input.candidates.length === 0) {
    return { status: 'needs_input', missingFields: ['candidates'] };
  }

  const qualifying: ExemplarCandidate[] = [];

  for (const c of input.candidates) {
    const score = compositeScore(c);
    if (score >= EXEMPLAR_MIN_COMPOSITE_SCORE) {
      qualifying.push({
        candidateId: input.idGenerator(),
        artefactId: c.artefactId,
        capsTopicId: input.capsTopicId,
        agentId: input.agentId,
        compositeScore: score,
        rationale:
          `compositeScore=${score.toFixed(4)}` +
          ` (eval=${c.evalScore}, firstPassAcceptance=${c.firstPassAcceptanceRate}` +
          `, attributionConfidence=${c.attributionConfidence})`,
        proposedAt: input.now,
        promoted: false,
      });
    }
  }

  if (qualifying.length === 0) {
    return {
      status: 'no_candidates',
      detail: `No candidate met the minimum composite score of ${EXEMPLAR_MIN_COMPOSITE_SCORE}.`,
    };
  }

  qualifying.sort((a, b) => b.compositeScore - a.compositeScore);

  return { status: 'ok', candidates: qualifying };
}
