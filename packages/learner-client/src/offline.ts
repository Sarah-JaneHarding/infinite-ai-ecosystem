// Offline event queue — Stage 25.
// On a low-bandwidth device a learner may submit quiz answers or complete
// activities while offline. This module models the queue of pending events
// waiting to be synced to the server. The actual HTTP sync is infrastructure;
// this package owns only the queue data model and its operations.

import { z } from 'zod';

// ─── Event payload types ──────────────────────────────────────────────────────

export const QuizAnsweredPayload = z.object({
  type: z.literal('quiz_answered'),
  activityId: z.string().min(1),
  questionId: z.string().min(1),
  selectedSide: z.enum(['A', 'B', 'C', 'D']),
});

export const ActivityCompletedPayload = z.object({
  type: z.literal('activity_completed'),
  activityId: z.string().min(1),
  score: z.number().int().min(0).max(100).nullable(),
});

export const AssessmentSubmittedPayload = z.object({
  type: z.literal('assessment_submitted'),
  activityId: z.string().min(1),
  /** Opaque token referencing the low-tech scan session — not a learner identifier. */
  sessionRef: z.string().min(1),
});

export const OfflineEventPayload = z.union([
  QuizAnsweredPayload,
  ActivityCompletedPayload,
  AssessmentSubmittedPayload,
]);
export type OfflineEventPayload = z.infer<typeof OfflineEventPayload>;

// ─── Queue entry ──────────────────────────────────────────────────────────────

export const OfflineEvent = z.object({
  eventId: z.string().min(1),
  learnerId: z.string().min(1),
  occurredAt: z.string().datetime(),
  payload: OfflineEventPayload,
});
export type OfflineEvent = z.infer<typeof OfflineEvent>;

// ─── Queue ────────────────────────────────────────────────────────────────────

export const OfflineQueue = z.object({
  learnerId: z.string().min(1),
  events: z.array(OfflineEvent),
});
export type OfflineQueue = z.infer<typeof OfflineQueue>;

// ─── Queue operations ─────────────────────────────────────────────────────────

/** Creates an empty queue for a learner. */
export function createQueue(learnerId: string): OfflineQueue {
  return OfflineQueue.parse({ learnerId, events: [] });
}

/**
 * Enqueues an event. Throws if the event's learnerId does not match the queue.
 */
export function enqueue(queue: OfflineQueue, event: OfflineEvent): OfflineQueue {
  if (event.learnerId !== queue.learnerId) {
    throw new Error(
      `Event learnerId "${event.learnerId}" does not match queue learnerId "${queue.learnerId}"`,
    );
  }
  return OfflineQueue.parse({ ...queue, events: [...queue.events, event] });
}

/**
 * Removes a successfully synced event by eventId.
 * Returns the queue unchanged if the eventId is not found (idempotent).
 */
export function dequeue(queue: OfflineQueue, eventId: string): OfflineQueue {
  return OfflineQueue.parse({
    ...queue,
    events: queue.events.filter((e) => e.eventId !== eventId),
  });
}

/** Number of events waiting to be synced. */
export function pendingCount(queue: OfflineQueue): number {
  return queue.events.length;
}

/** Returns the oldest pending event, or undefined if the queue is empty. */
export function peek(queue: OfflineQueue): OfflineEvent | undefined {
  return queue.events[0];
}
