import { describe, expect, it, vi } from 'vitest';

import type {
  Learner360Event,
  Learner360Store,
} from '../../src/learner360/learner360-builder.js';
import { buildLearner360 } from '../../src/learner360/learner360-builder.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_ID = '00000000-0000-0000-0000-000000000100';
const RUN_AT = '2026-08-07T10:00:00.000Z';

function baseInput(learnerId = LEARNER_ID) {
  return { tenantId: TENANT_ID, learnerId, termNumber: 3, academicYear: 2026 };
}

function makeStore(events: Learner360Event[]): Learner360Store {
  return {
    loadEvents: vi.fn().mockResolvedValue(events),
  };
}

// ---------------------------------------------------------------------------
// needs_input — no events
// ---------------------------------------------------------------------------

describe('buildLearner360 — needs_input', () => {
  it('returns needs_input when the store returns no events', async () => {
    const result = await buildLearner360(baseInput(), makeStore([]), RUN_AT);

    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.learnerId).toBe(LEARNER_ID);
      expect(result.detail).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Attendance summary
// ---------------------------------------------------------------------------

describe('buildLearner360 — attendance summary', () => {
  it('counts present, absent, and late days correctly', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-04',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-05',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.absent',
          occurredAt: '2026-08-06',
        },
        { domain: 'ATTENDANCE', eventType: 'attendance.late', occurredAt: '2026-08-07' },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance?.presentDays).toBe(2);
      expect(result.profile.attendance?.absentDays).toBe(1);
      expect(result.profile.attendance?.lateDays).toBe(1);
    }
  });

  it('computes attendanceRatePct = round(100 * present / total)', async () => {
    // 2 present, 1 absent, 1 late → 4 total → 50%
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-04',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-05',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.absent',
          occurredAt: '2026-08-06',
        },
        { domain: 'ATTENDANCE', eventType: 'attendance.late', occurredAt: '2026-08-07' },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance?.attendanceRatePct).toBe(50);
    }
  });

  it('attendanceRatePct = 75 for 3 present and 1 absent', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-04',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-05',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-06',
        },
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.absent',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance?.attendanceRatePct).toBe(75);
    }
  });

  it('sets attendance to null when there are no attendance events', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          payload: { subjectCode: 'MATH', scorePercent: 80 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Academic summary
// ---------------------------------------------------------------------------

describe('buildLearner360 — academic summary', () => {
  it('computes overallAverage as the mean of subject averages', async () => {
    // MATH=80, ENGLISH=70 → overall = 75
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          payload: { subjectCode: 'MATH', scorePercent: 80 },
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-02',
          payload: { subjectCode: 'ENGLISH', scorePercent: 70 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.academic?.overallAverage).toBe(75);
    }
  });

  it('overallAverage = 80 for three subjects (90, 80, 70)', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          payload: { subjectCode: 'MATH', scorePercent: 90 },
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-02',
          payload: { subjectCode: 'SCIENCE', scorePercent: 80 },
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-03',
          payload: { subjectCode: 'ENGLISH', scorePercent: 70 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.academic?.overallAverage).toBe(80);
    }
  });

  it('averages the score when a subject appears more than once', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          payload: { subjectCode: 'MATH', scorePercent: 60 },
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-05',
          payload: { subjectCode: 'MATH', scorePercent: 80 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.academic?.subjectAverages?.['MATH']).toBe(70);
      expect(result.profile.academic?.overallAverage).toBe(70);
    }
  });

  it('sets academic to null when there are no assessment events', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.academic).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Behaviour summary
// ---------------------------------------------------------------------------

describe('buildLearner360 — behaviour summary', () => {
  it('counts incidents and identifies the most recent kind', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'BEHAVIOUR',
          eventType: 'behaviour.incident',
          occurredAt: '2026-08-01',
          payload: { behaviourKind: 'DISRUPTION' },
        },
        {
          domain: 'BEHAVIOUR',
          eventType: 'behaviour.incident',
          occurredAt: '2026-08-07',
          payload: { behaviourKind: 'TRUANCY' },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.behaviour?.incidentCount).toBe(2);
      expect(result.profile.behaviour?.mostRecentKind).toBe('TRUANCY');
    }
  });

  it('sets behaviour to null when there are no behaviour events', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.behaviour).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Wellbeing summary
// ---------------------------------------------------------------------------

