// selectAgeAppropriatenessEntries — the pure read half of the age-appropriateness
// ingestion. submitAgeAppropriatenessEntry needs a real TenantClient; it is proven in
// age-appropriateness.integration.spec.ts, the same split curriculum-templates.spec.ts /
// curriculum-templates.integration.spec.ts already use.

import { describe, expect, it } from 'vitest';

import {
  AgeAppropriatenessError,
  keyFor,
  selectAgeAppropriatenessEntries,
} from '../src/age-appropriateness.js';
import type { RetrievalCandidate } from '../src/retrieval-types.js';

const source = {
  documentId: 'age-appropriateness-src-life-skills',
  documentVersion: 'caps-current',
  clause: '1.3(c) General Principles of the National Curriculum Statement',
  ratifiedBy: null,
};

function entryCandidate(
  index: number,
  overrides: Record<string, unknown> = {},
): RetrievalCandidate {
  const key = keyFor(index);
  return {
    kind: 'constitution',
    id: `constitution-${key}`,
    key,
    constitutionKind: 'AGE_APPROPRIATENESS',
    version: 1,
    recency: new Date('2026-08-25T00:00:00.000Z'),
    content: {
      phase: 'FOUNDATION',
      gradeRange: 'R-3',
      subject: 'Life Skills',
      clauseType: 'progression',
      content:
        'Content and context at each grade level is designed to move from simple to complex.',
      source,
      ...overrides,
    },
  };
}

describe('keyFor', () => {
  it('zero-pads to a stable, sortable key', () => {
    expect(keyFor(0)).toBe('age-appropriateness-000');
    expect(keyFor(5)).toBe('age-appropriateness-005');
    expect(keyFor(205)).toBe('age-appropriateness-205');
  });
});

describe('selectAgeAppropriatenessEntries', () => {
  it('returns every AGE_APPROPRIATENESS constitution candidate, parsed', () => {
    const candidates: readonly RetrievalCandidate[] = [
      entryCandidate(0),
      entryCandidate(1, { subject: 'Mathematics', phase: 'INTERMEDIATE' }),
    ];
    const entries = selectAgeAppropriatenessEntries(candidates);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.subject).toSorted()).toEqual([
      'Life Skills',
      'Mathematics',
    ]);
  });

  it('narrows by phase', () => {
    const candidates: readonly RetrievalCandidate[] = [
      entryCandidate(0),
      entryCandidate(1, { subject: 'Mathematics', phase: 'INTERMEDIATE' }),
    ];
    const entries = selectAgeAppropriatenessEntries(candidates, {
      phase: 'INTERMEDIATE',
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.subject).toBe('Mathematics');
  });

  it('narrows by subject', () => {
    const candidates: readonly RetrievalCandidate[] = [
      entryCandidate(0),
      entryCandidate(1, { subject: 'Mathematics', phase: 'INTERMEDIATE' }),
    ];
    const entries = selectAgeAppropriatenessEntries(candidates, {
      subject: 'Mathematics',
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.phase).toBe('INTERMEDIATE');
  });

  it('ignores non-AGE_APPROPRIATENESS constitution candidates and non-constitution candidates', () => {
    const candidates: readonly RetrievalCandidate[] = [
      entryCandidate(0),
      {
        kind: 'constitution',
        id: 'other',
        key: 'assessment-policy',
        constitutionKind: 'ASSESSMENT_POLICY',
        version: 1,
        content: { anything: true },
        recency: new Date(),
      },
      {
        kind: 'node',
        id: 'node-1',
        entityType: 'TOPIC',
        label: 'Fractions',
        attributes: {},
        confidence: 1,
        recency: new Date(),
        source: 'vector',
        vectorDistance: null,
        graphHops: null,
      },
    ];
    const entries = selectAgeAppropriatenessEntries(candidates);
    expect(entries).toHaveLength(1);
  });

  it('returns an empty list when nothing is ratified yet', () => {
    expect(selectAgeAppropriatenessEntries([])).toEqual([]);
  });

  it('throws for an AGE_APPROPRIATENESS row whose content does not parse', () => {
    const candidates: readonly RetrievalCandidate[] = [
      entryCandidate(0, { content: '' }),
    ];
    expect(() => selectAgeAppropriatenessEntries(candidates)).toThrow(
      AgeAppropriatenessError,
    );
  });
});
