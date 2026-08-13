// Annotated document model and operations — Stage 24.
// An AnnotatedDocument owns its annotations and comment threads.
// All operations are pure: they return new document values, never mutate.

import { z } from 'zod';

import { type Annotation, AnnotationPayload } from './annotation.js';
import {
  AnnotationThread,
  type AnnotationReply,
  addReply,
  resolveThread,
} from './thread.js';

// ─── Document schema ──────────────────────────────────────────────────────────

export const AnnotatedDocument = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  pageCount: z.number().int().min(1),
  annotations: z.array(
    z.object({
      annotationId: z.string().min(1),
      documentId: z.string().min(1),
      authorId: z.string().min(1),
      createdAt: z.string().datetime(),
      payload: AnnotationPayload,
    }),
  ),
  threads: z.array(AnnotationThread),
});
export type AnnotatedDocument = z.infer<typeof AnnotatedDocument>;

// ─── Document factory ─────────────────────────────────────────────────────────

/** Creates an empty annotated document. */
export function createDocument(
  documentId: string,
  title: string,
  pageCount: number,
): AnnotatedDocument {
  return AnnotatedDocument.parse({
    documentId,
    title,
    pageCount,
    annotations: [],
    threads: [],
  });
}

// ─── Annotation operations ────────────────────────────────────────────────────

/**
 * Adds an annotation to the document.
 * Throws if annotation.documentId does not match doc.documentId,
 * or if annotation.payload.page exceeds doc.pageCount.
 */
export function addAnnotation(
  doc: AnnotatedDocument,
  annotation: Annotation,
): AnnotatedDocument {
  if (annotation.documentId !== doc.documentId) {
    throw new Error(
      `Annotation documentId "${annotation.documentId}" does not match document "${doc.documentId}"`,
    );
  }
  if (annotation.payload.page > doc.pageCount) {
    throw new Error(
      `Annotation page ${annotation.payload.page} exceeds document pageCount ${doc.pageCount}`,
    );
  }
  const updated = { ...doc, annotations: [...doc.annotations, annotation] };
  return AnnotatedDocument.parse(updated);
}

/**
 * Returns all annotations on a specific page, in insertion order.
 */
export function getAnnotationsForPage(
  doc: AnnotatedDocument,
  page: number,
): readonly Annotation[] {
  return doc.annotations.filter((a) => a.payload.page === page) as Annotation[];
}

// ─── Thread operations on document ───────────────────────────────────────────

/**
 * Adds a reply to the thread for a comment annotation.
 * If no thread exists yet for the annotationId, one is created automatically.
 * Throws if the annotation does not exist in the document, or is not a 'comment' type.
 */
export function addReplyToThread(
  doc: AnnotatedDocument,
  reply: AnnotationReply,
): AnnotatedDocument {
  const annotation = doc.annotations.find((a) => a.annotationId === reply.annotationId);
  if (!annotation) {
    throw new Error(
      `Annotation ${reply.annotationId} not found in document ${doc.documentId}`,
    );
  }
  if (annotation.payload.type !== 'comment') {
    throw new Error(
      `Annotation ${reply.annotationId} is type "${annotation.payload.type}", not "comment"`,
    );
  }

  const existingIdx = doc.threads.findIndex((t) => t.annotationId === reply.annotationId);
  let updatedThreads: AnnotationThread[];

  if (existingIdx === -1) {
    const newThread = addReply(
      { annotationId: reply.annotationId, replies: [], resolved: false },
      reply,
    );
    updatedThreads = [...doc.threads, newThread];
  } else {
    const updated = addReply(doc.threads[existingIdx]!, reply);
    updatedThreads = doc.threads.map((t, i) => (i === existingIdx ? updated : t));
  }

  return AnnotatedDocument.parse({ ...doc, threads: updatedThreads });
}

/**
 * Marks the thread for a comment annotation as resolved.
 * Throws if no thread exists for the annotationId.
 */
export function resolveAnnotationThread(
  doc: AnnotatedDocument,
  annotationId: string,
): AnnotatedDocument {
  const idx = doc.threads.findIndex((t) => t.annotationId === annotationId);
  if (idx === -1) {
    throw new Error(`No thread found for annotation ${annotationId}`);
  }
  const updatedThreads = doc.threads.map((t, i) => (i === idx ? resolveThread(t) : t));
  return AnnotatedDocument.parse({ ...doc, threads: updatedThreads });
}

// ─── Export ───────────────────────────────────────────────────────────────────

/** Portable export of all annotations and threads in a document. */
export const DocumentExport = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  exportedAt: z.string().datetime(),
  annotationCount: z.number().int().nonnegative(),
  annotations: z.array(
    z.object({
      annotationId: z.string().min(1),
      authorId: z.string().min(1),
      createdAt: z.string().datetime(),
      payload: AnnotationPayload,
      thread: AnnotationThread.optional(),
    }),
  ),
});
export type DocumentExport = z.infer<typeof DocumentExport>;

/**
 * Exports all annotations with their threads (for comment annotations).
 */
export function exportDocument(
  doc: AnnotatedDocument,
  exportedAt: string,
): DocumentExport {
  const threadMap = new Map(doc.threads.map((t) => [t.annotationId, t]));
  const annotations = doc.annotations.map((a) => ({
    annotationId: a.annotationId,
    authorId: a.authorId,
    createdAt: a.createdAt,
    payload: a.payload,
    ...(a.payload.type === 'comment' ? { thread: threadMap.get(a.annotationId) } : {}),
  }));
  return DocumentExport.parse({
    documentId: doc.documentId,
    title: doc.title,
    exportedAt,
    annotationCount: doc.annotations.length,
    annotations,
  });
}
