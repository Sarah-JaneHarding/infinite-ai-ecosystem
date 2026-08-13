// Unit tests — Stage 24 (Document Annotation).
// Happy path + at least two failure paths per area.

import { describe, expect, it } from 'vitest';

import {
  Annotation,
  AnnotatedDocument,
  AnnotationReply,
  AnnotationThread,
  DocumentExport,
  FreehandPayload,
  HexColor,
  HighlightPayload,
  addAnnotation,
  addReply,
  addReplyToThread,
  createDocument,
  createThread,
  exportDocument,
  getAnnotationsForPage,
  resolveAnnotationThread,
  resolveThread,
} from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOC_ID = 'doc-001';
const AUTHOR = 'author-token-abc';
const NOW = '2026-08-13T10:00:00Z';

function makeDoc(pageCount = 5): AnnotatedDocument {
  return createDocument(DOC_ID, 'Test Document', pageCount);
}

function makeAnnotation(
  id: string,
  type: 'highlight' | 'comment' | 'text_box' | 'freehand' | 'stamp' = 'highlight',
  page = 1,
): Annotation {
  const payloads: Record<string, object> = {
    highlight: {
      type: 'highlight',
      page,
      startOffset: 0,
      endOffset: 10,
      color: '#FF0000',
    },
    comment: { type: 'comment', page, x: 10, y: 20, body: 'A comment' },
    text_box: {
      type: 'text_box',
      page,
      x: 5,
      y: 5,
      width: 100,
      height: 50,
      body: 'Hello',
    },
    freehand: {
      type: 'freehand',
      page,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      color: '#0000FF',
      strokeWidth: 2,
    },
    stamp: { type: 'stamp', page, x: 50, y: 50, label: 'Excellent' },
  };
  return Annotation.parse({
    annotationId: id,
    documentId: DOC_ID,
    authorId: AUTHOR,
    createdAt: NOW,
    payload: payloads[type],
  });
}

function makeReply(replyId: string, annotationId: string): AnnotationReply {
  return AnnotationReply.parse({
    replyId,
    annotationId,
    authorId: AUTHOR,
    body: 'A reply',
    createdAt: NOW,
  });
}

// ─── HexColor schema ──────────────────────────────────────────────────────────

describe('HexColor schema', () => {
  it('accepts a valid 6-digit hex colour', () => {
    expect(HexColor.parse('#FFDD00')).toBe('#FFDD00');
  });

  it('rejects a colour without leading #', () => {
    expect(HexColor.safeParse('FF0000').success).toBe(false);
  });

  it('rejects a 3-digit shorthand', () => {
    expect(HexColor.safeParse('#F00').success).toBe(false);
  });
});

// ─── HighlightPayload schema ──────────────────────────────────────────────────

