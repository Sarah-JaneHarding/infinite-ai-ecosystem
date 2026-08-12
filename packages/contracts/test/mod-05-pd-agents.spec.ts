// PD agent contract tests — Stage 12 steps 2–5.
//
// Tests schema acceptance/rejection for all eight PD agents. These are schema-level
// tests only — no live model calls. Key invariants tested:
//
// - No ranking fields exist in any PD output (structural, not checked by a flag)
// - Suppression is the correct schema path when cohortSize < MINIMUM_COHORT_SIZE
// - CPTD points come from policy citations, not model computation
// - All PD-06 outputs carry exportable: true (learning object completeness)
// - PD-08 no_policy_match is the correct path when the activity type is unlisted

import { describe, expect, it } from 'vitest';

import {
  MINIMUM_COHORT_SIZE,
  PD01Input,
  PD01Result,
  PD02Input,
  PD02Result,
  PD03Input,
  PD03Result,
  PD04Input,
  PD04Result,
  PD05Input,
  PD05Result,
  PD06Input,
  PD06Result,
  PD07Input,
  PD07Result,
  PD08Input,
  PD08Result,
} from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const NOW = '2026-08-11T10:00:00.000Z';

// ---------------------------------------------------------------------------
// PD-01 — Coverage vs Pacing Analyst
// ---------------------------------------------------------------------------

describe('PD01Input', () => {
  const valid = {
    tenantId: TENANT,
    subject: 'Natural Sciences',
    gradeLabel: '5',
    periodStart: '2026-07-01',
    periodEnd: '2026-08-31',
    coverageSignals: [{ signalType: 'coverage' }],
  };

  it('accepts a valid input', () => {
    expect(PD01Input.safeParse(valid).success).toBe(true);
  });

  it('rejects empty coverageSignals', () => {
    expect(PD01Input.safeParse({ ...valid, coverageSignals: [] }).success).toBe(false);
  });

  it('rejects invalid periodStart format', () => {
    expect(PD01Input.safeParse({ ...valid, periodStart: '01/07/2026' }).success).toBe(
      false,
    );
  });
});

describe('PD01Result', () => {
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    subject: 'Natural Sciences',
    gradeLabel: '5',
    periodStart: '2026-07-01',
    periodEnd: '2026-08-31',
    topicsAnalysed: 8,
    topicsOnTrack: 5,
    topicsBehind: 2,
    topicsAhead: 1,
    meanWeeksDrift: -1.5,
    gapTopics: [
      {
        capsTopicId: 'CAPS-GR5-NS-WATER',
        deliveryStatus: 'not_delivered',
        weeksBehind: 2,
      },
    ],
    summary:
      'Two topics are behind schedule. Recommend prioritising water cycle delivery.',
  };

  it('accepts a valid ok result', () => {
    expect(PD01Result.safeParse(ok).success).toBe(true);
  });

  it('accepts an ok result with empty gapTopics when on track', () => {
    expect(PD01Result.safeParse({ ...ok, topicsBehind: 0, gapTopics: [] }).success).toBe(
      true,
    );
  });

  it('accepts needs_input when required fields absent', () => {
    expect(
      PD01Result.safeParse({
        status: 'needs_input',
        detail: 'coverageSignals is empty.',
        missingFields: ['coverageSignals'],
      }).success,
    ).toBe(true);
  });

  it('does not contain a teacher rank field — no ranking by design', () => {
    const result = PD01Result.parse(ok);
    expect(result).not.toHaveProperty('rank');
    expect(result).not.toHaveProperty('percentile');
    expect(result).not.toHaveProperty('teacherScore');
  });
});

// ---------------------------------------------------------------------------
// PD-02 — Assessment Quality Analyst
// ---------------------------------------------------------------------------

describe('PD02Input', () => {
  it('accepts valid input with assessmentSignals', () => {
    expect(
      PD02Input.safeParse({
        tenantId: TENANT,
        assessmentSignals: [{ signalType: 'assessment', cohortSize: 28 }],
      }).success,
    ).toBe(true);
  });

  it('rejects empty assessmentSignals', () => {
    expect(PD02Input.safeParse({ tenantId: TENANT, assessmentSignals: [] }).success).toBe(
      false,
    );
  });
});

