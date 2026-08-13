// Pure helpers for the learner surface — Stage 26.
// All functions are stateless and depend only on @infinite-ai/learner-client types;
// no DB access, no model calls, no PII. learnerId is an opaque de-identified token.

import type {
  LearnerProfileShape,
  CourseGraphShape,
  ActivityNodeShape,
  GamificationSnapshotShape,
  ActivityStatusValue,
} from '@infinite-ai/learner-client';
import {
  nextActivities,
  courseProgress,
  countByStatus,
} from '@infinite-ai/learner-client';

export interface LearnerState {
  readonly availableActivities: readonly ActivityNodeShape[];
  readonly progress: number;
  readonly gamification: GamificationSnapshotShape;
  readonly statusCounts: Record<ActivityStatusValue, number>;
  readonly totalActivities: number;
}

/** Derives the UI state from a learner profile and its course graph. */
export function computeLearnerState(
  graph: CourseGraphShape,
  profile: LearnerProfileShape,
): LearnerState {
  const completedIds = new Set(
    profile.activityRecords
      .filter((r) => r.status === 'completed')
      .map((r) => r.activityId),
  );
  return {
    availableActivities: nextActivities(graph, completedIds),
    progress: courseProgress(graph, completedIds),
    gamification: profile.gamification,
    statusCounts: countByStatus(profile),
    totalActivities: graph.activities.length,
  };
}

const ACTIVITY_TYPE_EMOJI: Record<string, string> = {
  lesson: '📖',
  quiz: '❓',
  assessment: '📝',
  reading: '📑',
  video: '🎬',
};

/** Returns an emoji for an activity type, falling back to ✏️. */
export function activityTypeEmoji(type: string): string {
  return ACTIVITY_TYPE_EMOJI[type] ?? '✏️';
}

/** Typed demo course graph used by the stub learner surface. */
export function buildSampleGraph(): CourseGraphShape {
  return {
    courseId: 'demo-mathematics-grade-7',
    activities: [
      {
        activityId: 'act-1',
        title: 'Integers and the number line',
        type: 'lesson',
        prerequisites: [],
        estimatedMinutes: 20,
      },
      {
        activityId: 'act-2',
        title: 'Adding and subtracting integers',
        type: 'lesson',
        prerequisites: ['act-1'],
        estimatedMinutes: 25,
      },
      {
        activityId: 'act-3',
        title: 'Integers — quick quiz',
        type: 'quiz',
        prerequisites: ['act-1', 'act-2'],
        estimatedMinutes: 10,
      },
      {
        activityId: 'act-4',
        title: 'Multiplying integers',
        type: 'lesson',
        prerequisites: ['act-3'],
        estimatedMinutes: 20,
      },
      {
        activityId: 'act-5',
        title: 'Dividing integers',
        type: 'reading',
        prerequisites: ['act-3'],
        estimatedMinutes: 15,
      },
      {
        activityId: 'act-6',
        title: 'Integers — end-of-unit assessment',
        type: 'assessment',
        prerequisites: ['act-4', 'act-5'],
        estimatedMinutes: 30,
      },
    ],
  };
}

/** Typed demo learner profile used by the stub learner surface.
 *  learnerId is the opaque de-identified token from the session. */
export function buildSampleProfile(learnerId: string): LearnerProfileShape {
  return {
    learnerId,
    enrolmentId: 'enrol-demo-001',
    courseId: 'demo-mathematics-grade-7',
    activityRecords: [
      {
        activityId: 'act-1',
        status: 'completed',
        score: 90,
        startedAt: '2026-08-01T08:00:00Z',
        completedAt: '2026-08-01T08:20:00Z',
      },
      {
        activityId: 'act-2',
        status: 'in_progress',
        score: null,
        startedAt: '2026-08-02T09:00:00Z',
        completedAt: null,
      },
    ],
    gamification: { xp: 150, level: 2, streakDays: 5, earnedBadgeCount: 2 },
    lastActiveAt: '2026-08-13T08:00:00Z',
  };
}
