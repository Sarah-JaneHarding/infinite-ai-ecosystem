// Unit tests for the pure halves of atp.ts — Stage 29.
// `submitAtpSource` touches the DB and is covered by seed.integration.spec.ts.

import { describe, expect, it } from 'vitest';

import { buildAtpL0Payload, selectAtpDocuments } from '../src/atp.js';
import { CurriculumSeedError } from '../src/types.js';
import type { RetrievalCandidate } from '@infinite-ai/brain';
import type { ATPSourceDocument } from '@infinite-ai/contracts';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<ATPSourceDocument> = {}): ATPSourceDocument {
  return {
    sourceId: 'atp-gr4-mathematics-2023',
    grade: '4',
    phase: 'Intermediate Phase',
    subject: 'Mathematics',
    atpYear: 2023,
    sourceDescription: 'DBE 2023 Grade 4 Mathematics ATP',
    topics: [
      {
        sourceId: 'atp-gr4-mathematics-2023',
        grade: '4',
        subject: 'Mathematics',
        term: 1,
        weekStart: 1,
        weekEnd: 3,
        contentArea: 'Numbers, Operations and Relationships',
        topic: 'Whole numbers',
        assessmentType: null,
        hours: 6,
        basis: {
          documentId: 'atp-gr4-mathematics-2023',
          documentVersion: '2023',
          clause: 'term table',
          ratifiedBy: null,
        },
      },
    ],
    fats: [
      {
        sourceId: 'atp-gr4-mathematics-2023',
        grade: '4',
        subject: 'Mathematics',
        term: 1,
        fatNumber: 1,
        fatType: 'Test',
        fatDescription: 'Term 1 test',
        weekNumber: 4,
        durationHours: null,
        markTotal: 50,
        sbaContribution: '20%',
        basis: {
          documentId: 'atp-gr4-mathematics-2023',
          documentVersion: '2023',
          clause: 'FAT schedule',
          ratifiedBy: null,
        },
      },
    ],
    ...overrides,
  };
}

function atpConstitutionCandidate(key: string, content: unknown): RetrievalCandidate {
  return {
    kind: 'constitution',
    id: `const-${key}`,
    key,
    constitutionKind: 'ATP_CALENDAR',
    version: 1,
    recency: new Date('2026-01-01T00:00:00.000Z'),
    content,
  };
}

const VALID_ATP_CONTENT = {
  documentId: 'atp-gr4-mathematics-2023',
  sourceId: 'atp-gr4-mathematics-2023',
  grade: '4',
  phase: 'Intermediate Phase',
  subject: 'Mathematics',
  atpYear: 2023,
  sourceDescription: 'DBE 2023 Grade 4 Mathematics ATP',
  topicCount: 1,
  fatCount: 1,
  topics: [
    {
      term: 1,
      weekStart: 1,
      weekEnd: 3,
      contentArea: 'Numbers, Operations and Relationships',
      topic: 'Whole numbers',
      assessmentType: null,
    },
  ],
  fats: [
    {
      term: 1,
      fatNumber: 1,
      fatType: 'Test',
      fatDescription: 'Term 1 test',
    },
  ],
  source: {
    documentId: 'atp-gr4-mathematics-2023',
    documentVersion: '2023',
    clause: 'ATP source document',
    ratifiedBy: null,
  },
};

// ---------------------------------------------------------------------------
// buildAtpL0Payload — happy path
// ---------------------------------------------------------------------------

