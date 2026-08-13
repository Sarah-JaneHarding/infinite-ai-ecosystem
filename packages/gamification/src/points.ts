// XP point values and level thresholds — Stage 22.

import { type GamificationEventType } from './events.js';

// ─── XP per event type ────────────────────────────────────────────────────────

/** Base XP awarded for each event type. */
export const XP_VALUES: Record<GamificationEventType, number> = {
  lesson_completed: 10,
  assessment_completed: 15,
  assessment_passed: 25,
  learning_streak_day: 5,
  module_completed: 100,
  gate_approved: 50,
};

/**
 * Bonus XP for high scores on assessments (score >= 80).
 * Applied on top of the base XP for assessment_passed events.
 */
export const HIGH_SCORE_BONUS_XP = 15;
export const HIGH_SCORE_THRESHOLD = 80;

// ─── Streak milestones ────────────────────────────────────────────────────────

/**
 * Streak milestone bonus XP at specific streak lengths.
 * The bonus is awarded at exactly that streak day count (not cumulatively).
 */
export const STREAK_MILESTONE_BONUS: Readonly<Record<number, number>> = {
  3: 10,
  7: 25,
  14: 50,
  30: 150,
};

// ─── Level thresholds ─────────────────────────────────────────────────────────

/**
 * Cumulative XP required to reach each level.
 * Index 0 is unused; index N is the XP floor for level N.
 * Level 1 starts at 0 XP; the maximum tracked level is 10.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [
  0, // unused sentinel
  0, // level 1
  100, // level 2
  250, // level 3
  500, // level 4
  1_000, // level 5
  2_000, // level 6
  3_500, // level 7
  5_500, // level 8
  8_000, // level 9
  12_000, // level 10
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

/**
 * Computes the level for a given cumulative XP total.
 * Returns the highest level whose threshold is <= totalXp.
 */
export function computeLevel(totalXp: number): number {
  let level = 1;
  for (let i = 2; i <= MAX_LEVEL; i++) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (threshold !== undefined && totalXp >= threshold) {
      level = i;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Computes XP earned for a lesson_completed event.
 * No score bonus applies to lesson completion.
 */
export function computeLessonXp(): number {
  return XP_VALUES.lesson_completed;
}

/**
 * Computes XP earned for an assessment_completed event.
 * Base XP only; no high-score bonus on bare completion.
 */
export function computeAssessmentCompletedXp(): number {
  return XP_VALUES.assessment_completed;
}

/**
 * Computes XP earned for an assessment_passed event.
 * Adds HIGH_SCORE_BONUS_XP when score >= HIGH_SCORE_THRESHOLD.
 */
export function computeAssessmentPassedXp(score: number): number {
  const base = XP_VALUES.assessment_passed;
  return score >= HIGH_SCORE_THRESHOLD ? base + HIGH_SCORE_BONUS_XP : base;
}

/**
 * Computes XP earned for a learning_streak_day event.
 * Includes milestone bonus when streakDays hits a milestone.
 */
export function computeStreakXp(streakDays: number): number {
  const base = XP_VALUES.learning_streak_day;
  const bonus = STREAK_MILESTONE_BONUS[streakDays] ?? 0;
  return base + bonus;
}
