// Learner progress and activity record schemas — Stage 25.
// learnerId is an opaque de-identified token; no real learner identity is stored here.
// The gamification summary mirrors the profile shape in packages/gamification — this
// package carries a lightweight snapshot so it does not take a direct dependency.

import { z } from 'zod';

// ─── Activity status ──────────────────────────────────────────────────────────

export const ActivityStatus = z.enum([
  'not_started',
  'in_progress',
  'completed',
  'blocked',
]);
export type ActivityStatus = z.infer<typeof ActivityStatus>;

// ─── Per-activity record ──────────────────────────────────────────────────────

/** One learner's recorded state for a single activity. */
export const ActivityRecord = z.object({
  activityId: z.string().min(1),
  status: ActivityStatus,
  /** Score 0–100, present only when status is 'completed'. */
  score: z.number().int().min(0).max(100).nullable().default(null),
  startedAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
});
export type ActivityRecord = z.infer<typeof ActivityRecord>;

// ─── Gamification snapshot ────────────────────────────────────────────────────

/** Lightweight read-only snapshot of the learner's gamification state. */
export const GamificationSnapshot = z.object({
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  streakDays: z.number().int().nonnegative(),
  earnedBadgeCount: z.number().int().nonnegative(),
});
export type GamificationSnapshot = z.infer<typeof GamificationSnapshot>;

// ─── Learner profile ──────────────────────────────────────────────────────────

/** A learner's full progress profile for a single enrolment (one course / module). */
export const LearnerProfile = z.object({
  /** Opaque de-identified token — not a name or SA ID. */
  learnerId: z.string().min(1),
  enrolmentId: z.string().min(1),
  courseId: z.string().min(1),
  activityRecords: z.array(ActivityRecord),
  gamification: GamificationSnapshot,
  lastActiveAt: z.string().datetime().nullable().default(null),
});
export type LearnerProfile = z.infer<typeof LearnerProfile>;

// ─── Profile helpers ──────────────────────────────────────────────────────────

/** Returns the ActivityRecord for a given activityId, or undefined. */
export function getRecord(
  profile: LearnerProfile,
  activityId: string,
): ActivityRecord | undefined {
  return profile.activityRecords.find((r) => r.activityId === activityId);
}

/**
 * Upserts an activity record: replaces an existing record with the same
 * activityId, or appends a new one.
 */
export function upsertRecord(
  profile: LearnerProfile,
  record: ActivityRecord,
): LearnerProfile {
  const exists = profile.activityRecords.some((r) => r.activityId === record.activityId);
  const activityRecords = exists
    ? profile.activityRecords.map((r) =>
        r.activityId === record.activityId ? record : r,
      )
    : [...profile.activityRecords, record];
  return LearnerProfile.parse({ ...profile, activityRecords });
}

/** Returns true if all provided activityIds have status 'completed'. */
export function allCompleted(
  profile: LearnerProfile,
  activityIds: readonly string[],
): boolean {
  return activityIds.every(
    (id) =>
      profile.activityRecords.find((r) => r.activityId === id)?.status === 'completed',
  );
}

/** Counts activities by status. */
export function countByStatus(profile: LearnerProfile): Record<ActivityStatus, number> {
  const counts: Record<ActivityStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
  };
  for (const r of profile.activityRecords) {
    counts[r.status]++;
  }
  return counts;
}
