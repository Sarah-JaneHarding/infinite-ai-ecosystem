// MOD-05 no-ranking invariant tests — Stage 12 step 6.
//
// "No PD output may carry a teacher rank, percentile, or ordinal position
// relative to peers." — Stage 12 constraint.
//
// This is enforced structurally: the schemas don't define these fields, so Zod
// strips them on parse. These tests verify that:
// 1. Parsed ok outputs never carry rank, percentile or ordinal fields.
// 2. An input that includes these fields is silently stripped — not preserved.
// 3. Each PD agent result schema's parsed ok output is free of ranking language.
//
// The stripping property is the correct guarantee: even if a model returns an
// extra ranking field, the schema parse removes it before the output reaches
// any downstream consumer.

import { describe, expect, it } from 'vitest';

import { PD04Result, PD05Result, PD06Result, PD07Result } from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const NOW = '2026-08-11T10:00:00.000Z';

const RANKING_FIELDS = [
  'rank',
  'percentile',
  'ordinal',
  'teacherRank',
  'peerRank',
] as const;

// ---------------------------------------------------------------------------
// PD04Result — signal aggregator output
// ---------------------------------------------------------------------------

describe('PD04Result ok — no ranking fields', () => {
  const baseOk = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    signalsAggregated: 3,
    cohortSize: 10,
    needAreas: [
      {
        area: 'formative_assessment',
        signalSources: ['coverage'],
        urgency: 'high',
        evidenceSummary: 'Topic delivery behind by 3 weeks.',
      },
    ],
    summary: 'The cohort shows consistent gaps in formative assessment.',
  };

  it('parses cleanly without rank, percentile or ordinal', () => {
    const result = PD04Result.safeParse(baseOk);
    expect(result.success).toBe(true);
  });

  it.each(RANKING_FIELDS)('strips extra "%s" field on parse', (field) => {
    const withRank = { ...baseOk, [field]: 1 };
    const parsed = PD04Result.parse(withRank);
    expect(parsed).not.toHaveProperty(field);
  });

  it('parsed output has no ranking fields at all', () => {
    const parsed = PD04Result.parse(baseOk);
    const keys = Object.keys(parsed);
    for (const field of RANKING_FIELDS) {
      expect(keys).not.toContain(field);
    }
  });
});

// ---------------------------------------------------------------------------
// PD05Result — gap detector output
// ---------------------------------------------------------------------------

describe('PD05Result ok — no ranking fields', () => {
  const priorityGap = {
    area: 'formative_assessment',
    urgency: 'high' as const,
    rationale: 'Strong signal from coverage and walkthrough data.',
    suggestedInterventionType: 'micro_course' as const,
  };

  const baseOk = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    priorityGaps: [priorityGap],
    topPriorityGap: priorityGap,
    summary: 'Formative assessment is the highest priority gap.',
  };

  it('parses cleanly without ranking fields', () => {
    expect(PD05Result.safeParse(baseOk).success).toBe(true);
  });

  it.each(RANKING_FIELDS)('strips extra "%s" field on parse', (field) => {
    const withRank = { ...baseOk, [field]: 99 };
    const parsed = PD05Result.parse(withRank);
    expect(parsed).not.toHaveProperty(field);
  });

  it('priority gaps carry no ranking fields', () => {
    const parsed = PD05Result.parse(baseOk);
    if (parsed.status === 'ok') {
      for (const gap of parsed.priorityGaps) {
        const gapKeys = Object.keys(gap);
        for (const field of RANKING_FIELDS) {
          expect(gapKeys).not.toContain(field);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PD06Result — micro-course output
// ---------------------------------------------------------------------------

describe('PD06Result ok — no ranking fields', () => {
  const baseOk = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    courseId: UUID,
    title: 'Formative Assessment Techniques',
    targetGap: 'formative_assessment',
    totalEstimatedMinutes: 30,
    modules: [
      {
        title: 'What is formative assessment?',
        type: 'input' as const,
        estimatedMinutes: 10,
        content: 'Formative assessment is...',
        materials: [],
      },
    ],
    checkItems: ['What is one technique you can use tomorrow?'],
    citedSourceIds: ['doc-001'],
    exportable: true as const,
  };

  it('parses cleanly without ranking fields', () => {
    expect(PD06Result.safeParse(baseOk).success).toBe(true);
  });

  it.each(RANKING_FIELDS)('strips extra "%s" field on parse', (field) => {
    const withRank = { ...baseOk, [field]: 'top_quartile' };
    const parsed = PD06Result.parse(withRank);
    expect(parsed).not.toHaveProperty(field);
  });
});

// ---------------------------------------------------------------------------
// PD07Result — coaching plan output
// ---------------------------------------------------------------------------

describe('PD07Result ok — no ranking fields', () => {
  const baseOk = {
    status: 'ok' as const,
    tenantId: TENANT,
    generatedAt: NOW,
    planId: UUID,
    targetGap: 'formative_assessment',
    sessions: [
      {
        sessionNumber: 1,
        focus: 'Exploring current assessment practices',
        openingPrompts: ['What assessment strategies are you currently using?'],
        evidencePoints: ['Walkthrough data shows limited exit-ticket use.'],
        estimatedMinutes: 45,
      },
    ],
    goalStatement: 'Build consistent use of formative assessment techniques.',
    citedSourceIds: ['doc-001'],
  };

  it('parses cleanly without ranking fields', () => {
    expect(PD07Result.safeParse(baseOk).success).toBe(true);
  });

  it.each(RANKING_FIELDS)('strips extra "%s" field on parse', (field) => {
    const withRank = { ...baseOk, [field]: 2 };
    const parsed = PD07Result.parse(withRank);
    expect(parsed).not.toHaveProperty(field);
  });

  it('sessions carry no ranking fields', () => {
    const parsed = PD07Result.parse(baseOk);
    if (parsed.status === 'ok') {
      for (const session of parsed.sessions) {
        const sessionKeys = Object.keys(session);
        for (const field of RANKING_FIELDS) {
          expect(sessionKeys).not.toContain(field);
        }
      }
    }
  });
});
