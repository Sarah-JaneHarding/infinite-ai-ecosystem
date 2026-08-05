import { describe, expect, it } from 'vitest';

import { rerank } from '../src/retrieval-rerank.js';
import type {
  EpisodeRetrievalCandidate,
  NodeRetrievalCandidate,
} from '../src/retrieval-types.js';

const NOW = new Date('2026-08-05T00:00:00.000Z');

function aNode(overrides: Partial<NodeRetrievalCandidate> = {}): NodeRetrievalCandidate {
  return {
    kind: 'node',
    id: 'node-1',
    entityType: 'TOPIC',
    label: 'Fractions',
    attributes: {},
    confidence: 1,
    recency: NOW,
    source: 'vector',
    vectorDistance: 0,
    graphHops: null,
    ...overrides,
  };
}

function anEpisode(
  overrides: Partial<EpisodeRetrievalCandidate> = {},
): EpisodeRetrievalCandidate {
  return {
    kind: 'episode',
    id: 'episode-1',
    eventType: 'screening_flag_raised',
    summary: 'Flag raised',
    detail: {},
    confidence: 1,
    recency: NOW,
    ...overrides,
  };
}

describe('rerank', () => {
  it('ranks higher confidence above lower confidence, all else equal', () => {
    const strong = aNode({ id: 'strong', confidence: 0.9 });
    const weak = aNode({ id: 'weak', confidence: 0.3 });
    const ranked = rerank([weak, strong], NOW);
    expect(ranked.map((r) => r.candidate.id)).toEqual(['strong', 'weak']);
  });

  it('ranks a more recent fact above an older one at equal confidence', () => {
    const recent = aNode({ id: 'recent', recency: NOW });
    const old = aNode({ id: 'old', recency: new Date('2025-01-01T00:00:00.000Z') });
    const ranked = rerank([old, recent], NOW);
    expect(ranked.map((r) => r.candidate.id)).toEqual(['recent', 'old']);
  });

  it('discounts a node by its graph distance from the vector seed', () => {
    const seed = aNode({ id: 'seed', source: 'vector', graphHops: null });
    const twoHops = aNode({ id: 'two-hops', source: 'graph', graphHops: 2 });
    const ranked = rerank([twoHops, seed], NOW);
    expect(ranked.map((r) => r.candidate.id)).toEqual(['seed', 'two-hops']);
  });

  it('does not apply a graph penalty to an episode', () => {
    const episode = anEpisode({ confidence: 0.9 });
    const ranked = rerank([episode], NOW);
    expect(ranked[0]!.score).toBe(0.9);
  });

  it('sorts strictly descending by score', () => {
    const candidates = [
      aNode({ id: 'a', confidence: 0.5 }),
      aNode({ id: 'b', confidence: 0.9 }),
      aNode({ id: 'c', confidence: 0.2 }),
    ];
    const ranked = rerank(candidates, NOW);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.score).toBeLessThanOrEqual(ranked[i - 1]!.score);
    }
  });
});
