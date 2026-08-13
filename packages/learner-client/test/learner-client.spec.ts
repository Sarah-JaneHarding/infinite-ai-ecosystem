// Unit tests — Stage 25 (Learner Client).
// Happy path + at least two failure paths per area.

import { describe, expect, it } from 'vitest';

import {
  ActivityNode,
  ActivityRecord,
  ActivityStatus,
  CourseGraph,
  GamificationSnapshot,
  LearnerProfile,
  OfflineEvent,
  OfflineQueue,
  allCompleted,
  countByStatus,
  courseProgress,
  createQueue,
  dequeue,
  enqueue,
  getRecord,
  isUnlocked,
  nextActivities,
  peek,
  pendingCount,
  upsertRecord,
} from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = '2026-08-13T10:00:00Z';
const LEARNER = 'learner-token-xyz';

function makeProfile(overrides?: Partial<LearnerProfile>): LearnerProfile {
  return LearnerProfile.parse({
    learnerId: LEARNER,
    enrolmentId: 'enrol-001',
    courseId: 'course-001',
    activityRecords: [],
    gamification: { xp: 100, level: 2, streakDays: 3, earnedBadgeCount: 1 },
    lastActiveAt: NOW,
    ...overrides,
  });
}

function makeRecord(
  activityId: string,
  status: ActivityStatus = 'not_started',
): ActivityRecord {
  return ActivityRecord.parse({ activityId, status });
}

function makeGraph(): CourseGraph {
  return CourseGraph.parse({
    courseId: 'course-001',
    activities: [
      {
        activityId: 'a1',
        title: 'Intro',
        type: 'lesson',
        prerequisites: [],
        estimatedMinutes: 10,
      },
      {
        activityId: 'a2',
        title: 'Quiz 1',
        type: 'quiz',
        prerequisites: ['a1'],
        estimatedMinutes: 5,
      },
      {
        activityId: 'a3',
        title: 'Reading',
        type: 'reading',
        prerequisites: ['a1'],
        estimatedMinutes: 15,
      },
      {
        activityId: 'a4',
        title: 'Assessment',
        type: 'assessment',
        prerequisites: ['a2', 'a3'],
        estimatedMinutes: 20,
      },
    ],
  });
}

function makeEvent(
  eventId: string,
  type:
    | 'quiz_answered'
    | 'activity_completed'
    | 'assessment_submitted' = 'activity_completed',
): OfflineEvent {
  const payloads = {
    quiz_answered: {
      type: 'quiz_answered',
      activityId: 'a1',
      questionId: 'q1',
      selectedSide: 'A',
    },
    activity_completed: { type: 'activity_completed', activityId: 'a1', score: 80 },
    assessment_submitted: {
      type: 'assessment_submitted',
      activityId: 'a4',
      sessionRef: 'sess-ref-001',
    },
  };
  return OfflineEvent.parse({
    eventId,
    learnerId: LEARNER,
    occurredAt: NOW,
    payload: payloads[type],
  });
}

// ─── ActivityStatus schema ────────────────────────────────────────────────────

describe('ActivityStatus schema', () => {
  it('accepts all four statuses', () => {
    for (const s of ['not_started', 'in_progress', 'completed', 'blocked'] as const) {
      expect(ActivityStatus.parse(s)).toBe(s);
    }
  });

  it('rejects an unknown status', () => {
    expect(ActivityStatus.safeParse('skipped').success).toBe(false);
  });
});

// ─── ActivityRecord schema ────────────────────────────────────────────────────

