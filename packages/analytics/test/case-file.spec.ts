// SBST case file surface — unit tests (Stage 10 step 5)

import { describe, expect, it } from 'vitest';

import { buildCaseFile, type CaseFileInput } from '../src/case-file.js';

const TENANT = '11111111-0000-0000-0000-000000000001';
const LEARNER = '22222222-0000-0000-0000-000000000001';
const TERM = '33333333-0000-0000-0000-000000000001';

function baseInput(overrides: Partial<CaseFileInput> = {}): CaseFileInput {
  return {
    tenantId: TENANT,
    learnerId: LEARNER,
    siasStatus: 'INTERVENTION_ACTIVE',
    safeguardingEscalated: false,
    screenHistory: [
      {
        screenId: 'aaaa0001-0000-0000-0000-000000000001',
        termId: TERM,
        compositePercentile: 28,
        tier: 'TIER_2',
        overallSufficiency: 'sufficient',
      },
    ],
    latestTierRecommendation: {
      recommendationId: 'bbbb0001-0000-0000-0000-000000000001',
      termId: TERM,
      recommendedTier: 'TIER_2',
      confidence: 0.92,
      evidenceIds: ['ev-001'],
    },
    interventionPlan: {
      planId: 'cccc0001-0000-0000-0000-000000000001',
      termId: TERM,
      goal: 'Improve reading fluency to 40th percentile',
      tier: 'TIER_2',
      strategy: 'Guided reading with decodable texts',
      ownerRole: 'Learning Support Educator',
      sbstRatificationId: 'dddd0001-0000-0000-0000-000000000001',
      evidenceIds: ['ev-001', 'ev-002'],
    },
    progressRecords: [
      {
        monitorId: 'eeee0001-0000-0000-0000-000000000001',
        termId: TERM,
        trendDirection: 'improving',
        recommendation: 'continue',
        currentPercentile: 32,
        goalPercentile: 40,
      },
    ],
    fidelityRecords: [
      {
        fidelityId: 'ffff0001-0000-0000-0000-000000000001',
        termId: TERM,
        fidelityRate: 88.5,
        adequate: true,
      },
    ],
    meetingMinutes: [
      {
        minutesId: 'gggg0001-0000-0000-0000-000000000001',
        termId: TERM,
        scheduledOn: '2026-07-15',
        decisions: [
          {
            learnerId: LEARNER,
            decision: 'ratify_intervention',
            sbstRatificationId: 'dddd0001-0000-0000-0000-000000000001',
          },
        ],
      },
    ],
    referralPack: null,
    parentReports: [
      {
        reportId: 'hhhh0001-0000-0000-0000-000000000001',
        termId: TERM,
        homeLanguage: 'zu',
        readabilityAdequate: true,
      },
    ],
    ...overrides,
  };
}

describe('buildCaseFile', () => {
  it('assembles a full case file from provided inputs', () => {
    const cf = buildCaseFile(baseInput());
    expect(cf.learnerId).toBe(LEARNER);
    expect(cf.tenantId).toBe(TENANT);
    expect(cf.siasStatus).toBe('INTERVENTION_ACTIVE');
    expect(cf.safeguardingEscalated).toBe(false);
    expect(cf.screenHistory).toHaveLength(1);
    expect(cf.latestTierRecommendation?.recommendedTier).toBe('TIER_2');
    expect(cf.interventionPlan?.tier).toBe('TIER_2');
    expect(cf.progressRecords).toHaveLength(1);
    expect(cf.fidelityRecords).toHaveLength(1);
    expect(cf.meetingMinutes).toHaveLength(1);
    expect(cf.referralPack).toBeNull();
    expect(cf.parentReports).toHaveLength(1);
  });

  it('carries through the SIAS status correctly', () => {
    const cf = buildCaseFile(baseInput({ siasStatus: 'REFERRAL_PENDING' }));
    expect(cf.siasStatus).toBe('REFERRAL_PENDING');
  });

  it('includes the referral pack when present', () => {
    const cf = buildCaseFile(
      baseInput({
        siasStatus: 'REFERRED',
        referralPack: {
          compilationId: 'iiii0001-0000-0000-0000-000000000001',
          termId: TERM,
          sbstRatificationId: 'dddd0001-0000-0000-0000-000000000001',
          sectionCount: 5,
        },
      }),
    );
    expect(cf.referralPack).not.toBeNull();
    expect(cf.referralPack?.sectionCount).toBe(5);
  });

  it('clears all history when safeguarding is escalated', () => {
    const cf = buildCaseFile(baseInput({ safeguardingEscalated: true }));
    expect(cf.safeguardingEscalated).toBe(true);
    expect(cf.screenHistory).toHaveLength(0);
    expect(cf.latestTierRecommendation).toBeNull();
    expect(cf.interventionPlan).toBeNull();
    expect(cf.progressRecords).toHaveLength(0);
    expect(cf.fidelityRecords).toHaveLength(0);
    expect(cf.meetingMinutes).toHaveLength(0);
    expect(cf.referralPack).toBeNull();
    expect(cf.parentReports).toHaveLength(0);
  });

  it('preserves siasStatus even when safeguarding is escalated', () => {
    const cf = buildCaseFile(
      baseInput({ safeguardingEscalated: true, siasStatus: 'SAFEGUARDING_ESCALATED' }),
    );
    expect(cf.siasStatus).toBe('SAFEGUARDING_ESCALATED');
    expect(cf.safeguardingEscalated).toBe(true);
  });

  it('handles a learner with no intervention plan', () => {
    const cf = buildCaseFile(
      baseInput({ interventionPlan: null, siasStatus: 'SCREENED' }),
    );
    expect(cf.interventionPlan).toBeNull();
    expect(cf.siasStatus).toBe('SCREENED');
  });

  it('handles a learner at EXITED status', () => {
    const cf = buildCaseFile(baseInput({ siasStatus: 'EXITED', interventionPlan: null }));
    expect(cf.siasStatus).toBe('EXITED');
  });

  it('handles multiple screen history entries', () => {
    const cf = buildCaseFile(
      baseInput({
        screenHistory: [
          {
            screenId: 'aaaa0001-0000-0000-0000-000000000001',
            termId: TERM,
            compositePercentile: 28,
            tier: 'TIER_2',
            overallSufficiency: 'sufficient',
          },
          {
            screenId: 'aaaa0002-0000-0000-0000-000000000001',
            termId: TERM,
            compositePercentile: 32,
            tier: 'TIER_2',
            overallSufficiency: 'sufficient',
          },
        ],
      }),
    );
    expect(cf.screenHistory).toHaveLength(2);
  });

  it('handles multiple parent reports', () => {
    const cf = buildCaseFile(
      baseInput({
        parentReports: [
          {
            reportId: 'hhhh0001-0000-0000-0000-000000000001',
            termId: TERM,
            homeLanguage: 'zu',
            readabilityAdequate: true,
          },
          {
            reportId: 'hhhh0002-0000-0000-0000-000000000001',
            termId: TERM,
            homeLanguage: 'en',
            readabilityAdequate: true,
          },
        ],
      }),
    );
    expect(cf.parentReports).toHaveLength(2);
  });

  it('handles no meeting minutes', () => {
    const cf = buildCaseFile(baseInput({ meetingMinutes: [] }));
    expect(cf.meetingMinutes).toHaveLength(0);
  });
});
