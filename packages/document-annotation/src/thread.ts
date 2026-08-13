// Threaded reply model for comment annotations — Stage 24.
// A comment annotation can have zero or more replies, forming a thread.
// Resolving a thread marks it closed; replies can still be read.

import { z } from 'zod';

// ─── Reply schema ─────────────────────────────────────────────────────────────

/** A reply to a comment annotation thread. */
export const AnnotationReply = z.object({
  replyId: z.string().min(1),
  annotationId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type AnnotationReply = z.infer<typeof AnnotationReply>;

// ─── Thread schema ────────────────────────────────────────────────────────────

/** Aggregated thread for one comment annotation. */
export const AnnotationThread = z.object({
  annotationId: z.string().min(1),
  replies: z.array(AnnotationReply),
  resolved: z.boolean(),
});
export type AnnotationThread = z.infer<typeof AnnotationThread>;

// ─── Thread operations ────────────────────────────────────────────────────────

/**
 * Creates a new empty thread for a comment annotation.
 */
export function createThread(annotationId: string): AnnotationThread {
  return AnnotationThread.parse({ annotationId, replies: [], resolved: false });
}

/**
 * Adds a reply to a thread. Throws if the thread is already resolved.
 */
export function addReply(
  thread: AnnotationThread,
  reply: AnnotationReply,
): AnnotationThread {
  if (thread.resolved) {
    throw new Error(
      `Thread ${thread.annotationId} is resolved — cannot add further replies`,
    );
  }
  if (reply.annotationId !== thread.annotationId) {
    throw new Error(
      `Reply annotationId ${reply.annotationId} does not match thread ${thread.annotationId}`,
    );
  }
  return AnnotationThread.parse({ ...thread, replies: [...thread.replies, reply] });
}

/**
 * Marks a thread as resolved. Idempotent — resolving an already-resolved thread is a no-op.
 */
export function resolveThread(thread: AnnotationThread): AnnotationThread {
  if (thread.resolved) return thread;
  return AnnotationThread.parse({ ...thread, resolved: true });
}
