// Unit tests for the pure halves of caps.ts — Stage 29.
// `submitCapsSource` touches the DB and is covered by seed.integration.spec.ts.

import { describe, expect, it } from 'vitest';

import { buildCapsL0Payload, selectCapsDocuments } from '../src/caps.js';
import { CurriculumSeedError } from '../src/types.js';
import type { CapsSourceInfo } from '../src/types.js';
import type { RetrievalCandidate } from '@infinite-ai/brain';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeInfo(overrides: Partial<CapsSourceInfo> = {}): CapsSourceInfo {
  return {
    documentId: 'caps-mathematics-ip-gr46-2011',
    documentVersion: '2011-ratified',
    title: 'Mathematics Intermediate Phase Grades 4-6',
    subject: 'Mathematics',
    phase: 'INTERMEDIATE',
    grades: ['4', '5', '6'],
    contentAreas: [
      'Numbers, Operations and Relationships',
      'Patterns, Functions and Algebra',
    ],
    weightings: [
      {
        contentArea: 'Numbers, Operations and Relationships',
        grade: '4',
        weightingPercent: 50,
        clause: 'Section 2.6, Table 2.2',
      },
    ],
    topicCount: 12,
    source: {
      documentId: 'caps-mathematics-ip-gr46-2011',
      documentVersion: '2011-ratified',
      clause: 'CAPS curriculum source data',
      ratifiedBy: null,
    },
    ...overrides,
  };
}

function constitutionCandidate(key: string, content: unknown): RetrievalCandidate {
  return {
    kind: 'constitution',
    id: `const-${key}`,
    key,
    constitutionKind: 'CAPS_CANON',
    version: 1,
    recency: new Date('2026-01-01T00:00:00.000Z'),
    content,
  };
}

const VALID_CAPS_CONTENT = {
  documentId: 'caps-mathematics-ip-gr46-2011',
  documentVersion: '2011-ratified',
  title: 'Mathematics Intermediate Phase Grades 4-6',
  subject: 'Mathematics',
  phase: 'INTERMEDIATE',
  grades: ['4', '5', '6'],
  contentAreas: ['Numbers, Operations and Relationships'],
  weightings: [],
  topicCount: 5,
  source: {
    documentId: 'caps-mathematics-ip-gr46-2011',
    documentVersion: '2011-ratified',
    clause: 'CAPS curriculum source data',
    ratifiedBy: null,
  },
};

// ---------------------------------------------------------------------------
// buildCapsL0Payload — happy path
// ---------------------------------------------------------------------------

describe('buildCapsL0Payload', () => {
  it('returns L0_CONSTITUTION payload with correct tier and kind', () => {
    const payload = buildCapsL0Payload(makeInfo(), 'user-1');
    const raw = payload.rawPayload as Record<string, unknown>;
    expect(payload.targetTier).toBe('L0_CONSTITUTION');
    expect(raw['kind']).toBe('CAPS_CANON');
    expect(raw['key']).toBe('caps-mathematics-ip-gr46-2011');
    expect(payload.confidence).toBe(1);
    expect(payload.createdBy).toBe('user-1');
  });

  it('embeds all content fields in rawPayload', () => {
    const info = makeInfo();
    const payload = buildCapsL0Payload(info, 'user-1');
    const raw = payload.rawPayload as Record<string, unknown>;
    const content = raw['content'] as Record<string, unknown>;
    expect(content['documentId']).toBe(info.documentId);
    expect(content['subject']).toBe('Mathematics');
    expect(content['phase']).toBe('INTERMEDIATE');
    expect(Array.isArray(content['grades'])).toBe(true);
    expect(Array.isArray(content['contentAreas'])).toBe(true);
    expect(Array.isArray(content['weightings'])).toBe(true);
    expect(typeof content['topicCount']).toBe('number');
  });

  it('sets source string to curriculum-seed:<id>:<version>', () => {
    const payload = buildCapsL0Payload(makeInfo(), 'u');
    expect(payload.source).toBe(
      'curriculum-seed:caps-mathematics-ip-gr46-2011:2011-ratified',
    );
  });

  it('copies grades and contentAreas as new arrays (not same reference)', () => {
    const info = makeInfo();
    const payload = buildCapsL0Payload(info, 'u');
    const content = (payload.rawPayload as Record<string, unknown>)['content'] as Record<
      string,
      unknown
    >;
    expect(content['grades']).not.toBe(info.grades);
    expect(content['contentAreas']).not.toBe(info.contentAreas);
  });

  // ---------------------------------------------------------------------------
  // failure paths
  // ---------------------------------------------------------------------------

  it('throws CurriculumSeedError for an empty documentId', () => {
    expect(() => buildCapsL0Payload(makeInfo({ documentId: '   ' }), 'u')).toThrow(
      CurriculumSeedError,
    );
    expect(() => buildCapsL0Payload(makeInfo({ documentId: '   ' }), 'u')).toThrow(
      'documentId must not be empty',
    );
  });

  it('throws CurriculumSeedError when contentAreas is empty', () => {
    expect(() => buildCapsL0Payload(makeInfo({ contentAreas: [] }), 'u')).toThrow(
      CurriculumSeedError,
    );
    expect(() => buildCapsL0Payload(makeInfo({ contentAreas: [] }), 'u')).toThrow(
      'has no content areas',
    );
  });
});

// ---------------------------------------------------------------------------
// selectCapsDocuments — happy path and filters
// ---------------------------------------------------------------------------

describe('selectCapsDocuments', () => {
  it('returns an empty array when no candidates match CAPS_CANON', () => {
    const candidates: RetrievalCandidate[] = [
      {
        kind: 'constitution',
        id: 'x',
        key: 'other',
        constitutionKind: 'TEMPLATE',
        version: 1,
        recency: new Date(),
        content: {},
      },
    ];
    expect(selectCapsDocuments(candidates)).toHaveLength(0);
  });

  it('returns parsed CAPS_CANON records', () => {
    const results = selectCapsDocuments([
      constitutionCandidate('caps-mathematics-ip-gr46-2011', VALID_CAPS_CONTENT),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.documentId).toBe('caps-mathematics-ip-gr46-2011');
    expect(results[0]?.subject).toBe('Mathematics');
  });

  it('filters by subject', () => {
    const results = selectCapsDocuments(
      [constitutionCandidate('caps-mathematics-ip-gr46-2011', VALID_CAPS_CONTENT)],
      { subject: 'Science' },
    );
    expect(results).toHaveLength(0);
  });

  it('filters by phase', () => {
    const fp = { ...VALID_CAPS_CONTENT, phase: 'FOUNDATION', grades: ['R', '1'] };
    const ip = { ...VALID_CAPS_CONTENT, phase: 'INTERMEDIATE' };
    const results = selectCapsDocuments(
      [
        constitutionCandidate('caps-maths-fp', fp),
        constitutionCandidate('caps-maths-ip', ip),
      ],
      { phase: 'FOUNDATION' },
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.phase).toBe('FOUNDATION');
  });

  // ---------------------------------------------------------------------------
  // failure path
  // ---------------------------------------------------------------------------

  it('throws CurriculumSeedError when CAPS_CANON content does not parse', () => {
    const malformed = { documentId: 'x', phase: 'INVALID_PHASE' };
    expect(() =>
      selectCapsDocuments([constitutionCandidate('bad-record', malformed)]),
    ).toThrow(CurriculumSeedError);
  });
});