describe('ActivityRecord schema', () => {
  it('parses a completed record with score', () => {
    const result = ActivityRecord.safeParse({
      activityId: 'a1',
      status: 'completed',
      score: 85,
      startedAt: NOW,
      completedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it('rejects score > 100', () => {
    expect(
      ActivityRecord.safeParse({ activityId: 'a1', status: 'completed', score: 101 })
        .success,
    ).toBe(false);
  });

  it('rejects score < 0', () => {
    expect(
      ActivityRecord.safeParse({ activityId: 'a1', status: 'completed', score: -1 })
        .success,
    ).toBe(false);
  });
});

// ─── GamificationSnapshot schema ─────────────────────────────────────────────

describe('GamificationSnapshot schema', () => {
  it('parses a valid snapshot', () => {
    const result = GamificationSnapshot.safeParse({
      xp: 500,
      level: 3,
      streakDays: 7,
      earnedBadgeCount: 4,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative xp', () => {
    expect(
      GamificationSnapshot.safeParse({
        xp: -1,
        level: 1,
        streakDays: 0,
        earnedBadgeCount: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects level < 1', () => {
    expect(
      GamificationSnapshot.safeParse({
        xp: 0,
        level: 0,
        streakDays: 0,
        earnedBadgeCount: 0,
      }).success,
    ).toBe(false);
  });
});

// ─── getRecord / upsertRecord ─────────────────────────────────────────────────

describe('getRecord', () => {
  it('returns the record for a known activityId', () => {
    const profile = makeProfile({
      activityRecords: [makeRecord('a1', 'completed'), makeRecord('a2', 'in_progress')],
    });
    expect(getRecord(profile, 'a1')?.status).toBe('completed');
  });

  it('returns undefined for an unknown activityId', () => {
    expect(getRecord(makeProfile(), 'nonexistent')).toBeUndefined();
  });
});

describe('upsertRecord', () => {
  it('appends a new record when none exists', () => {
    const profile = upsertRecord(makeProfile(), makeRecord('a1', 'in_progress'));
    expect(profile.activityRecords).toHaveLength(1);
    expect(profile.activityRecords[0]?.status).toBe('in_progress');
  });

  it('replaces an existing record with the same activityId', () => {
    let profile = makeProfile({ activityRecords: [makeRecord('a1', 'in_progress')] });
    profile = upsertRecord(profile, makeRecord('a1', 'completed'));
    expect(profile.activityRecords).toHaveLength(1);
    expect(profile.activityRecords[0]?.status).toBe('completed');
  });
});

// ─── allCompleted / countByStatus ─────────────────────────────────────────────

describe('allCompleted', () => {
  it('returns true when all given activities are completed', () => {
    const profile = makeProfile({
      activityRecords: [makeRecord('a1', 'completed'), makeRecord('a2', 'completed')],
    });
    expect(allCompleted(profile, ['a1', 'a2'])).toBe(true);
  });

  it('returns false when any activity is not completed', () => {
    const profile = makeProfile({
      activityRecords: [makeRecord('a1', 'completed'), makeRecord('a2', 'in_progress')],
    });
    expect(allCompleted(profile, ['a1', 'a2'])).toBe(false);
  });

  it('returns false when an activity has no record', () => {
    const profile = makeProfile({ activityRecords: [makeRecord('a1', 'completed')] });
    expect(allCompleted(profile, ['a1', 'a2'])).toBe(false);
  });
});

describe('countByStatus', () => {
  it('counts all statuses correctly', () => {
    const profile = makeProfile({
      activityRecords: [
        makeRecord('a1', 'completed'),
        makeRecord('a2', 'completed'),
        makeRecord('a3', 'in_progress'),
        makeRecord('a4', 'not_started'),
      ],
    });
    const counts = countByStatus(profile);
    expect(counts.completed).toBe(2);
    expect(counts.in_progress).toBe(1);
    expect(counts.not_started).toBe(1);
    expect(counts.blocked).toBe(0);
  });

  it('returns all zeros for an empty profile', () => {
    const counts = countByStatus(makeProfile());
    expect(Object.values(counts).every((v) => v === 0)).toBe(true);
  });
});

// ─── navigation: isUnlocked ───────────────────────────────────────────────────

describe('isUnlocked', () => {
  const graph = makeGraph();

  it('is true for an activity with no prerequisites', () => {
    expect(isUnlocked(graph, 'a1', new Set())).toBe(true);
  });

  it('is true when all prerequisites are completed', () => {
    expect(isUnlocked(graph, 'a2', new Set(['a1']))).toBe(true);
  });

  it('is false when a prerequisite is not yet completed', () => {
    expect(isUnlocked(graph, 'a4', new Set(['a2']))).toBe(false);
  });

  it('returns false for an unknown activityId', () => {
    expect(isUnlocked(graph, 'nonexistent', new Set())).toBe(false);
  });
});

// ─── navigation: nextActivities ──────────────────────────────────────────────

describe('nextActivities', () => {
  const graph = makeGraph();

  it('returns only unlocked and uncompleted activities', () => {
    const next = nextActivities(graph, new Set());
    // Only a1 has no prerequisites
    expect(next.map((a) => a.activityId)).toEqual(['a1']);
  });

  it('returns a2 and a3 after a1 is completed', () => {
    const next = nextActivities(graph, new Set(['a1']));
    expect(next.map((a) => a.activityId)).toEqual(['a2', 'a3']);
  });

  it('returns empty array when all activities are completed', () => {
    const all = new Set(['a1', 'a2', 'a3', 'a4']);
    expect(nextActivities(graph, all)).toHaveLength(0);
  });
});

// ─── navigation: courseProgress ──────────────────────────────────────────────

describe('courseProgress', () => {
  const graph = makeGraph();

  it('is 0 when nothing is completed', () => {
    expect(courseProgress(graph, new Set())).toBe(0);
  });

  it('is 0.5 when half the activities are completed', () => {
    expect(courseProgress(graph, new Set(['a1', 'a2']))).toBeCloseTo(0.5);
  });

  it('is 1 when all activities are completed', () => {
    expect(courseProgress(graph, new Set(['a1', 'a2', 'a3', 'a4']))).toBe(1);
  });
});

// ─── CourseGraph schema ───────────────────────────────────────────────────────

describe('CourseGraph schema', () => {
  it('rejects an empty activities array', () => {
    expect(CourseGraph.safeParse({ courseId: 'c1', activities: [] }).success).toBe(false);
  });

  it('rejects non-positive estimatedMinutes', () => {
    expect(
      ActivityNode.safeParse({
        activityId: 'a1',
        title: 'X',
        type: 'lesson',
        prerequisites: [],
        estimatedMinutes: 0,
      }).success,
    ).toBe(false);
  });
});

// ─── OfflineQueue: createQueue / enqueue / dequeue ───────────────────────────

describe('createQueue', () => {
  it('creates an empty queue', () => {
    const q = createQueue(LEARNER);
    expect(q.learnerId).toBe(LEARNER);
    expect(q.events).toHaveLength(0);
  });
});

describe('enqueue', () => {
  it('appends events in order', () => {
    let q = createQueue(LEARNER);
    q = enqueue(q, makeEvent('e1'));
    q = enqueue(q, makeEvent('e2'));
    expect(pendingCount(q)).toBe(2);
    expect(q.events[0]?.eventId).toBe('e1');
  });

  it('enqueues all three payload types', () => {
    let q = createQueue(LEARNER);
    q = enqueue(q, makeEvent('e1', 'quiz_answered'));
    q = enqueue(q, makeEvent('e2', 'activity_completed'));
    q = enqueue(q, makeEvent('e3', 'assessment_submitted'));
    expect(pendingCount(q)).toBe(3);
  });

  it('throws when event learnerId does not match queue', () => {
    const q = createQueue('other-learner');
    expect(() => enqueue(q, makeEvent('e1'))).toThrow();
  });
});

describe('dequeue', () => {
  it('removes the event with the given eventId', () => {
    let q = createQueue(LEARNER);
    q = enqueue(q, makeEvent('e1'));
    q = enqueue(q, makeEvent('e2'));
    q = dequeue(q, 'e1');
    expect(pendingCount(q)).toBe(1);
    expect(q.events[0]?.eventId).toBe('e2');
  });

  it('is idempotent when the eventId is not present', () => {
    let q = createQueue(LEARNER);
    q = enqueue(q, makeEvent('e1'));
    const same = dequeue(q, 'nonexistent');
    expect(pendingCount(same)).toBe(1);
  });
});

// ─── OfflineQueue: peek ───────────────────────────────────────────────────────

describe('peek', () => {
  it('returns the oldest event', () => {
    let q = createQueue(LEARNER);
    q = enqueue(q, makeEvent('e1'));
    q = enqueue(q, makeEvent('e2'));
    expect(peek(q)?.eventId).toBe('e1');
  });

  it('returns undefined for an empty queue', () => {
    expect(peek(createQueue(LEARNER))).toBeUndefined();
  });
});

// ─── OfflineQueue schema ──────────────────────────────────────────────────────

describe('OfflineQueue schema', () => {
  it('rejects an empty learnerId', () => {
    expect(OfflineQueue.safeParse({ learnerId: '', events: [] }).success).toBe(false);
  });
});