describe('HighlightPayload schema', () => {
  it('parses a valid highlight', () => {
    const result = HighlightPayload.safeParse({
      type: 'highlight',
      page: 1,
      startOffset: 0,
      endOffset: 10,
      color: '#FFFF00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when startOffset >= endOffset', () => {
    expect(
      HighlightPayload.safeParse({
        type: 'highlight',
        page: 1,
        startOffset: 10,
        endOffset: 10,
        color: '#FF0000',
      }).success,
    ).toBe(false);
  });

  it('rejects page < 1', () => {
    expect(
      HighlightPayload.safeParse({
        type: 'highlight',
        page: 0,
        startOffset: 0,
        endOffset: 5,
        color: '#FF0000',
      }).success,
    ).toBe(false);
  });
});

// ─── FreehandPayload schema ───────────────────────────────────────────────────

describe('FreehandPayload schema', () => {
  it('parses a valid freehand stroke', () => {
    const result = FreehandPayload.safeParse({
      type: 'freehand',
      page: 2,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 3 },
      ],
      color: '#000000',
      strokeWidth: 1.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects fewer than 2 points', () => {
    expect(
      FreehandPayload.safeParse({
        type: 'freehand',
        page: 1,
        points: [{ x: 0, y: 0 }],
        color: '#000000',
        strokeWidth: 1,
      }).success,
    ).toBe(false);
  });

  it('rejects non-positive strokeWidth', () => {
    expect(
      FreehandPayload.safeParse({
        type: 'freehand',
        page: 1,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: '#000000',
        strokeWidth: 0,
      }).success,
    ).toBe(false);
  });
});

// ─── createDocument ───────────────────────────────────────────────────────────

describe('createDocument', () => {
  it('creates a document with empty annotations and threads', () => {
    const doc = createDocument('d1', 'My Doc', 10);
    expect(doc.documentId).toBe('d1');
    expect(doc.title).toBe('My Doc');
    expect(doc.pageCount).toBe(10);
    expect(doc.annotations).toHaveLength(0);
    expect(doc.threads).toHaveLength(0);
  });

  it('AnnotatedDocument schema rejects pageCount < 1', () => {
    expect(
      AnnotatedDocument.safeParse({
        documentId: 'd1',
        title: 'X',
        pageCount: 0,
        annotations: [],
        threads: [],
      }).success,
    ).toBe(false);
  });
});

// ─── addAnnotation ────────────────────────────────────────────────────────────

describe('addAnnotation', () => {
  it('adds each annotation type successfully', () => {
    const types = ['highlight', 'comment', 'text_box', 'freehand', 'stamp'] as const;
    let doc = makeDoc();
    types.forEach((type, i) => {
      doc = addAnnotation(doc, makeAnnotation(`ann-${i}`, type));
    });
    expect(doc.annotations).toHaveLength(5);
  });

  it('throws when annotation documentId does not match', () => {
    const doc = makeDoc();
    const bad = Annotation.parse({
      ...makeAnnotation('a1'),
      documentId: 'wrong-doc',
    });
    expect(() => addAnnotation(doc, bad)).toThrow();
  });

  it('throws when annotation page exceeds pageCount', () => {
    const doc = makeDoc(3);
    const bad = makeAnnotation('a1', 'highlight', 4);
    expect(() => addAnnotation(doc, bad)).toThrow();
  });
});

// ─── getAnnotationsForPage ────────────────────────────────────────────────────

describe('getAnnotationsForPage', () => {
  it('returns only annotations on the requested page', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'highlight', 1));
    doc = addAnnotation(doc, makeAnnotation('a2', 'comment', 2));
    doc = addAnnotation(doc, makeAnnotation('a3', 'stamp', 1));
    expect(getAnnotationsForPage(doc, 1)).toHaveLength(2);
    expect(getAnnotationsForPage(doc, 2)).toHaveLength(1);
  });

  it('returns an empty array for a page with no annotations', () => {
    const doc = makeDoc();
    expect(getAnnotationsForPage(doc, 1)).toHaveLength(0);
  });
});

// ─── thread operations ────────────────────────────────────────────────────────

describe('createThread', () => {
  it('creates an unresolved thread with no replies', () => {
    const thread = createThread('ann-1');
    expect(thread.annotationId).toBe('ann-1');
    expect(thread.replies).toHaveLength(0);
    expect(thread.resolved).toBe(false);
  });
});

describe('addReply', () => {
  it('appends a reply to the thread', () => {
    const thread = createThread('ann-1');
    const reply = makeReply('r1', 'ann-1');
    const updated = addReply(thread, reply);
    expect(updated.replies).toHaveLength(1);
    expect(updated.replies[0]?.replyId).toBe('r1');
  });

  it('throws when adding to a resolved thread', () => {
    const thread = resolveThread(createThread('ann-1'));
    expect(() => addReply(thread, makeReply('r1', 'ann-1'))).toThrow();
  });

  it('throws when reply annotationId mismatches thread', () => {
    const thread = createThread('ann-1');
    const badReply = makeReply('r1', 'ann-999');
    expect(() => addReply(thread, badReply)).toThrow();
  });
});

