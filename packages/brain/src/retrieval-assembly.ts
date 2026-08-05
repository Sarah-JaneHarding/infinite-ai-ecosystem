// Token-budgeted context assembly — Stage 05 step 5, the retrieval path's real packer.
//
// Step 4 built the pipeline's last named stage as a placeholder: highest-score-first over
// whatever candidates the earlier stages found, because nothing had fetched L0 or L3 yet
// and step 4's own text never named a priority order — only step 5's did. This is that
// algorithm: a deterministic packer that fills `tokenBudget` in three fixed tiers — L0
// constitution first, then task-relevant L1/L2 (in the rerank order `rerank()` already
// computed), then L3 exemplars — never letting a later tier's candidate jump ahead of an
// earlier tier's, however much cheaper it is. Every tier still keeps step 4's own
// guarantee: whole-candidate granularity, and a candidate too big for what remains does
// not stop the packer from trying the next (smaller) one in the same tier.
//
// `estimateTokens` is a placeholder, not a tokenizer: roughly four characters per token is
// the commonly used rough average for English text. A real tokenizer is a dependency this
// stage does not yet justify adding — nothing downstream depends on the estimate being
// exact, only on the budget never being exceeded, which a conservative overestimate still
// guarantees.

import type {
  ConstitutionRetrievalCandidate,
  ExemplarRetrievalCandidate,
  RankableCandidate,
  RetrievalCandidate,
} from './retrieval-types.js';
import type { ScoredCandidate } from './retrieval-rerank.js';

export class BrainAssemblyError extends Error {
  public override readonly name = 'BrainAssemblyError';
  constructor(message: string) {
    super(message);
  }
}

export interface AssembledCandidate {
  readonly id: string;
  readonly kind: RetrievalCandidate['kind'];
  readonly text: string;
  readonly score: number;
  readonly estimatedTokens: number;
}

export interface AssembledContext {
  readonly included: readonly AssembledCandidate[];
  readonly dropped: readonly AssembledCandidate[];
  readonly totalTokens: number;
}

/** Ratified facts (L0/L3) carry no `confidence` the way an extracted L1/L2 candidate does
 * — see the two candidate interfaces' own comments in retrieval-types.ts — so their
 * `AssembledCandidate.score` is this constant rather than an absent field. It plays no
 * part in ordering: tier position alone decides that. */
const RATIFIED_SCORE = 1;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function describeConstitution(candidate: ConstitutionRetrievalCandidate): string {
  return `${candidate.constitutionKind}[${candidate.key} v${candidate.version}]: ${JSON.stringify(candidate.content)}`;
}

function describeRankable(candidate: RankableCandidate): string {
  return candidate.kind === 'node'
    ? `${candidate.entityType}: ${candidate.label}`
    : `${candidate.eventType}: ${candidate.summary}`;
}

function describeExemplar(candidate: ExemplarRetrievalCandidate): string {
  return `EXEMPLAR[${candidate.ref} v${candidate.version}]: ${JSON.stringify(candidate.content)}`;
}

/**
 * Packs `constitution`, then `ranked`, then `exemplars` — in that fixed order — into
 * `tokenBudget`. Within a tier, a candidate that would exceed what remains is dropped and
 * the packer keeps trying the rest of that tier; it never backfills a later tier's item
 * ahead of an earlier tier's, even when the later one is cheaper and would fit.
 */
export function assembleContext(
  constitution: readonly ConstitutionRetrievalCandidate[],
  ranked: readonly ScoredCandidate[],
  exemplars: readonly ExemplarRetrievalCandidate[],
  tokenBudget: number,
): AssembledContext {
  if (tokenBudget < 0) {
    throw new BrainAssemblyError('Refusing a negative token budget.');
  }

  const included: AssembledCandidate[] = [];
  const dropped: AssembledCandidate[] = [];
  let totalTokens = 0;

  function pack(item: AssembledCandidate): void {
    if (totalTokens + item.estimatedTokens <= tokenBudget) {
      included.push(item);
      totalTokens += item.estimatedTokens;
    } else {
      dropped.push(item);
    }
  }

  for (const candidate of constitution) {
    const text = describeConstitution(candidate);
    pack({
      id: candidate.id,
      kind: 'constitution',
      text,
      score: RATIFIED_SCORE,
      estimatedTokens: estimateTokens(text),
    });
  }

  for (const { candidate, score } of ranked) {
    const text = describeRankable(candidate);
    pack({
      id: candidate.id,
      kind: candidate.kind,
      text,
      score,
      estimatedTokens: estimateTokens(text),
    });
  }

  for (const candidate of exemplars) {
    const text = describeExemplar(candidate);
    pack({
      id: candidate.id,
      kind: 'exemplar',
      text,
      score: RATIFIED_SCORE,
      estimatedTokens: estimateTokens(text),
    });
  }

  return { included, dropped, totalTokens };
}
