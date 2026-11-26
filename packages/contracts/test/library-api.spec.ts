// Document Studio, Task 1 — request and response contracts for the library API.

import { describe, expect, it } from 'vitest';

import {
  EditRevisionBody,
  IngestBody,
  LibraryBlock,
  LibraryDocumentDetail,
  LibraryListQuery,
  SignBody,
} from '../src/library/index.js';

const HASH = 'a'.repeat(64);
const GUID = '3f8a1c52-7d0e-4b6a-9c11-5e2d8f40b7a3';
const CONTENT = {
  title: 'Master Services Agreement',
  meta: { Owner: 'Legal' },
  blocks: [{ type: 'p', text: 'Hello' }],
};

describe('SignBody', () => {
  const ok = {
    kind: 'REVIEW',
    revisionId: GUID,
    revisionSha256: HASH,
    reason: 'Read it',
  };

  it('accepts a valid body, with and without an attestation', () => {
    expect(SignBody.safeParse(ok).success).toBe(true);
    expect(
      SignBody.safeParse({
        ...ok,
        kind: 'RATIFY',
        attestation: { name: 'A. Person', role: 'Director', scope: 'Whole document' },
      }).success,
    ).toBe(true);
  });

  it('rejects a non-hex hash', () => {
    expect(SignBody.safeParse({ ...ok, revisionSha256: 'z'.repeat(64) }).success).toBe(
      false,
    );
    expect(SignBody.safeParse({ ...ok, revisionSha256: 'abc' }).success).toBe(false);
  });

  it('rejects an empty or whitespace-only reason', () => {
    expect(SignBody.safeParse({ ...ok, reason: '' }).success).toBe(false);
    expect(SignBody.safeParse({ ...ok, reason: '   ' }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(SignBody.safeParse({ ...ok, kind: 'APPROVE' }).success).toBe(false);
  });
});

describe('EditRevisionBody', () => {
  const ok = { parentRevisionId: GUID, content: CONTENT, reason: 'Fix typo' };

  it('accepts a valid edit', () => {
    expect(EditRevisionBody.safeParse(ok).success).toBe(true);
  });

  it('rejects a block with an unknown type', () => {
    const bad = { ...ok, content: { ...CONTENT, blocks: [{ type: 'image', src: 'x' }] } };
    expect(EditRevisionBody.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty reason and a non-guid parent', () => {
    expect(EditRevisionBody.safeParse({ ...ok, reason: ' ' }).success).toBe(false);
    expect(EditRevisionBody.safeParse({ ...ok, parentRevisionId: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('IngestBody', () => {
  it('accepts a valid body and rejects a bad hash', () => {
    expect(IngestBody.safeParse({ revisionId: GUID, revisionSha256: HASH }).success).toBe(
      true,
    );
    expect(
      IngestBody.safeParse({ revisionId: GUID, revisionSha256: 'ABC' }).success,
    ).toBe(false);
  });
});

describe('LibraryBlock', () => {
  it('rejects a heading level outside 2 or 3 and a non-warn callout', () => {
    expect(LibraryBlock.safeParse({ type: 'h', level: 1, text: 'x' }).success).toBe(
      false,
    );
    expect(
      LibraryBlock.safeParse({ type: 'callout', tone: 'info', text: 'x' }).success,
    ).toBe(false);
  });

  it('accepts one of each block type', () => {
    const blocks = [
      { type: 'h', level: 2, text: 'x' },
      { type: 'p', text: 'x' },
      { type: 'ul', items: ['a'] },
      { type: 'ol', items: ['a'] },
      { type: 'kv', pairs: [['k', 'v']] },
      { type: 'table', headers: ['a'], rows: [['b']] },
      { type: 'callout', tone: 'warn', text: 'x' },
      { type: 'checklist', checks: [{ label: 'a', done: false }] },
    ];
    for (const block of blocks) expect(LibraryBlock.safeParse(block).success).toBe(true);
  });
});

describe('LibraryListQuery', () => {
  it('accepts an empty query and rejects an unknown status', () => {
    expect(LibraryListQuery.safeParse({}).success).toBe(true);
    expect(LibraryListQuery.safeParse({ status: 'DONE' }).success).toBe(false);
  });
});

describe('LibraryDocumentDetail', () => {
  const summary = {
    id: 'lib-msa',
    title: 'Master Services Agreement (school)',
    group: 'customer',
    dept: 'legal',
    kind: 'contract',
    review: 'a South African attorney',
    law: ['POPIA (Act 4 of 2013)'],
    status: 'DRAFT',
    currentRevisionId: GUID,
  };
  const allowed = { allowed: true } as const;
  const refused = { allowed: false, refusal: 'Needs a review signature first' } as const;

  it('accepts a fixture with allowedActions', () => {
    const detail = {
      document: summary,
      revisions: [
        {
          id: GUID,
          documentId: 'lib-msa',
          parentRevisionId: null,
          sha256: HASH,
          content: CONTENT,
          reason: 'Imported from the supplied library',
          createdBy: 'staff-1',
          createdAt: '2026-11-26T08:00:00.000Z',
        },
      ],
      signatures: [],
      status: 'DRAFT',
      allowedActions: {
        edit: allowed,
        review: allowed,
        countersign: refused,
        ratify: refused,
        ingest: refused,
      },
    };
    expect(LibraryDocumentDetail.safeParse(detail).success).toBe(true);
  });

  it('rejects an action refused without a reason', () => {
    const detail = {
      document: summary,
      revisions: [],
      signatures: [],
      status: 'DRAFT',
      allowedActions: {
        edit: allowed,
        review: allowed,
        countersign: { allowed: false },
        ratify: refused,
        ingest: refused,
      },
    };
    expect(LibraryDocumentDetail.safeParse(detail).success).toBe(false);
  });
});
