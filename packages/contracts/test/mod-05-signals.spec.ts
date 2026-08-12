// MOD-05 teaching-signal model tests — Stage 12 step 1.
//
// Validates the four signal types that feed into MOD-05 agents:
//   CoverageSignal  — curriculum pacing data from MOD-01
//   AssessmentSignal — psychometric item data from MOD-03
//   WalkthroughNote — structured observation input for PD-03
//   ArtefactEditRate — teacher-correction signals from MOD-04
//
// Also validates the CohortSuppressionResult and MINIMUM_COHORT_SIZE constant
// that enforce the suppression rule across all comparative PD outputs.

import { describe, expect, it } from 'vitest';

import {
  ArtefactEditRate,
  AssessmentSignal,
  CohortSuppressionResult,
  CoverageSignal,
  MINIMUM_COHORT_SIZE,
  TeachingSignal,
  WalkthroughNote,
} from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const SIGNAL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ---------------------------------------------------------------------------
// CoverageSignal
// ---------------------------------------------------------------------------

describe('CoverageSignal', () => {
  const valid: CoverageSignal = {
    signalType: 'coverage',
    tenantId: TENANT,
    signalId: SIGNAL_ID,
    capturedAt: '2026-08-11T10:00:00.000Z',
    capsTopicId: 'CAPS-GR5-NS-WATER',
    gradeLabel: '5',
    subject: 'Natural Sciences',
    plannedWeek: '2026-08-03',
    deliveredWeek: '2026-08-10',
    deliveryStatus: 'delivered',
    weeksDrift: 1,
  };

  it('accepts a valid delivered signal', () => {
    expect(CoverageSignal.safeParse(valid).success).toBe(true);
  });

  it('accepts a null deliveredWeek for not-yet-delivered topic', () => {
    expect(
      CoverageSignal.safeParse({
        ...valid,
        deliveredWeek: null,
        deliveryStatus: 'not_delivered',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid plannedWeek format', () => {
    expect(
      CoverageSignal.safeParse({ ...valid, plannedWeek: '11/08/2026' }).success,
    ).toBe(false);
  });

  it('rejects a non-UUID tenantId', () => {
    expect(CoverageSignal.safeParse({ ...valid, tenantId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('accepts all valid TopicDeliveryStatus values', () => {
    for (const status of [
      'delivered',
      'partially_delivered',
      'not_delivered',
      'ahead_of_plan',
    ] as const) {
      expect(CoverageSignal.safeParse({ ...valid, deliveryStatus: status }).success).toBe(
        true,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AssessmentSignal
// ---------------------------------------------------------------------------

describe('AssessmentSignal', () => {
  const validItem = {
    itemId: 'item-001',
    difficultyIndex: 0.62,
    discriminationIndex: 0.35,
    markingConsistency: 0.9,
    cognitiveLevel: 'apply' as const,
  };
  const valid: AssessmentSignal = {
    signalType: 'assessment',
    tenantId: TENANT,
    signalId: SIGNAL_ID,
    capturedAt: '2026-08-11T10:00:00.000Z',
    assessmentId: 'assess-001',
    capsTopicId: 'CAPS-GR5-NS-WATER',
    gradeLabel: '5',
    subject: 'Natural Sciences',
    cohortSize: 28,
    items: [validItem],
  };

  it('accepts a valid assessment signal', () => {
    expect(AssessmentSignal.safeParse(valid).success).toBe(true);
  });

  it('rejects difficultyIndex above 1', () => {
    expect(
      AssessmentSignal.safeParse({
        ...valid,
        items: [{ ...validItem, difficultyIndex: 1.1 }],
      }).success,
    ).toBe(false);
  });

  it('rejects discriminationIndex below -1', () => {
    expect(
      AssessmentSignal.safeParse({
        ...valid,
        items: [{ ...validItem, discriminationIndex: -1.1 }],
      }).success,
    ).toBe(false);
  });

  it('rejects empty items array', () => {
    expect(AssessmentSignal.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('rejects non-positive cohortSize', () => {
    expect(AssessmentSignal.safeParse({ ...valid, cohortSize: 0 }).success).toBe(false);
  });

  it('accepts all cognitive level values', () => {
    for (const level of [
      'remember',
      'understand',
      'apply',
      'analyse',
      'evaluate',
      'create',
    ] as const) {
      expect(
        AssessmentSignal.safeParse({
          ...valid,
          items: [{ ...validItem, cognitiveLevel: level }],
        }).success,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// WalkthroughNote
// ---------------------------------------------------------------------------

describe('WalkthroughNote', () => {
  const valid: WalkthroughNote = {
    signalType: 'walkthrough',
    tenantId: TENANT,
    signalId: SIGNAL_ID,
    capturedAt: '2026-08-11T10:00:00.000Z',
    teacherRef: 'anon-cohort-token-42',
    observationDate: '2026-08-11',
    gradeLabel: '4',
    subject: 'Mathematics',
    focus: 'pedagogy',
    notes: 'Teacher used concrete manipulatives effectively for fractions lesson.',
    evidenceStrength: 3,
  };

  it('accepts a valid walkthrough note', () => {
    expect(WalkthroughNote.safeParse(valid).success).toBe(true);
  });

  it('rejects an evidenceStrength of 0 — must be 1–4', () => {
    expect(WalkthroughNote.safeParse({ ...valid, evidenceStrength: 0 }).success).toBe(
      false,
    );
  });

  it('rejects an evidenceStrength of 5 — must be 1–4', () => {
    expect(WalkthroughNote.safeParse({ ...valid, evidenceStrength: 5 }).success).toBe(
      false,
    );
  });

  it('rejects empty notes', () => {
    expect(WalkthroughNote.safeParse({ ...valid, notes: '' }).success).toBe(false);
  });

  it('accepts all valid WalkthroughFocus values', () => {
    for (const focus of [
      'curriculum_alignment',
      'pedagogy',
      'learner_engagement',
      'assessment_practice',
      'classroom_management',
      'language_of_instruction',
    ] as const) {
      expect(WalkthroughNote.safeParse({ ...valid, focus }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ArtefactEditRate
// ---------------------------------------------------------------------------

describe('ArtefactEditRate', () => {
  const valid: ArtefactEditRate = {
    signalType: 'artefact_edit',
    tenantId: TENANT,
    signalId: SIGNAL_ID,
    capturedAt: '2026-08-11T10:00:00.000Z',
    capsTopicId: 'CAPS-GR5-NS-WATER',
    agentId: 'TB-01',
    artefactType: 'WORKSHEET',
    totalArtefacts: 10,
    editedArtefacts: 3,
    meanEditDepth: 0.12,
    windowStart: '2026-08-01',
    windowEnd: '2026-08-31',
  };

  it('accepts a valid edit rate signal', () => {
    expect(ArtefactEditRate.safeParse(valid).success).toBe(true);
  });

  it('rejects meanEditDepth above 1', () => {
    expect(ArtefactEditRate.safeParse({ ...valid, meanEditDepth: 1.1 }).success).toBe(
      false,
    );
  });

  it('rejects negative editedArtefacts', () => {
    expect(ArtefactEditRate.safeParse({ ...valid, editedArtefacts: -1 }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TeachingSignal — discriminated union
// ---------------------------------------------------------------------------

describe('TeachingSignal discriminated union', () => {
  it('routes coverage by signalType', () => {
    const result = TeachingSignal.safeParse({
      signalType: 'coverage',
      tenantId: TENANT,
      signalId: SIGNAL_ID,
      capturedAt: '2026-08-11T10:00:00.000Z',
      capsTopicId: 'CAPS-GR5-NS-WATER',
      gradeLabel: '5',
      subject: 'Natural Sciences',
      plannedWeek: '2026-08-03',
      deliveredWeek: null,
      deliveryStatus: 'not_delivered',
      weeksDrift: -2,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.signalType).toBe('coverage');
  });

  it('rejects an unknown signalType', () => {
    expect(
      TeachingSignal.safeParse({ signalType: 'unknown', tenantId: TENANT }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CohortSuppressionResult
// ---------------------------------------------------------------------------

describe('CohortSuppressionResult', () => {
  const valid = {
    status: 'suppressed' as const,
    reason: 'cohort_below_minimum' as const,
    minimumRequired: MINIMUM_COHORT_SIZE,
    actual: 3,
    detail: 'Cohort of 3 is below the minimum of 5 required for comparative reporting.',
  };

  it('accepts a valid suppression result', () => {
    expect(CohortSuppressionResult.safeParse(valid).success).toBe(true);
  });

  it('MINIMUM_COHORT_SIZE is a positive integer (5)', () => {
    expect(MINIMUM_COHORT_SIZE).toBe(5);
    expect(Number.isInteger(MINIMUM_COHORT_SIZE)).toBe(true);
  });

  it('rejects a non-positive minimumRequired', () => {
    expect(
      CohortSuppressionResult.safeParse({ ...valid, minimumRequired: 0 }).success,
    ).toBe(false);
  });

  it('rejects a negative actual', () => {
    expect(CohortSuppressionResult.safeParse({ ...valid, actual: -1 }).success).toBe(
      false,
    );
  });
});