describe('PD02Result', () => {
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    itemsAnalysed: 10,
    meanDifficulty: 0.62,
    meanDiscrimination: 0.31,
    meanMarkingConsistency: 0.88,
    cognitiveLevelCounts: {
      remember: 2,
      understand: 3,
      apply: 3,
      analyse: 1,
      evaluate: 1,
      create: 0,
    },
    flaggedItems: [],
    summary: 'Assessment shows adequate discrimination. Two items flagged for review.',
  };

  it('accepts a valid ok result', () => {
    expect(PD02Result.safeParse(ok).success).toBe(true);
  });

  it('rejects meanDifficulty above 1', () => {
    expect(PD02Result.safeParse({ ...ok, meanDifficulty: 1.1 }).success).toBe(false);
  });

  it('accepts flaggedItems with valid concern types', () => {
    const withFlag = {
      ...ok,
      flaggedItems: [
        {
          itemId: 'q3',
          concern: 'poor_discrimination',
          value: 0.15,
          detail: 'Below 0.2 threshold.',
        },
      ],
    };
    expect(PD02Result.safeParse(withFlag).success).toBe(true);
  });

  it('does not contain a teacher rank field', () => {
    const result = PD02Result.parse(ok);
    expect(result).not.toHaveProperty('rank');
    expect(result).not.toHaveProperty('teacherPercentile');
  });
});

// ---------------------------------------------------------------------------
// PD-03 — Observation Analyst
// ---------------------------------------------------------------------------

describe('PD03Input', () => {
  it('accepts valid input with walkthroughNotes', () => {
    expect(
      PD03Input.safeParse({
        tenantId: TENANT,
        walkthroughNotes: [{ signalType: 'walkthrough' }],
      }).success,
    ).toBe(true);
  });

  it('rejects empty walkthroughNotes', () => {
    expect(PD03Input.safeParse({ tenantId: TENANT, walkthroughNotes: [] }).success).toBe(
      false,
    );
  });
});