describe('resolveThread', () => {
  it('marks the thread resolved', () => {
    const thread = resolveThread(createThread('ann-1'));
    expect(thread.resolved).toBe(true);
  });

  it('is idempotent — resolving an already-resolved thread is a no-op', () => {
    const thread = resolveThread(createThread('ann-1'));
    const again = resolveThread(thread);
    expect(again.resolved).toBe(true);
    expect(again.replies).toHaveLength(0);
  });
});

// ─── addReplyToThread (document-level) ───────────────────────────────────────

describe('addReplyToThread', () => {
  it('creates the thread and adds the reply when no thread exists yet', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'comment'));
    doc = addReplyToThread(doc, makeReply('r1', 'a1'));
    expect(doc.threads).toHaveLength(1);
    expect(doc.threads[0]?.replies).toHaveLength(1);
  });

  it('appends to an existing thread', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'comment'));
    doc = addReplyToThread(doc, makeReply('r1', 'a1'));
    doc = addReplyToThread(doc, makeReply('r2', 'a1'));
    expect(doc.threads[0]?.replies).toHaveLength(2);
  });

  it('throws when the annotation does not exist', () => {
    const doc = makeDoc();
    expect(() => addReplyToThread(doc, makeReply('r1', 'nonexistent'))).toThrow();
  });

  it('throws when the annotation is not a comment', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'highlight'));
    expect(() => addReplyToThread(doc, makeReply('r1', 'a1'))).toThrow();
  });
});

// ─── resolveAnnotationThread ──────────────────────────────────────────────────

describe('resolveAnnotationThread', () => {
  it('marks the thread as resolved', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'comment'));
    doc = addReplyToThread(doc, makeReply('r1', 'a1'));
    doc = resolveAnnotationThread(doc, 'a1');
    expect(doc.threads[0]?.resolved).toBe(true);
  });

  it('throws when no thread exists for the annotation', () => {
    const doc = makeDoc();
    expect(() => resolveAnnotationThread(doc, 'nonexistent')).toThrow();
  });
});

// ─── exportDocument ───────────────────────────────────────────────────────────

describe('exportDocument', () => {
  it('exports all annotations with the correct count', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'highlight'));
    doc = addAnnotation(doc, makeAnnotation('a2', 'stamp'));
    const result = exportDocument(doc, NOW);
    expect(result.annotationCount).toBe(2);
    expect(result.annotations).toHaveLength(2);
  });

  it('includes thread for comment annotations in the export', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'comment'));
    doc = addReplyToThread(doc, makeReply('r1', 'a1'));
    const result = exportDocument(doc, NOW);
    const exported = result.annotations.find((a) => a.annotationId === 'a1');
    expect(exported?.thread?.replies).toHaveLength(1);
  });

  it('does not attach a thread to non-comment annotations', () => {
    let doc = makeDoc();
    doc = addAnnotation(doc, makeAnnotation('a1', 'highlight'));
    const result = exportDocument(doc, NOW);
    expect(result.annotations[0]?.thread).toBeUndefined();
  });

  it('DocumentExport schema validates exportedAt as ISO datetime', () => {
    expect(
      DocumentExport.safeParse({
        documentId: 'd1',
        title: 'X',
        exportedAt: 'not-a-date',
        annotationCount: 0,
        annotations: [],
      }).success,
    ).toBe(false);
  });
});

// ─── AnnotationThread schema ──────────────────────────────────────────────────

describe('AnnotationThread schema', () => {
  it('parses a valid thread', () => {
    expect(
      AnnotationThread.safeParse({ annotationId: 'a1', replies: [], resolved: false })
        .success,
    ).toBe(true);
  });

  it('rejects empty annotationId', () => {
    expect(
      AnnotationThread.safeParse({ annotationId: '', replies: [], resolved: false })
        .success,
    ).toBe(false);
  });
});
