// Unit tests — Stage 22 (Game-Based Learning).
// Happy path + at least two failure paths per area.

import { describe, expect, it } from 'vitest';

import {
  BADGE_CATALOGUE,
  LEVEL_THRESHOLDS,
  LearnerGamificationProfile,
  MAX_LEVEL,
  XP_VALUES,
  computeAssessmentPassedXp,
  computeLevel,
  computeStreakXp,
  evaluateBadges,
  GamificationEvent,
  getBadge,
  processEvent,
} from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProfile(
  overrides?: Partial<{
    xp: number;
    level: number;
    streakDays: number;
    earnedBadgeIds: string[];
  }>,
): ReturnType<typeof LearnerGamificationProfile.parse> {
  return LearnerGamificationProfile.parse({
    profileId: 'profile-001',
    xp: 0,
    level: 1,
    streakDays: 0,
    earnedBadgeIds: [],
    ...overrides,
  });
}

const NOW = '2026-08-13T08:00:00Z';

// ─── events.ts — GamificationEvent schema ────────────────────────────────────

describe('GamificationEvent schema', () => {
  it('parses a valid lesson_completed event', () => {
    const result = GamificationEvent.safeParse({
      type: 'lesson_completed',
      profileId: 'p-1',
      occurredAt: NOW,
      lessonId: 'lesson-42',
    });
    expect(result.success).toBe(true);
  });

  it('rejects lesson_completed with empty profileId', () => {
    const result = GamificationEvent.safeParse({
      type: 'lesson_completed',
      profileId: '',
      occurredAt: NOW,
      lessonId: 'lesson-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects assessment_passed with score > 100', () => {
    const result = GamificationEvent.safeParse({
      type: 'assessment_passed',
      profileId: 'p-1',
      occurredAt: NOW,
      assessmentId: 'a-1',
      score: 105,
    });
    expect(result.success).toBe(false);
  });

  it('rejects learning_streak_day with streakDays < 1', () => {
    const result = GamificationEvent.safeParse({
      type: 'learning_streak_day',
      profileId: 'p-1',
      occurredAt: NOW,
      streakDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it('parses a gate_approved event', () => {
    const result = GamificationEvent.safeParse({
      type: 'gate_approved',
      profileId: 'p-1',
      occurredAt: NOW,
      gateId: 'gate-001',
    });
    expect(result.success).toBe(true);
  });
});

// ─── points.ts — computeLevel ─────────────────────────────────────────────────

describe('computeLevel', () => {
  it('returns level 1 at 0 XP', () => {
    expect(computeLevel(0)).toBe(1);
  });

  it('returns level 2 at exactly the level-2 threshold', () => {
    const threshold = LEVEL_THRESHOLDS[2] ?? 100;
    expect(computeLevel(threshold)).toBe(2);
  });

  it('returns max level when XP exceeds all thresholds', () => {
    expect(computeLevel(999_999)).toBe(MAX_LEVEL);
  });

  it('returns level 1 for 1 XP (below level-2 threshold)', () => {
    expect(computeLevel(1)).toBe(1);
  });

  it('advances to level 5 at the right threshold', () => {
    const threshold = LEVEL_THRESHOLDS[5] ?? 1000;
    expect(computeLevel(threshold)).toBe(5);
    expect(computeLevel(threshold - 1)).toBe(4);
  });
});

// ─── points.ts — computeAssessmentPassedXp ───────────────────────────────────

describe('computeAssessmentPassedXp', () => {
  it('returns base XP for a score below the high-score threshold', () => {
    const xp = computeAssessmentPassedXp(70);
    expect(xp).toBe(XP_VALUES.assessment_passed);
  });

  it('adds a bonus for a score at exactly the high-score threshold', () => {
    const xp = computeAssessmentPassedXp(80);
    expect(xp).toBeGreaterThan(XP_VALUES.assessment_passed);
  });

  it('adds a bonus for a perfect score', () => {
    const xp100 = computeAssessmentPassedXp(100);
    const xp79 = computeAssessmentPassedXp(79);
    expect(xp100).toBeGreaterThan(xp79);
  });
});

// ─── points.ts — computeStreakXp ─────────────────────────────────────────────

describe('computeStreakXp', () => {
  it('returns base XP for a non-milestone streak day', () => {
    const xp = computeStreakXp(2);
    expect(xp).toBe(XP_VALUES.learning_streak_day);
  });

  it('adds milestone bonus at 7 days', () => {
    const xp = computeStreakXp(7);
    expect(xp).toBeGreaterThan(XP_VALUES.learning_streak_day);
  });

  it('adds milestone bonus at 30 days', () => {
    const xp30 = computeStreakXp(30);
    const xp1 = computeStreakXp(1);
    expect(xp30).toBeGreaterThan(xp1);
  });
});

// ─── badges.ts — BADGE_CATALOGUE ─────────────────────────────────────────────

describe('BADGE_CATALOGUE', () => {
  it('contains at least 5 badge definitions', () => {
    expect(BADGE_CATALOGUE.length).toBeGreaterThanOrEqual(5);
  });

  it('has unique badge IDs', () => {
    const ids = BADGE_CATALOGUE.map((b) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every badge has a non-empty name and description', () => {
    for (const badge of BADGE_CATALOGUE) {
      expect(badge.name.length).toBeGreaterThan(0);
      expect(badge.description.length).toBeGreaterThan(0);
    }
  });
});

describe('getBadge', () => {
  it('returns the badge for a known ID', () => {
    const badge = getBadge('first_lesson');
    expect(badge).toBeDefined();
    expect(badge?.id).toBe('first_lesson');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getBadge('not-a-real-badge')).toBeUndefined();
  });
});

// ─── badges.ts — evaluateBadges ──────────────────────────────────────────────

describe('evaluateBadges', () => {
  it('awards first_lesson on the first lesson_completed event', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'p-1',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      newLevel: 1,
      newStreakDays: 0,
      earnedBadgeIds: new Set(),
    });
    expect(ids).toContain('first_lesson');
  });

  it('does NOT award first_lesson when already earned', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'p-1',
        occurredAt: NOW,
        lessonId: 'l-2',
      }),
      newLevel: 1,
      newStreakDays: 0,
      earnedBadgeIds: new Set(['first_lesson']),
    });
    expect(ids).not.toContain('first_lesson');
  });

  it('awards assessment_ace for passing with score >= 80', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'assessment_passed',
        profileId: 'p-1',
        occurredAt: NOW,
        assessmentId: 'a-1',
        score: 85,
      }),
      newLevel: 1,
      newStreakDays: 0,
      earnedBadgeIds: new Set(),
    });
    expect(ids).toContain('assessment_ace');
  });

  it('awards perfect_score for score = 100', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'assessment_passed',
        profileId: 'p-1',
        occurredAt: NOW,
        assessmentId: 'a-1',
        score: 100,
      }),
      newLevel: 1,
      newStreakDays: 0,
      earnedBadgeIds: new Set(),
    });
    expect(ids).toContain('perfect_score');
  });

  it('awards streak_7 badge on day 7', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'learning_streak_day',
        profileId: 'p-1',
        occurredAt: NOW,
        streakDays: 7,
      }),
      newLevel: 1,
      newStreakDays: 7,
      earnedBadgeIds: new Set(),
    });
    expect(ids).toContain('streak_7');
  });

  it('does NOT award level_5 badge when level < 5', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'p-1',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      newLevel: 4,
      newStreakDays: 0,
      earnedBadgeIds: new Set(),
    });
    expect(ids).not.toContain('level_5');
  });

  it('awards level_5 badge when level reaches 5', () => {
    const ids = evaluateBadges({
      event: GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'p-1',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      newLevel: 5,
      newStreakDays: 0,
      earnedBadgeIds: new Set(),
    });
    expect(ids).toContain('level_5');
  });
});