describe('PD03Result', () => {
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    notesAnalysed: 4,
    themes: [
      {
        theme: 'Effective use of manipulatives in mathematics',
        supportingFoci: ['pedagogy'],
        evidenceStrength: 'consistent' as const,
        illustrativeExamples: [
          'Teacher used fraction tiles across three observed lessons.',
        ],
      },
    ],
    priorityAreas: ['Assessment for learning practices'],
    summary: 'Strong pedagogy observed. Assessment practices need development.',
  };

  it('accepts a valid ok result', () => {
    expect(PD03Result.safeParse(ok).success).toBe(true);
  });

  it('rejects empty themes array', () => {
    expect(PD03Result.safeParse({ ...ok, themes: [] }).success).toBe(false);
  });

  it('rejects empty priorityAreas', () => {
    expect(PD03Result.safeParse({ ...ok, priorityAreas: [] }).success).toBe(false);
  });

  it('accepts all evidenceStrength values', () => {
    for (const s of ['emerging', 'consistent', 'strong'] as const) {
      const theme = { ...ok.themes[0]!, evidenceStrength: s };
      expect(PD03Result.safeParse({ ...ok, themes: [theme] }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PD-04 — Practice Signal Aggregator (with suppression)
// ---------------------------------------------------------------------------

describe('PD04Input', () => {
  it('accepts valid input', () => {
    expect(
      PD04Input.safeParse({
        tenantId: TENANT,
        signals: [{ signalType: 'coverage' }],
        cohortSize: 6,
      }).success,
    ).toBe(true);
  });

  it('rejects empty signals', () => {
    expect(
      PD04Input.safeParse({ tenantId: TENANT, signals: [], cohortSize: 6 }).success,
    ).toBe(false);
  });
});

describe('PD04Result — suppression path', () => {
  it('accepts a suppressed result when cohort below minimum', () => {
    expect(
      PD04Result.safeParse({
        status: 'suppressed',
        reason: 'cohort_below_minimum',
        minimumRequired: MINIMUM_COHORT_SIZE,
        actual: 3,
        detail: `Cohort of 3 is below the minimum of ${MINIMUM_COHORT_SIZE} required.`,
      }).success,
    ).toBe(true);
  });

  it('accepts an ok result when cohort meets minimum', () => {
    expect(
      PD04Result.safeParse({
        status: 'ok',
        tenantId: TENANT,
        generatedAt: NOW,
        signalsAggregated: 12,
        cohortSize: MINIMUM_COHORT_SIZE,
        needAreas: [
          {
            area: 'Curriculum pacing',
            signalSources: ['coverage'],
            urgency: 'medium',
            evidenceSummary: 'Two topics behind schedule.',
          },
        ],
        summary: 'One medium-urgency PD need identified.',
      }).success,
    ).toBe(true);
  });

  it('suppressed result has no ranking or individual teacher fields', () => {
    const result = PD04Result.parse({
      status: 'suppressed',
      reason: 'cohort_below_minimum',
      minimumRequired: MINIMUM_COHORT_SIZE,
      actual: 2,
      detail: 'Cohort too small.',
    });
    expect(result).not.toHaveProperty('rank');
    expect(result).not.toHaveProperty('teacherRef');
    expect(result).not.toHaveProperty('teacherName');
  });
});

// ---------------------------------------------------------------------------
// PD-05 — PD Gap Detector
// ---------------------------------------------------------------------------

describe('PD05Input', () => {
  it('accepts valid input', () => {
    expect(
      PD05Input.safeParse({ tenantId: TENANT, needProfile: { areas: [] } }).success,
    ).toBe(true);
  });

  it('rejects missing tenantId', () => {
    expect(PD05Input.safeParse({ needProfile: {} }).success).toBe(false);
  });
});

describe('PD05Result', () => {
  const gap = {
    area: 'Assessment for learning',
    urgency: 'high' as const,
    rationale: 'Multiple signals converge on weak AFL practice.',
    suggestedInterventionType: 'micro_course' as const,
  };
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    priorityGaps: [gap],
    topPriorityGap: gap,
    summary: 'One high-urgency gap identified: Assessment for learning.',
  };

  it('accepts a valid ok result', () => {
    expect(PD05Result.safeParse(ok).success).toBe(true);
  });

  it('rejects empty priorityGaps', () => {
    expect(PD05Result.safeParse({ ...ok, priorityGaps: [] }).success).toBe(false);
  });

  it('accepts all suggestedInterventionType values', () => {
    for (const t of [
      'micro_course',
      'coaching_cycle',
      'peer_observation',
      'resource_provision',
    ] as const) {
      const g = { ...gap, suggestedInterventionType: t };
      expect(
        PD05Result.safeParse({ ...ok, priorityGaps: [g], topPriorityGap: g }).success,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PD-06 — Micro-Course Composer
// ---------------------------------------------------------------------------

describe('PD06Input', () => {
  it('accepts valid input', () => {
    expect(
      PD06Input.safeParse({
        tenantId: TENANT,
        gap: { area: 'AFL' },
        sourceDocumentIds: ['doc-001'],
        targetDurationMinutes: 30,
        language: 'en',
      }).success,
    ).toBe(true);
  });

  it('rejects targetDurationMinutes below 20', () => {
    expect(
      PD06Input.safeParse({
        tenantId: TENANT,
        gap: {},
        sourceDocumentIds: ['doc-001'],
        targetDurationMinutes: 15,
        language: 'en',
      }).success,
    ).toBe(false);
  });

  it('rejects targetDurationMinutes above 40', () => {
    expect(
      PD06Input.safeParse({
        tenantId: TENANT,
        gap: {},
        sourceDocumentIds: ['doc-001'],
        targetDurationMinutes: 45,
        language: 'en',
      }).success,
    ).toBe(false);
  });

  it('rejects empty sourceDocumentIds', () => {
    expect(
      PD06Input.safeParse({
        tenantId: TENANT,
        gap: {},
        sourceDocumentIds: [],
        targetDurationMinutes: 30,
        language: 'en',
      }).success,
    ).toBe(false);
  });
});

describe('PD06Result', () => {
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    courseId: UUID,
    title: 'Assessment for Learning: Questioning Strategies',
    targetGap: 'Assessment for learning practices',
    totalEstimatedMinutes: 30,
    modules: [
      {
        title: 'Introduction to AFL',
        type: 'input' as const,
        estimatedMinutes: 8,
        content: 'Research shows that formative questioning...',
        materials: [],
      },
      {
        title: 'Modelled questioning',
        type: 'model' as const,
        estimatedMinutes: 8,
        content: 'Watch this dialogue demonstrating wait time...',
        materials: ['video reference'],
      },
      {
        title: 'Practice: design three questions',
        type: 'deliberate_practice' as const,
        estimatedMinutes: 10,
        content:
          'Using your next lesson plan, write one Bloom level 1, one level 3, one level 5 question.',
        materials: ['lesson plan template'],
      },
      {
        title: 'Check your understanding',
        type: 'check_for_understanding' as const,
        estimatedMinutes: 4,
        content: 'Answer the reflection questions below.',
        materials: [],
      },
    ],
    checkItems: [
      'What is the purpose of wait time?',
      'How do higher-order questions support learner thinking?',
    ],
    citedSourceIds: ['doc-001'],
    exportable: true as const,
  };

  it('accepts a valid ok result', () => {
    expect(PD06Result.safeParse(ok).success).toBe(true);
  });

  it('requires exportable: true — courses must be exportable', () => {
    const withoutExportable = { ...ok };
    expect(
      PD06Result.safeParse({ ...withoutExportable, exportable: false }).success,
    ).toBe(false);
  });

  it('requires at least one citedSourceId', () => {
    expect(PD06Result.safeParse({ ...ok, citedSourceIds: [] }).success).toBe(false);
  });

  it('totalEstimatedMinutes must be 20–40', () => {
    expect(PD06Result.safeParse({ ...ok, totalEstimatedMinutes: 45 }).success).toBe(
      false,
    );
  });

  it('accepts all module types', () => {
    for (const type of [
      'input',
      'model',
      'deliberate_practice',
      'check_for_understanding',
    ] as const) {
      const mod = { ...ok.modules[0]!, type };
      expect(PD06Result.safeParse({ ...ok, modules: [mod] }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PD-07 — Coaching Plan Agent
// ---------------------------------------------------------------------------

describe('PD07Input', () => {
  it('accepts valid input', () => {
    expect(
      PD07Input.safeParse({
        tenantId: TENANT,
        gap: { area: 'AFL' },
        sessionCount: 3,
        sourceDocumentIds: ['doc-001'],
        language: 'en',
      }).success,
    ).toBe(true);
  });

  it('rejects sessionCount above 6', () => {
    expect(
      PD07Input.safeParse({
        tenantId: TENANT,
        gap: {},
        sessionCount: 7,
        sourceDocumentIds: ['doc-001'],
        language: 'en',
      }).success,
    ).toBe(false);
  });
});

describe('PD07Result', () => {
  const ok = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    planId: UUID,
    targetGap: 'Assessment for learning',
    sessions: [
      {
        sessionNumber: 1,
        focus: 'Establishing baseline questioning practice',
        openingPrompts: ['Tell me about your recent questioning approaches in class.'],
        evidencePoints: ['Observation notes show limited higher-order questioning.'],
        observationFocus: 'Wait time and question complexity',
        estimatedMinutes: 45,
      },
    ],
    goalStatement:
      'By end of cycle, teacher will consistently use higher-order questioning in 80% of lessons.',
    citedSourceIds: ['doc-001'],
  };

  it('accepts a valid ok result', () => {
    expect(PD07Result.safeParse(ok).success).toBe(true);
  });

  it('rejects empty sessions', () => {
    expect(PD07Result.safeParse({ ...ok, sessions: [] }).success).toBe(false);
  });

  it('rejects empty citedSourceIds', () => {
    expect(PD07Result.safeParse({ ...ok, citedSourceIds: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PD-08 — CPTD Tracker
// ---------------------------------------------------------------------------

describe('PD08Input', () => {
  it('accepts valid input', () => {
    expect(
      PD08Input.safeParse({
        tenantId: TENANT,
        teacherRef: 'anon-ref-42',
        activityType: 'micro_course_completion',
        durationMinutes: 30,
        completedAt: NOW,
        policyDocumentIds: ['sace-policy-2026'],
      }).success,
    ).toBe(true);
  });

  it('rejects empty policyDocumentIds — points must come from a cited policy', () => {
    expect(
      PD08Input.safeParse({
        tenantId: TENANT,
        teacherRef: 'anon-ref-42',
        activityType: 'micro_course_completion',
        durationMinutes: 30,
        completedAt: NOW,
        policyDocumentIds: [],
      }).success,
    ).toBe(false);
  });

  it('rejects non-positive durationMinutes', () => {
    expect(
      PD08Input.safeParse({
        tenantId: TENANT,
        teacherRef: 'anon-ref-42',
        activityType: 'micro_course_completion',
        durationMinutes: 0,
        completedAt: NOW,
        policyDocumentIds: ['doc-001'],
      }).success,
    ).toBe(false);
  });
});

describe('PD08Result', () => {
  const ok = {
    status: 'ok' as const,
    teacherRef: 'anon-ref-42',
    activityType: 'micro_course_completion',
    pointsAwarded: 1.5,
    policyReference: 'SACE CPTD Policy §4.2 — micro-learning activities',
    citedPolicyDocumentId: 'sace-policy-2026',
    loggedAt: NOW,
    cycleTotal: 4.5,
  };

  it('accepts a valid ok result', () => {
    expect(PD08Result.safeParse(ok).success).toBe(true);
  });

  it('accepts zero pointsAwarded — policy may award zero for below-minimum duration', () => {
    expect(PD08Result.safeParse({ ...ok, pointsAwarded: 0 }).success).toBe(true);
  });

  it('rejects negative pointsAwarded', () => {
    expect(PD08Result.safeParse({ ...ok, pointsAwarded: -0.5 }).success).toBe(false);
  });

  it('accepts no_policy_match when activity type not covered by supplied policy', () => {
    expect(
      PD08Result.safeParse({
        status: 'no_policy_match',
        detail: 'The supplied policy document does not cover self_directed_study.',
        activityType: 'self_directed_study',
      }).success,
    ).toBe(true);
  });

  it('ok result carries a citedPolicyDocumentId — points always traced to policy', () => {
    const result = PD08Result.parse(ok);
    if (result.status === 'ok') {
      expect(result.citedPolicyDocumentId).toBeTruthy();
    }
  });
});
