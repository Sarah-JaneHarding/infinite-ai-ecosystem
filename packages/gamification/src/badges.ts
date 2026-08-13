// Badge definitions and earning criteria — Stage 22.
// Badges are static definitions; the engine decides when to award them.

import { z } from 'zod';

import { type GamificationEvent } from './events.js';

// ─── Badge schema ─────────────────────────────────────────────────────────────

export const BadgeCategory = z.enum([
  'learning',
  'assessment',
  'streak',
  'completion',
  'milestone',
]);
export type BadgeCategory = z.infer<typeof BadgeCategory>;

export const BadgeDefinition = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: BadgeCategory,
  /** XP level gate — learner must be at or above this level to be eligible. */
  minLevel: z.number().int().min(1).default(1),
});
export type BadgeDefinition = z.infer<typeof BadgeDefinition>;

// ─── Badge catalogue ──────────────────────────────────────────────────────────

export const BADGE_CATALOGUE: readonly BadgeDefinition[] = [
  // Learning badges
  {
    id: 'first_lesson',
    name: 'First Step',
    description: 'Completed your first lesson.',
    category: 'learning',
    minLevel: 1,
  },
  {
    id: 'assessment_ace',
    name: 'Assessment Ace',
    description: 'Passed an assessment with a score of 80% or higher.',
    category: 'assessment',
    minLevel: 1,
  },
  {
    id: 'perfect_score',
    name: 'Perfect Score',
    description: 'Achieved 100% on an assessment.',
    category: 'assessment',
    minLevel: 1,
  },
  // Streak badges
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Maintained a 3-day learning streak.',
    category: 'streak',
    minLevel: 1,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintained a 7-day learning streak.',
    category: 'streak',
    minLevel: 1,
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintained a 30-day learning streak.',
    category: 'streak',
    minLevel: 2,
  },
  // Completion badges
  {
    id: 'module_complete',
    name: 'Module Champion',
    description: 'Completed a full module.',
    category: 'completion',
    minLevel: 1,
  },
  {
    id: 'gate_cleared',
    name: 'Gate Cleared',
    description: 'Had a human-in-the-loop gate approved.',
    category: 'completion',
    minLevel: 1,
  },
  // Milestone badges
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reached level 5.',
    category: 'milestone',
    minLevel: 5,
  },
  {
    id: 'level_10',
    name: 'Expert Learner',
    description: 'Reached level 10.',
    category: 'milestone',
    minLevel: 10,
  },
];

const _badgeMap = new Map(BADGE_CATALOGUE.map((b) => [b.id, b]));

/** Returns a badge definition by ID, or undefined if not found. */
export function getBadge(id: string): BadgeDefinition | undefined {
  return _badgeMap.get(id);
}

// ─── Badge evaluation ─────────────────────────────────────────────────────────

export interface BadgeContext {
  readonly event: GamificationEvent;
  readonly newLevel: number;
  readonly newStreakDays: number;
  readonly earnedBadgeIds: ReadonlySet<string>;
}

/**
 * Returns the IDs of badges newly earned given the event context.
 * A badge is awarded when:
 *   1. The learner is not already holding it.
 *   2. The learner's new level >= badge.minLevel.
 *   3. The event satisfies the badge's trigger condition.
 */
export function evaluateBadges(ctx: BadgeContext): readonly string[] {
  const { event, newLevel, newStreakDays, earnedBadgeIds } = ctx;
  const awarded: string[] = [];

  function award(id: string): void {
    const def = _badgeMap.get(id);
    if (def && !earnedBadgeIds.has(id) && newLevel >= def.minLevel) {
      awarded.push(id);
    }
  }

  switch (event.type) {
    case 'lesson_completed':
      award('first_lesson');
      break;

    case 'assessment_passed': {
      const { score } = event;
      if (score >= 80) award('assessment_ace');
      if (score === 100) award('perfect_score');
      break;
    }

    case 'learning_streak_day':
      if (newStreakDays >= 3) award('streak_3');
      if (newStreakDays >= 7) award('streak_7');
      if (newStreakDays >= 30) award('streak_30');
      break;

    case 'module_completed':
      award('module_complete');
      break;

    case 'gate_approved':
      award('gate_cleared');
      break;

    case 'assessment_completed':
      // No badge tied to bare completion (only passing earns badges).
      break;
  }

  // Level milestone badges — checked on every event.
  if (newLevel >= 5) award('level_5');
  if (newLevel >= 10) award('level_10');

  return awarded;
}
