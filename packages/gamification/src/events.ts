// Gamification event schema — Stage 22.
// These are the domain events that drive XP, badge, level and streak updates.
// No learner PII; all identifiers are de-identified profile references.

import { z } from 'zod';

// ─── Event types ──────────────────────────────────────────────────────────────

export const GamificationEventType = z.enum([
  'lesson_completed',
  'assessment_completed',
  'assessment_passed',
  'learning_streak_day',
  'module_completed',
  'gate_approved',
]);
export type GamificationEventType = z.infer<typeof GamificationEventType>;

// ─── Per-event payloads ───────────────────────────────────────────────────────

const BaseEvent = z.object({
  /** De-identified learner profile reference. Never a real name or ID number. */
  profileId: z.string().min(1),
  /** ISO-8601 UTC timestamp of the event. */
  occurredAt: z.string().datetime(),
});

export const LessonCompletedEvent = BaseEvent.extend({
  type: z.literal('lesson_completed'),
  lessonId: z.string().min(1),
  /** 0–100 score if graded, absent otherwise. */
  score: z.number().int().min(0).max(100).optional(),
});
export type LessonCompletedEvent = z.infer<typeof LessonCompletedEvent>;

export const AssessmentCompletedEvent = BaseEvent.extend({
  type: z.literal('assessment_completed'),
  assessmentId: z.string().min(1),
  score: z.number().int().min(0).max(100),
});
export type AssessmentCompletedEvent = z.infer<typeof AssessmentCompletedEvent>;

export const AssessmentPassedEvent = BaseEvent.extend({
  type: z.literal('assessment_passed'),
  assessmentId: z.string().min(1),
  score: z.number().int().min(0).max(100),
});
export type AssessmentPassedEvent = z.infer<typeof AssessmentPassedEvent>;

export const LearningStreakDayEvent = BaseEvent.extend({
  type: z.literal('learning_streak_day'),
  /** Current streak length in days (including today). */
  streakDays: z.number().int().min(1),
});
export type LearningStreakDayEvent = z.infer<typeof LearningStreakDayEvent>;

export const ModuleCompletedEvent = BaseEvent.extend({
  type: z.literal('module_completed'),
  moduleId: z.string().min(1),
});
export type ModuleCompletedEvent = z.infer<typeof ModuleCompletedEvent>;

export const GateApprovedEvent = BaseEvent.extend({
  type: z.literal('gate_approved'),
  gateId: z.string().min(1),
});
export type GateApprovedEvent = z.infer<typeof GateApprovedEvent>;

// ─── Discriminated union ──────────────────────────────────────────────────────

export const GamificationEvent = z.discriminatedUnion('type', [
  LessonCompletedEvent,
  AssessmentCompletedEvent,
  AssessmentPassedEvent,
  LearningStreakDayEvent,
  ModuleCompletedEvent,
  GateApprovedEvent,
]);
export type GamificationEvent = z.infer<typeof GamificationEvent>;

// ─── Learner profile (input state) ───────────────────────────────────────────

export const LearnerGamificationProfile = z.object({
  profileId: z.string().min(1),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  streakDays: z.number().int().nonnegative(),
  /** Badge IDs already earned. */
  earnedBadgeIds: z.array(z.string()),
});
export type LearnerGamificationProfile = z.infer<typeof LearnerGamificationProfile>;
