// The input-schema boundary — Stage 8 (repository audit follow-through, Task 15).
//
// gamification.spec.ts thoroughly exercises processEvent's business logic and already has
// a handful of schema-rejection tests for LessonCompletedEvent/AssessmentPassedEvent/
// LearningStreakDayEvent. Untouched: LearnerGamificationProfile — the input state
// processEvent trusts completely (engine.ts takes it as already-typed, so this schema is
// the real boundary a caller must parse untrusted persisted state against before ever
// calling processEvent) — plus three more event schemas (AssessmentCompletedEvent,
// ModuleCompletedEvent, GateApprovedEvent) whose own min(1)/int/range constraints had
// never been proven to actually reject invalid data.

import { describe, expect, it } from 'vitest';

import {
  AssessmentCompletedEvent,
  GamificationEvent,
  GateApprovedEvent,
  LearnerGamificationProfile,
  ModuleCompletedEvent,
} from '../src/index.js';

const NOW = '2026-08-13T08:00:00Z';

describe('LearnerGamificationProfile', () => {
  it('accepts a well-formed profile', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: 'p-1',
      xp: 0,
      level: 1,
      streakDays: 0,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative xp', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: 'p-1',
      xp: -1,
      level: 1,
      streakDays: 0,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer xp', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: 'p-1',
      xp: 1.5,
      level: 1,
      streakDays: 0,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a level below 1', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: 'p-1',
      xp: 0,
      level: 0,
      streakDays: 0,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative streakDays', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: 'p-1',
      xp: 0,
      level: 1,
      streakDays: -1,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty profileId', () => {
    const result = LearnerGamificationProfile.safeParse({
      profileId: '',
      xp: 0,
      level: 1,
      streakDays: 0,
      earnedBadgeIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('AssessmentCompletedEvent', () => {
  it('rejects a score above 100', () => {
    const result = AssessmentCompletedEvent.safeParse({
      type: 'assessment_completed',
      profileId: 'p-1',
      occurredAt: NOW,
      assessmentId: 'a-1',
      score: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty assessmentId', () => {
    const result = AssessmentCompletedEvent.safeParse({
      type: 'assessment_completed',
      profileId: 'p-1',
      occurredAt: NOW,
      assessmentId: '',
      score: 50,
    });
    expect(result.success).toBe(false);
  });
});

describe('ModuleCompletedEvent', () => {
  it('rejects an empty moduleId', () => {
    const result = ModuleCompletedEvent.safeParse({
      type: 'module_completed',
      profileId: 'p-1',
      occurredAt: NOW,
      moduleId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('GateApprovedEvent', () => {
  it('rejects an empty gateId', () => {
    const result = GateApprovedEvent.safeParse({
      type: 'gate_approved',
      profileId: 'p-1',
      occurredAt: NOW,
      gateId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('GamificationEvent (discriminated union)', () => {
  it('rejects an unknown event type', () => {
    const result = GamificationEvent.safeParse({
      type: 'not_a_real_event',
      profileId: 'p-1',
      occurredAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed occurredAt timestamp', () => {
    const result = GamificationEvent.safeParse({
      type: 'lesson_completed',
      profileId: 'p-1',
      occurredAt: 'not-a-date',
      lessonId: 'l-1',
    });
    expect(result.success).toBe(false);
  });
});