describe('buildAtpL0Payload', () => {
  it('returns L0_CONSTITUTION payload with ATP_CALENDAR kind', () => {
    const payload = buildAtpL0Payload(makeDoc(), 'user-1');
    const raw = payload.rawPayload as Record<string, unknown>;
    expect(payload.targetTier).toBe('L0_CONSTITUTION');
    expect(raw['kind']).toBe('ATP_CALENDAR');
    expect(raw['key']).toBe('atp-gr4-mathematics-2023');
    expect(payload.confidence).toBe(1);
    expect(payload.createdBy).toBe('user-1');
  });

  it('embeds topicCount and fatCount from the source arrays', () => {
    const doc = makeDoc();
    const payload = buildAtpL0Payload(doc, 'u');
    const content = (payload.rawPayload as Record<string, unknown>)['content'] as Record<
      string,
      unknown
    >;
    expect(content['topicCount']).toBe(doc.topics.length);
    expect(content['fatCount']).toBe(doc.fats.length);
  });

  it('maps topics with all required fields', () => {
    const payload = buildAtpL0Payload(makeDoc(), 'u');
    const content = (payload.rawPayload as Record<string, unknown>)['content'] as Record<
      string,
      unknown
    >;
    const topics = content['topics'] as Array<Record<string, unknown>>;
    expect(topics[0]).toMatchObject({
      term: 1,
      weekStart: 1,
      weekEnd: 3,
      contentArea: 'Numbers, Operations and Relationships',
      topic: 'Whole numbers',
      assessmentType: null,
    });
  });

  it('maps fats with summary fields only', () => {
    const payload = buildAtpL0Payload(makeDoc(), 'u');
    const content = (payload.rawPayload as Record<string, unknown>)['content'] as Record<
      string,
      unknown
    >;
    const fats = content['fats'] as Array<Record<string, unknown>>;
    expect(fats[0]).toMatchObject({
      term: 1,
      fatNumber: 1,
      fatType: 'Test',
      fatDescription: 'Term 1 test',
    });
    // markTotal and sbaContribution are not stored — summary only
    expect(fats[0]).not.toHaveProperty('markTotal');
  });

  it('sets source string to curriculum-seed:<id>:<year>', () => {
    const payload = buildAtpL0Payload(makeDoc(), 'u');
    expect(payload.source).toBe('curriculum-seed:atp-gr4-mathematics-2023:2023');
  });

  // ---------------------------------------------------------------------------
  // failure paths
  // ---------------------------------------------------------------------------

  it('throws CurriculumSeedError for an empty sourceId', () => {
    expect(() => buildAtpL0Payload(makeDoc({ sourceId: '' }), 'u')).toThrow(
      CurriculumSeedError,
    );
    expect(() => buildAtpL0Payload(makeDoc({ sourceId: '   ' }), 'u')).toThrow(
      'sourceId must not be empty',
    );
  });

  it('throws CurriculumSeedError when topics is empty', () => {
    expect(() => buildAtpL0Payload(makeDoc({ topics: [] }), 'u')).toThrow(
      CurriculumSeedError,
    );
    expect(() => buildAtpL0Payload(makeDoc({ topics: [] }), 'u')).toThrow(
      'no topic blocks',
    );
  });
});

// ---------------------------------------------------------------------------
// selectAtpDocuments — happy path and filters
// ---------------------------------------------------------------------------

describe('selectAtpDocuments', () => {
  it('returns empty array when no candidates match ATP_CALENDAR', () => {
    const candidates: RetrievalCandidate[] = [
      {
        kind: 'constitution',
        id: 'x',
        key: 'other',
        constitutionKind: 'CAPS_CANON',
        version: 1,
        recency: new Date(),
        content: {},
      },
    ];
    expect(selectAtpDocuments(candidates)).toHaveLength(0);
  });

  it('returns parsed ATP_CALENDAR records', () => {
    const results = selectAtpDocuments([
      atpConstitutionCandidate('atp-gr4-mathematics-2023', VALID_ATP_CONTENT),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceId).toBe('atp-gr4-mathematics-2023');
    expect(results[0]?.grade).toBe('4');
  });

  it('filters by grade', () => {
    const results = selectAtpDocuments(
      [atpConstitutionCandidate('atp-gr4-mathematics-2023', VALID_ATP_CONTENT)],
      { grade: '5' },
    );
    expect(results).toHaveLength(0);
  });

  it('filters by subject', () => {
    const results = selectAtpDocuments(
      [atpConstitutionCandidate('atp-gr4-mathematics-2023', VALID_ATP_CONTENT)],
      { subject: 'English' },
    );
    expect(results).toHaveLength(0);
  });

  it('filters by atpYear', () => {
    const results = selectAtpDocuments(
      [atpConstitutionCandidate('atp-gr4-mathematics-2023', VALID_ATP_CONTENT)],
      { atpYear: 2026 },
    );
    expect(results).toHaveLength(0);

    const matched = selectAtpDocuments(
      [atpConstitutionCandidate('atp-gr4-mathematics-2023', VALID_ATP_CONTENT)],
      { atpYear: 2023 },
    );
    expect(matched).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // failure path
  // ---------------------------------------------------------------------------

  it('throws CurriculumSeedError when ATP_CALENDAR content does not parse', () => {
    const malformed = { sourceId: 'x', atpYear: 'not-a-number' };
    expect(() =>
      selectAtpDocuments([atpConstitutionCandidate('bad-record', malformed)]),
    ).toThrow(CurriculumSeedError);
  });
});
