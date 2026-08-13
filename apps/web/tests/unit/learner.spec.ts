// Unit tests — Stage 26 (Learner Experience).
// Covers the pure helper functions in src/lib/learner.ts.
// Happy path + at least two failure paths per area.

import { describe, it, expect } from 'vitest';
import {
  computeLearnerState,
  buildSampleGraph,
  buildSampleProfile,
  activityTypeEmoji,
} from '../../src/lib/learner.js';

// ─── computeLearnerState ──────────────────────────────────────────────────────

describe('computeLearnerState', () => {
  const graph = buildSampleGraph();

  it('returns correct available activities for a partially completed profile', () => {
    // buildSampleProfile: act-1 completed, act-2 in_progress.
    // act-2 is unlocked (act-1 done) and not completed → available.
    // act-3 needs act-1 AND act-2 completed — act-2 still in_progress → not available.
    const profile = buildSampleProfile('learner-abc');
    const state = computeLearnerState(graph, profile);
    const ids = state.availableActivities.map((a) => a.activityId);
    expect(ids).toContain('act-2');
    expect(ids).not.toContain('act-3');
    expect(state.totalActivities).toBe(6);
  });

  it('returns only root activities and progress 0 when no records exist', () => {
    const emptyProfile = { ...buildSampleProfile('learner-zero'), activityRecords: [] };
    const state = computeLearnerState(graph, emptyProfile);
    expect(state.availableActivities.map((a) => a.activityId)).toEqual(['act-1']);
    expect(state.progress).toBe(0);
    expect(state.statusCounts.completed).toBe(0);
    expect(state.statusCounts.in_progress).toBe(0);
  });

  it('returns empty available list and progress 1 when all activities are completed', () => {
    const allDone = {
      ...buildSampleProfile('learner-done'),
      activityRecords: graph.activities.map((a) => ({
        activityId: a.activityId,
        status: 'completed' as const,
        score: 80,
        startedAt: '2026-08-01T08:00:00Z',
        completedAt: '2026-08-01T09:00:00Z',
      })),
    };
    const state = computeLearnerState(graph, allDone);
    expect(state.availableActivities).toHaveLength(0);
    expect(state.progress).toBe(1);
    expect(state.statusCounts.completed).toBe(6);
  });

  it('reflects gamification snapshot from the profile', () => {
    const profile = buildSampleProfile('learner-gami');
    const state = computeLearnerState(graph, profile);
    expect(state.gamification.xp).toBe(150);
    expect(state.gamification.level).toBe(2);
    expect(state.gamification.streakDays).toBe(5);
  });
});

// ─── buildSampleGraph ─────────────────────────────────────────────────────────

describe('buildSampleGraph', () => {
  it('returns a graph with 6 activities', () => {
    const graph = buildSampleGraph();
    expect(graph.activities).toHaveLength(6);
    expect(graph.courseId).toBe('demo-mathematics-grade-7');
  });

  it('has one root activity (no prerequisites)', () => {
    const graph = buildSampleGraph();
    const roots = graph.activities.filter((a) => a.prerequisites.length === 0);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.activityId).toBe('act-1');
  });

  it('has positive estimatedMinutes for every activity', () => {
    const graph = buildSampleGraph();
    for (const a of graph.activities) {
      expect(a.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});

// ─── buildSampleProfile ───────────────────────────────────────────────────────

describe('buildSampleProfile', () => {
  it('returns a profile with the given learnerId', () => {
    const profile = buildSampleProfile('token-xyz');
    expect(profile.learnerId).toBe('token-xyz');
  });

  it('includes both completed and in-progress activity records', () => {
    const profile = buildSampleProfile('token-abc');
    const statuses = profile.activityRecords.map((r) => r.status);
    expect(statuses).toContain('completed');
    expect(statuses).toContain('in_progress');
  });

  it('has a valid gamification snapshot (level >= 1, xp >= 0)', () => {
    const profile = buildSampleProfile('token-def');
    expect(profile.gamification.level).toBeGreaterThanOrEqual(1);
    expect(profile.gamification.xp).toBeGreaterThanOrEqual(0);
  });
});

// ─── activityTypeEmoji ────────────────────────────────────────────────────────

describe('activityTypeEmoji', () => {
  it('returns a distinct emoji for known types', () => {
    const types = ['lesson', 'quiz', 'assessment', 'reading', 'video'];
    const emojis = types.map(activityTypeEmoji);
    expect(new Set(emojis).size).toBe(types.length);
  });

  it('returns the fallback emoji for an unknown type', () => {
    expect(activityTypeEmoji('unknown-type')).toBe('✏️');
  });
});
