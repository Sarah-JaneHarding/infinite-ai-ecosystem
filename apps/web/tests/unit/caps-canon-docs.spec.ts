import { describe, it, expect } from 'vitest';
import {
  ALL_CAPS_CANON_DOCS,
  findCanonDoc,
  findCapsSourceByBrainDocId,
} from '../../src/components/curriculum/caps-canon-docs.js';
import type { CapsCanonDoc } from '../../src/components/curriculum/caps-canon-docs.js';

// Minimal CapsSourceInfo shape for tests — matches what curriculum-seed exports.
interface MinimalSource {
  documentId: string;
  documentVersion: string;
  subject: string;
  phase: string;
}

describe('ALL_CAPS_CANON_DOCS', () => {
  it('contains exactly 55 documents', () => {
    expect(ALL_CAPS_CANON_DOCS.length).toBe(55);
  });

  it('each document has a non-empty id and title', () => {
    for (const doc of ALL_CAPS_CANON_DOCS) {
      expect(doc.id.length).toBeGreaterThan(0);
      expect(doc.title.length).toBeGreaterThan(0);
    }
  });

  it('all document ids are unique', () => {
    const ids = ALL_CAPS_CANON_DOCS.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('each document has a valid phase', () => {
    const validPhases = new Set(['FP', 'IP', 'SP', 'ATP']);
    for (const doc of ALL_CAPS_CANON_DOCS) {
      expect(
        validPhases.has(doc.phase),
        `doc ${doc.id} has invalid phase "${doc.phase}"`,
      ).toBe(true);
    }
  });

  it('documents with null brainDocumentId are download-only', () => {
    const nullBrainDocs = ALL_CAPS_CANON_DOCS.filter((d) => d.brainDocumentId === null);
    // ATPs (3) + CAPS-FP-ALL + CAPS-FP-FAL-AF + language variants without structured data = > 3
    expect(nullBrainDocs.length).toBeGreaterThan(3);
    // Every ATP has null brainDocumentId (CE-02 handles ATPs)
    const atpDocs = ALL_CAPS_CANON_DOCS.filter((d) => d.phase === 'ATP');
    for (const atp of atpDocs) {
      expect(atp.brainDocumentId).toBeNull();
    }
  });

  it('documents with a brainDocumentId have a non-empty string', () => {
    const withBrainId = ALL_CAPS_CANON_DOCS.filter((d) => d.brainDocumentId !== null);
    for (const doc of withBrainId) {
      expect(typeof doc.brainDocumentId).toBe('string');
      expect((doc.brainDocumentId as string).length).toBeGreaterThan(0);
    }
  });

  it('has exactly 3 ATP documents', () => {
    const atpDocs = ALL_CAPS_CANON_DOCS.filter((d) => d.phase === 'ATP');
    expect(atpDocs.length).toBe(3);
  });
});

describe('findCanonDoc', () => {
  it('returns the document for a known id', () => {
    const doc = findCanonDoc('CAPS-FP-HL-en');
    expect(doc).toBeDefined();
    expect(doc?.id).toBe('CAPS-FP-HL-en');
    expect(doc?.phase).toBe('FP');
  });

  it('returns undefined for an unknown id', () => {
    const doc = findCanonDoc('CAPS-DOES-NOT-EXIST-999');
    expect(doc).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(findCanonDoc('')).toBeUndefined();
  });

  it('returns the ATP document for ATP-2324-FP', () => {
    const doc = findCanonDoc('ATP-2324-FP');
    expect(doc).toBeDefined();
    expect(doc?.phase).toBe('ATP');
    expect(doc?.brainDocumentId).toBeNull();
  });

  it('returns a known SP document with a non-null brainDocumentId', () => {
    const doc = findCanonDoc('CAPS-SP-MATH') as CapsCanonDoc;
    expect(doc).toBeDefined();
    expect(doc.brainDocumentId).not.toBeNull();
  });

  it('CAPS-SP-HIS and CAPS-SP-GEO share the same brainDocumentId (social sciences SP)', () => {
    const his = findCanonDoc('CAPS-SP-HIS');
    const geo = findCanonDoc('CAPS-SP-GEO');
    expect(his?.brainDocumentId).not.toBeNull();
    expect(his?.brainDocumentId).toBe(geo?.brainDocumentId);
  });
});

describe('findCapsSourceByBrainDocId', () => {
  const fakeSources: MinimalSource[] = [
    {
      documentId: 'caps-mathematics-fp-gr-r3-2011',
      documentVersion: '2011',
      subject: 'Mathematics',
      phase: 'FP',
    },
    {
      documentId: 'caps-mathematics-ip-gr46-2011',
      documentVersion: '2011',
      subject: 'Mathematics',
      phase: 'IP',
    },
    {
      documentId: 'caps-mathematics-sp-gr79-2011',
      documentVersion: '2011',
      subject: 'Mathematics',
      phase: 'SP',
    },
  ];

  it('returns the matching source by documentId', () => {
    const result = findCapsSourceByBrainDocId(
      fakeSources as unknown as Parameters<typeof findCapsSourceByBrainDocId>[0],
      'caps-mathematics-ip-gr46-2011',
    );
    expect(result).toBeDefined();
    expect((result as MinimalSource | undefined)?.documentId).toBe(
      'caps-mathematics-ip-gr46-2011',
    );
  });

  it('returns undefined when no source matches', () => {
    const result = findCapsSourceByBrainDocId(
      fakeSources as unknown as Parameters<typeof findCapsSourceByBrainDocId>[0],
      'caps-does-not-exist',
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty source list', () => {
    const result = findCapsSourceByBrainDocId(
      [] as unknown as Parameters<typeof findCapsSourceByBrainDocId>[0],
      'caps-mathematics-fp-gr-r3-2011',
    );
    expect(result).toBeUndefined();
  });

  it('returns the first match when sources list has multiple entries with same id', () => {
    const dupes: MinimalSource[] = [
      { documentId: 'caps-dup', documentVersion: 'v1', subject: 'X', phase: 'FP' },
      { documentId: 'caps-dup', documentVersion: 'v2', subject: 'X', phase: 'FP' },
    ];
    const result = findCapsSourceByBrainDocId(
      dupes as unknown as Parameters<typeof findCapsSourceByBrainDocId>[0],
      'caps-dup',
    );
    expect((result as MinimalSource | undefined)?.documentVersion).toBe('v1');
  });
});
