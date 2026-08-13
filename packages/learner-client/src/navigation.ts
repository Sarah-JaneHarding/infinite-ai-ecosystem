// Course navigation — Stage 25.
// A course is a directed graph of activities connected by prerequisite edges.
// The navigation engine computes which activities are unlocked given the set
// of already-completed activity IDs, without accessing a database.

import { z } from 'zod';

// ─── Graph schemas ────────────────────────────────────────────────────────────

export const ActivityType = z.enum(['lesson', 'quiz', 'assessment', 'reading', 'video']);
export type ActivityType = z.infer<typeof ActivityType>;

/** A node in the course activity graph. */
export const ActivityNode = z.object({
  activityId: z.string().min(1),
  title: z.string().min(1),
  type: ActivityType,
  /** IDs of activities that must be completed before this one is unlocked. */
  prerequisites: z.array(z.string()),
  /** Estimated time to complete in minutes. */
  estimatedMinutes: z.number().int().positive(),
});
export type ActivityNode = z.infer<typeof ActivityNode>;

/** Directed graph of all activities in a course. */
export const CourseGraph = z.object({
  courseId: z.string().min(1),
  activities: z.array(ActivityNode).min(1),
});
export type CourseGraph = z.infer<typeof CourseGraph>;

// ─── Navigation functions ─────────────────────────────────────────────────────

/**
 * Returns true if all prerequisites for the given activity have been completed.
 * Activities with no prerequisites are always unlocked.
 */
export function isUnlocked(
  graph: CourseGraph,
  activityId: string,
  completedIds: ReadonlySet<string>,
): boolean {
  const node = graph.activities.find((a) => a.activityId === activityId);
  if (!node) return false;
  return node.prerequisites.every((prereq) => completedIds.has(prereq));
}

/**
 * Returns activities that are unlocked but not yet completed, in graph order.
 */
export function nextActivities(
  graph: CourseGraph,
  completedIds: ReadonlySet<string>,
): readonly ActivityNode[] {
  return graph.activities.filter(
    (a) =>
      !completedIds.has(a.activityId) && isUnlocked(graph, a.activityId, completedIds),
  );
}

/**
 * Returns all activities that have been unlocked (completed or not), in graph order.
 */
export function unlockedActivities(
  graph: CourseGraph,
  completedIds: ReadonlySet<string>,
): readonly ActivityNode[] {
  return graph.activities.filter((a) => isUnlocked(graph, a.activityId, completedIds));
}

/**
 * Computes overall course progress as a 0–1 ratio of completed / total activities.
 */
export function courseProgress(
  graph: CourseGraph,
  completedIds: ReadonlySet<string>,
): number {
  if (graph.activities.length === 0) return 0;
  const completed = graph.activities.filter((a) => completedIds.has(a.activityId)).length;
  return completed / graph.activities.length;
}
