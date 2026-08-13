// Gamification engine — Stage 22.
// Pure function: event + current profile → update record.
// No I/O, no DB, no model calls.

import { z } from 'zod';

import { evaluateBadges } from './badges.js';
import { type GamificationEvent, type LearnerGamificationProfile } from './events.js';
import {
  XP_VALUES,
  computeAssessmentCompletedXp,
  computeAssessmentPassedXp,
  computeLevel,
  computeLessonXp,
  computeStreakXp,
} from './points.js';

// ─── Output schema ────────────────────────────────────────────────────────────

export const GamificationUpdate = z.object({
  profileId: z.string().min(1),
  /** XP earned by this event (0 or positive). */
  xpEarned: z.number().int().nonnegative(),
  /** New cumulative XP total. */
  newTotalXp: z.number().int().nonnegative(),
  /** Previous level before this event. */
  previousLevel: z.number().int().min(1),
  /** Current level after applying XP. */
  newLevel: z.number().int().min(1),
  /** True when newLevel > previousLevel. */
  leveledUp: z.boolean(),
  /** Previous streak count (days). */
  previousStreakDays: z.number().int().nonnegative(),
  /** Streak count after this event. */
  newStreakDays: z.number().int().nonnegative(),
  /** Badge IDs newly awarded by this event. */
  newBadgeIds: z.array(z.string()),
  /** Combined earned badge IDs (pre-existing + newly awarded). */
  allEarnedBadgeIds: z.array(z.string()),
});
export type GamificationUpdate = z.infer<typeof GamificationUpdate>;

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Processes a single gamification event against a learner's current profile
 * and returns the resulting update.
 *
 * The returned update is a value object — callers are responsible for
 * persisting the new state (xp, level, streakDays, earnedBadgeIds) back
 * to the profile store.
 */
export function processEvent(
  event: GamificationEvent,
  profile: LearnerGamificationProfile,
): GamificationUpdate {
  const xpEarned = computeXpEarned(event);
  const newTotalXp = profile.xp + xpEarned;
  const previousLevel = profile.level;
  const newLevel = computeLevel(newTotalXp);
  const leveledUp = newLevel > previousLevel;

  const previousStreakDays = profile.streakDays;
  const newStreakDays = resolveNewStreakDays(event, previousStreakDays);

  const earnedSet = new Set(profile.earnedBadgeIds);
  const newBadgeIds = evaluateBadges({
    event,
    newLevel,
    newStreakDays,
    earnedBadgeIds: earnedSet,
  });

  const allEarnedBadgeIds = [...profile.earnedBadgeIds, ...newBadgeIds];

  return GamificationUpdate.parse({
    profileId: profile.profileId,
    xpEarned,
    newTotalXp,
    previousLevel,
    newLevel,
    leveledUp,
    previousStreakDays,
    newStreakDays,
    newBadgeIds,
    allEarnedBadgeIds,
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function computeXpEarned(event: GamificationEvent): number {
  switch (event.type) {
    case 'lesson_completed':
      return computeLessonXp();
    case 'assessment_completed':
      return computeAssessmentCompletedXp();
    case 'assessment_passed':
      return computeAssessmentPassedXp(event.score);
    case 'learning_streak_day':
      return computeStreakXp(event.streakDays);
    case 'module_completed':
      return XP_VALUES.module_completed;
    case 'gate_approved':
      return XP_VALUES.gate_approved;
  }
}

function resolveNewStreakDays(
  event: GamificationEvent,
  previousStreakDays: number,
): number {
  if (event.type === 'learning_streak_day') {
    return event.streakDays;
  }
  return previousStreakDays;
}