// ─── engine.ts — processEvent ─────────────────────────────────────────────────

describe('processEvent — lesson_completed', () => {
  it('adds base XP to the profile', () => {
    const profile = makeProfile({ xp: 0 });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      profile,
    );
    expect(update.xpEarned).toBe(XP_VALUES.lesson_completed);
    expect(update.newTotalXp).toBe(XP_VALUES.lesson_completed);
  });

  it('awards first_lesson badge on first completion', () => {
    const profile = makeProfile();
    const update = processEvent(
      GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      profile,
    );
    expect(update.newBadgeIds).toContain('first_lesson');
  });

  it('does not award first_lesson badge when already earned', () => {
    const profile = makeProfile({ earnedBadgeIds: ['first_lesson'] });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        lessonId: 'l-2',
      }),
      profile,
    );
    expect(update.newBadgeIds).not.toContain('first_lesson');
  });
});

describe('processEvent — assessment_passed', () => {
  it('awards high-score bonus XP for score >= 80', () => {
    const profile = makeProfile();
    const update = processEvent(
      GamificationEvent.parse({
        type: 'assessment_passed',
        profileId: 'profile-001',
        occurredAt: NOW,
        assessmentId: 'a-1',
        score: 90,
      }),
      profile,
    );
    expect(update.xpEarned).toBeGreaterThan(XP_VALUES.assessment_passed);
  });

  it('awards only base XP for score < 80', () => {
    const profile = makeProfile();
    const update = processEvent(
      GamificationEvent.parse({
        type: 'assessment_passed',
        profileId: 'profile-001',
        occurredAt: NOW,
        assessmentId: 'a-1',
        score: 60,
      }),
      profile,
    );
    expect(update.xpEarned).toBe(XP_VALUES.assessment_passed);
  });
});

