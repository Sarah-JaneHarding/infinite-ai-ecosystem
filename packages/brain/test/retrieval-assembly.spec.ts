import { describe, expect, it } from 'vitest';

import { BrainAssemblyError, assembleContext } from '../src/retrieval-assembly.js';
import type { ScoredCandidate } from '../src/retrieval-rerank.js';
import type { NodeRetrievalCandidate } from '../src/retrieval-types.js';

function scored(id: string, label: string, score: number): ScoredCandidate {
  const candidate: NodeRetrievalCandidate = {
    kind: 'node',
    id,
    entityType: 'TOPIC',
    label,
    attributes: {},
    confidence: 1,
    recency: new Date('2026-08-05'),
    source: 'vector',
    vectorDistance: 0,
    graphHops: null,
  };
  return { candidate, score };
}

describe('assembleContext', () => {
  it('includes every candidate when the budget is generous', () => {
    const ranked = [scored('a', 'Alpha', 0.9), scored('b', 'Beta', 0.8)];
    const result = assembleContext(ranked, 1000);
    expect(result.included.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result.dropped).toEqual([]);
  });

  it('never includes a candidate that would exceed the budget, and keeps evaluating the rest', () => {
    // "TOPIC: Alpha" is 12 chars -> ceil(12/4) = 3 tokens. "TOPIC: A tiny one" is smaller.
    const ranked = [
      scored('a', 'A somewhat long label that takes real budget', 0.9),
      scored('b', 'B', 0.8),
    ];
    const result = assembleContext(ranked, 5);
    expect(result.included.map((c) => c.id)).toEqual(['b']);
    expect(result.dropped.map((c) => c.id)).toEqual(['a']);
  });

  it('never exceeds the stated token budget', () => {
    const ranked = [
      scored('a', 'Alpha', 0.9),
      scored('b', 'Beta', 0.8),
      scored('c', 'Gamma', 0.7),
    ];
    const result = assembleContext(ranked, 6);
    expect(result.totalTokens).toBeLessThanOrEqual(6);
  });

  it('drops whole candidates, never truncating one mid-way', () => {
    const ranked = [scored('a', 'A very very very long label indeed', 0.9)];
    const result = assembleContext(ranked, 1);
    expect(result.included).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]!.text).toBe('TOPIC: A very very very long label indeed');
  });

  it('throws on a negative token budget', () => {
    expect(() => assembleContext([], -1)).toThrow(BrainAssemblyError);
  });

  it('handles an empty candidate list', () => {
    const result = assembleContext([], 100);
    expect(result).toEqual({ included: [], dropped: [], totalTokens: 0 });
  });
});
