import { describe, expect, it } from 'vitest';

import { BrainAssemblyError, assembleContext } from '../src/retrieval-assembly.js';
import type { ScoredCandidate } from '../src/retrieval-rerank.js';
import type {
  ConstitutionRetrievalCandidate,
  ExemplarRetrievalCandidate,
  NodeRetrievalCandidate,
} from '../src/retrieval-types.js';

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

function constitution(
  id: string,
  key: string,
  content: unknown,
): ConstitutionRetrievalCandidate {
  return {
    kind: 'constitution',
    id,
    key,
    constitutionKind: 'ASSESSMENT_POLICY',
    version: 1,
    content,
    recency: new Date('2026-01-01'),
  };
}

function exemplar(id: string, ref: string, content: unknown): ExemplarRetrievalCandidate {
  return {
    kind: 'exemplar',
    id,
    ref,
    version: 1,
    content,
    recency: new Date('2026-01-01'),
  };
}

describe('assembleContext', () => {
  it('includes every candidate across all three tiers when the budget is generous', () => {
    const result = assembleContext(
      [constitution('c1', 'policy', 'x')],
      [scored('a', 'Alpha', 0.9), scored('b', 'Beta', 0.8)],
      [exemplar('e1', 'worked-example', 'y')],
      1000,
    );
    expect(result.included.map((c) => c.id)).toEqual(['c1', 'a', 'b', 'e1']);
    expect(result.dropped).toEqual([]);
  });

  it('packs constitution before ranked L1/L2, before exemplars, regardless of size or score', () => {
    // The constitution candidate is deliberately the most expensive of the three, and the
    // ranked candidate has the highest per-tier score — if tier order were driven by size
    // or score rather than a fixed priority, the small exemplar would win a spot before
    // the constitution fact does. It must not: L0 goes first no matter what.
    const bigConstitution = constitution('c1', 'policy', 'x'.repeat(40));
    const ranked = [scored('a', 'A', 0.9)];
    const smallExemplar = exemplar('e1', 'tiny', 'y');

    // Budget fits only the constitution fact (its own cost), nothing else.
    const cost = Math.ceil(
      `${bigConstitution.constitutionKind}[${bigConstitution.key} v1]: ${JSON.stringify(bigConstitution.content)}`
        .length / 4,
    );
    const result = assembleContext([bigConstitution], ranked, [smallExemplar], cost);

    expect(result.included.map((c) => c.id)).toEqual(['c1']);
    expect(result.dropped.map((c) => c.id).sort()).toEqual(['a', 'e1']);
  });

  it('backfills a later tier with budget an earlier tier could not use', () => {
    // The ranked candidate ("TOPIC: A somewhat long label that takes real budget", 13
    // tokens) is too big to fit at all; the exemplar ("EXEMPLAR[e v1]: null", 5 tokens) is
    // small enough to use the budget the dropped ranked candidate left untouched.
    const ranked = [scored('a', 'A somewhat long label that takes real budget', 0.9)];
    const smallExemplar = exemplar('e1', 'e', null);
    const result = assembleContext([], ranked, [smallExemplar], 5);
    expect(result.dropped.map((c) => c.id)).toContain('a');
    expect(result.included.map((c) => c.id)).toContain('e1');
  });

  it('never includes a candidate that would exceed the budget, and keeps evaluating the rest', () => {
    const ranked = [
      scored('a', 'A somewhat long label that takes real budget', 0.9),
      scored('b', 'B', 0.8),
    ];
    const result = assembleContext([], ranked, [], 5);
    expect(result.included.map((c) => c.id)).toEqual(['b']);
    expect(result.dropped.map((c) => c.id)).toEqual(['a']);
  });

  it('never exceeds the stated token budget', () => {
    const ranked = [
      scored('a', 'Alpha', 0.9),
      scored('b', 'Beta', 0.8),
      scored('c', 'Gamma', 0.7),
    ];
    const result = assembleContext([], ranked, [], 6);
    expect(result.totalTokens).toBeLessThanOrEqual(6);
  });

  it('drops whole candidates, never truncating one mid-way', () => {
    const ranked = [scored('a', 'A very very very long label indeed', 0.9)];
    const result = assembleContext([], ranked, [], 1);
    expect(result.included).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]!.text).toBe('TOPIC: A very very very long label indeed');
  });

  it('throws on a negative token budget', () => {
    expect(() => assembleContext([], [], [], -1)).toThrow(BrainAssemblyError);
  });

  it('handles an empty candidate list across every tier', () => {
    const result = assembleContext([], [], [], 100);
    expect(result).toEqual({ included: [], dropped: [], totalTokens: 0 });
  });
});