describe('processEvent — learning_streak_day', () => {
  it('updates streak days from the event', () => {
    const profile = makeProfile({ streakDays: 5 });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'learning_streak_day',
        profileId: 'profile-001',
        occurredAt: NOW,
        streakDays: 6,
      }),
      profile,
    );
    expect(update.previousStreakDays).toBe(5);
    expect(update.newStreakDays).toBe(6);
  });

  it('includes milestone bonus XP at day 7', () => {
    const profile = makeProfile({ streakDays: 6 });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'learning_streak_day',
        profileId: 'profile-001',
        occurredAt: NOW,
        streakDays: 7,
      }),
      profile,
    );
    expect(update.xpEarned).toBeGreaterThan(XP_VALUES.learning_streak_day);
  });
});

describe('processEvent — level-up', () => {
  it('triggers a level-up when XP crosses a threshold', () => {
    const level2Threshold = LEVEL_THRESHOLDS[2] ?? 100;
    const profile = makeProfile({
      xp: level2Threshold - XP_VALUES.lesson_completed,
      level: 1,
    });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        lessonId: 'l-99',
      }),
      profile,
    );
    expect(update.leveledUp).toBe(true);
    expect(update.newLevel).toBe(2);
  });

  it('does NOT level up when XP stays below the next threshold', () => {
    const profile = makeProfile({ xp: 0, level: 1 });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'lesson_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        lessonId: 'l-1',
      }),
      profile,
    );
    expect(update.leveledUp).toBe(false);
    expect(update.newLevel).toBe(1);
  });
});

describe('processEvent — module_completed', () => {
  it('awards module_complete badge', () => {
    const profile = makeProfile();
    const update = processEvent(
      GamificationEvent.parse({
        type: 'module_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        moduleId: 'MOD-01',
      }),
      profile,
    );
    expect(update.newBadgeIds).toContain('module_complete');
    expect(update.xpEarned).toBe(XP_VALUES.module_completed);
  });

  it('does not re-award module_complete when already earned', () => {
    const profile = makeProfile({ earnedBadgeIds: ['module_complete'] });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'module_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        moduleId: 'MOD-02',
      }),
      profile,
    );
    expect(update.newBadgeIds).not.toContain('module_complete');
  });
});

describe('processEvent — gate_approved', () => {
  it('awards gate_cleared badge and correct XP', () => {
    const profile = makeProfile();
    const update = processEvent(
      GamificationEvent.parse({
        type: 'gate_approved',
        profileId: 'profile-001',
        occurredAt: NOW,
        gateId: 'gate-001',
      }),
      profile,
    );
    expect(update.newBadgeIds).toContain('gate_cleared');
    expect(update.xpEarned).toBe(XP_VALUES.gate_approved);
  });
});

describe('processEvent — allEarnedBadgeIds', () => {
  it('combines existing badges with newly earned badges', () => {
    const profile = makeProfile({ earnedBadgeIds: ['first_lesson'] });
    const update = processEvent(
      GamificationEvent.parse({
        type: 'module_completed',
        profileId: 'profile-001',
        occurredAt: NOW,
        moduleId: 'MOD-01',
      }),
      profile,
    );
    expect(update.allEarnedBadgeIds).toContain('first_lesson');
    expect(update.allEarnedBadgeIds).toContain('module_complete');
  });
});