describe('buildLearner360 — wellbeing summary', () => {
  it('flags the learner when screenerScore exceeds threshold', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'WELLBEING',
          eventType: 'wellbeing.screener',
          occurredAt: '2026-08-07',
          payload: { screenerScore: 35, screenerKind: 'SDQ', threshold: 30 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.wellbeing?.flagged).toBe(true);
    }
  });

  it('does not flag when screenerScore is below threshold', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'WELLBEING',
          eventType: 'wellbeing.screener',
          occurredAt: '2026-08-07',
          payload: { screenerScore: 10, screenerKind: 'SDQ', threshold: 30 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.wellbeing?.flagged).toBe(false);
    }
  });

  it('populates screenerScores with the screener kind as key', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'WELLBEING',
          eventType: 'wellbeing.screener',
          occurredAt: '2026-08-07',
          payload: { screenerScore: 22, screenerKind: 'SDQ', threshold: 30 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.wellbeing?.screenerScores?.['SDQ']).toBe(22);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-domain and null for absent domains
// ---------------------------------------------------------------------------

describe('buildLearner360 — multi-domain and null for absent domains', () => {
  it('attendance-only: academic, behaviour, and wellbeing are null', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance).not.toBeNull();
      expect(result.profile.academic).toBeNull();
      expect(result.profile.behaviour).toBeNull();
      expect(result.profile.wellbeing).toBeNull();
    }
  });

  it('all four domains populated when all domain events are present', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          payload: { subjectCode: 'MATH', scorePercent: 75 },
        },
        {
          domain: 'BEHAVIOUR',
          eventType: 'behaviour.incident',
          occurredAt: '2026-08-05',
          payload: { behaviourKind: 'DISRUPTION' },
        },
        {
          domain: 'WELLBEING',
          eventType: 'wellbeing.screener',
          occurredAt: '2026-08-06',
          payload: { screenerScore: 12, screenerKind: 'SDQ', threshold: 30 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance).not.toBeNull();
      expect(result.profile.academic).not.toBeNull();
      expect(result.profile.behaviour).not.toBeNull();
      expect(result.profile.wellbeing).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Blocked downstream events
// ---------------------------------------------------------------------------

describe('buildLearner360 — blocked downstream handling', () => {
  it('excludes blocked events from summaries', async () => {
    // Assessment events are blocked; should result in academic = null
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          blockedDownstream: true,
          payload: { subjectCode: 'MATH', scorePercent: 75 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.attendance).not.toBeNull();
      expect(result.profile.academic).toBeNull();
    }
  });

  it('sets dataQualityNote when any event is blocked', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
          blockedDownstream: false,
        },
        {
          domain: 'ASSESSMENT',
          eventType: 'assessment.score',
          occurredAt: '2026-08-01',
          blockedDownstream: true,
          payload: { subjectCode: 'MATH', scorePercent: 75 },
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.dataQualityNote).not.toBeNull();
    }
  });

  it('dataQualityNote is null when no events are blocked', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.dataQualityNote).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Metadata and store wiring
// ---------------------------------------------------------------------------

describe('buildLearner360 — metadata', () => {
  it('sets lastMaterialisedAt to the injected now value', async () => {
    const result = await buildLearner360(
      baseInput(),
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.lastMaterialisedAt).toBe(RUN_AT);
    }
  });

  it('passes tenantId, learnerId, termNumber, academicYear to the store', async () => {
    const loadFn = vi.fn().mockResolvedValue([]);
    const store: Learner360Store = {
      loadEvents: loadFn,
    };

    await buildLearner360(
      { tenantId: TENANT_ID, learnerId: LEARNER_ID, termNumber: 2, academicYear: 2025 },
      store,
      RUN_AT,
    );

    expect(loadFn).toHaveBeenCalledWith(TENANT_ID, LEARNER_ID, 2, 2025);
  });

  it('profile learnerId and tenantId match the input', async () => {
    const anotherLearner = '00000000-0000-0000-0000-000000000200';
    const result = await buildLearner360(
      {
        tenantId: TENANT_ID,
        learnerId: anotherLearner,
        termNumber: 1,
        academicYear: 2026,
      },
      makeStore([
        {
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: '2026-08-07',
        },
      ]),
      RUN_AT,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.profile.learnerId).toBe(anotherLearner);
      expect(result.profile.tenantId).toBe(TENANT_ID);
    }
  });

  it('result is deterministic: same events always produce the same profile', async () => {
    const events: Learner360Event[] = [
      { domain: 'ATTENDANCE', eventType: 'attendance.present', occurredAt: '2026-08-07' },
      { domain: 'ATTENDANCE', eventType: 'attendance.absent', occurredAt: '2026-08-06' },
    ];

    const r1 = await buildLearner360(baseInput(), makeStore([...events]), RUN_AT);
    const r2 = await buildLearner360(baseInput(), makeStore([...events]), RUN_AT);

    expect(r1).toEqual(r2);
  });
});
