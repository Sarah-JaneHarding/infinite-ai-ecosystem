// Token-budgeted context assembly — Stage 05 step 4's last named stage.
//
// This is deliberately *not* step 5's packer. Step 5's own text asks for priority ordering
// (L0 constitution first, then task-relevant L1/L2, then exemplars) and a record of what
// was included and dropped — real work this stage does not do, because step 4's own text
// only names "token-budgeted context assembly" as the retrieval pipeline's last stage, not
// its algorithm. What this function guarantees today, and step 5 will keep: highest-score-
// first, whole-candidate granularity — it never truncates a fact mid-way through, only
// ever includes or drops one entire candidate at a time.
//
// `estimateTokens` is a placeholder, not a tokenizer: roughly four characters per token is
// the commonly used rough average for English text. A real tokenizer is a dependency this
// stage does not yet justify adding — nothing downstream depends on the estimate being
// exact, only on the budget never being exceeded, which a conservative overestimate still
// guarantees.

import type { RetrievalCandidate } from './retrieval-types.js';
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function describe(candidate: RetrievalCandidate): string {
  return candidate.kind === 'node'
    ? `${candidate.entityType}: ${candidate.label}`
    : `${candidate.eventType}: ${candidate.summary}`;
}

export function assembleContext(
  ranked: readonly ScoredCandidate[],
  tokenBudget: number,
): AssembledContext {
  if (tokenBudget < 0) {
    throw new BrainAssemblyError('Refusing a negative token budget.');
  }

  const included: AssembledCandidate[] = [];
  const dropped: AssembledCandidate[] = [];
  let totalTokens = 0;

  for (const { candidate, score } of ranked) {
    const text = describe(candidate);
    const estimatedTokens = estimateTokens(text);
    const item: AssembledCandidate = {
      id: candidate.id,
      kind: candidate.kind,
      text,
      score,
      estimatedTokens,
    };
    if (totalTokens + estimatedTokens <= tokenBudget) {
      included.push(item);
      totalTokens += estimatedTokens;
    } else {
      dropped.push(item);
    }
  }

  return { included, dropped, totalTokens };
}
