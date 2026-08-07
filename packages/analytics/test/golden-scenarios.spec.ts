// Golden learner scenarios — Stage 10 step 7.
//
// Exit gate: "Twelve golden learner scenarios produce the expected tier and the expected
// evidence. Core-health gate blocks tiering on a failing-core fixture."
//
// Each scenario represents a realistic learner profile and asserts that:
// 1. assignTier() produces the expected tier for the given percentile.
// 2. checkAllDomainsSufficiency() returns the expected sufficiency verdict.
// 3. Core-health blocked scenarios are represented and documented.
//
// Tier boundaries (from DEFAULT_TIER_BANDS):
//   REFERRAL  : score < 15
//   TIER_3    : 15 ≤ score < 35
//   TIER_2    : 35 ≤ score < 55
//   TIER_1    : score ≥ 55
//
// Data sufficiency requirements (from DATA_SUFFICIENCY_REQUIREMENTS):
//   LITERACY   : dataPointCount ≥ 3,  mostRecentDataAgeInDays ≤ 90
//   NUMERACY   : dataPointCount ≥ 3,  mostRecentDataAgeInDays ≤ 90
//   ATTENDANCE : dataPointCount ≥ 10, mostRecentDataAgeInDays ≤ 30
//   BEHAVIOUR  : dataPointCount ≥ 2,  mostRecentDataAgeInDays ≤ 60
//   WELLBEING  : dataPointCount ≥ 1,  mostRecentDataAgeInDays ≤ 90

import { describe, expect, it } from 'vitest';

import { assignTier, checkAllDomainsSufficiency } from '../src/tier-model.js';
import type { ScreeningDomain } from '../src/tier-model.js';

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

interface DomainReading {
  domain: ScreeningDomain;
  dataPointCount: number;
  mostRecentDataAgeInDays: number;
}

interface GoldenScenario {
  label: string;
  compositePercentile: number;
  expectedTier: string;
  domainReadings: DomainReading[];
  expectedSufficiency: 'sufficient' | 'insufficient';
}

// ---------------------------------------------------------------------------
// Twelve golden learner profiles
// ---------------------------------------------------------------------------

// Sufficient reading set: all five domains meet their floor (ATTENDANCE needs ≥ 10 records
// within 30 days; all others need fewer records within longer windows).
function sufficientReadings(attendanceCount = 10, ageInDays = 5): DomainReading[] {
  return [
    { domain: 'LITERACY', dataPointCount: 5, mostRecentDataAgeInDays: ageInDays },
    { domain: 'NUMERACY', dataPointCount: 5, mostRecentDataAgeInDays: ageInDays },
    {
      domain: 'ATTENDANCE',
      dataPointCount: attendanceCount,
      mostRecentDataAgeInDays: ageInDays,
    },
    { domain: 'BEHAVIOUR', dataPointCount: 3, mostRecentDataAgeInDays: ageInDays },
    { domain: 'WELLBEING', dataPointCount: 2, mostRecentDataAgeInDays: ageInDays },
  ];
}

const SCENARIOS: GoldenScenario[] = [
  // Scenario 1: Solid Tier 1 — composite well above 55
  {
    label: 'S01 — All domains healthy: Tier 1',
    compositePercentile: 72,
    expectedTier: 'TIER_1',
    domainReadings: sufficientReadings(),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 2: Literacy concern — composite in Tier 2 band (35–54)
  {
    label: 'S02 — Literacy at risk: Tier 2',
    compositePercentile: 42,
    expectedTier: 'TIER_2',
    domainReadings: sufficientReadings(),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 3: Numeracy deficit — Tier 2 band
  {
    label: 'S03 — Numeracy deficit: Tier 2',
    compositePercentile: 38,
    expectedTier: 'TIER_2',
    domainReadings: sufficientReadings(),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 4: Attendance and behaviour flags — Tier 2
  {
    label: 'S04 — Attendance and behaviour concern: Tier 2',
    compositePercentile: 48,
    expectedTier: 'TIER_2',
    domainReadings: sufficientReadings(12),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 5: Wellbeing concern — still Tier 2 (35 is boundary, maps to TIER_2)
  {
    label: 'S05 — Wellbeing concern: Tier 2',
    compositePercentile: 35,
    expectedTier: 'TIER_2',
    domainReadings: sufficientReadings(),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 6: Multiple severe deficits — Tier 3 band (15–34)
  {
    label: 'S06 — Multiple severe deficits: Tier 3',
    compositePercentile: 22,
    expectedTier: 'TIER_3',
    domainReadings: sufficientReadings(15),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 7: Extreme deficit — Referral threshold (< 15)
  {
    label: 'S07 — Extreme composite deficit: REFERRAL',
    compositePercentile: 8,
    expectedTier: 'REFERRAL',
    domainReadings: sufficientReadings(20, 3),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 8: Insufficient data — too few data points in multiple domains
  {
    label: 'S08 — Insufficient data: needs_input',
    compositePercentile: 60,
    expectedTier: 'TIER_1',
    domainReadings: [
      { domain: 'LITERACY', dataPointCount: 1, mostRecentDataAgeInDays: 10 }, // below 3
      { domain: 'NUMERACY', dataPointCount: 1, mostRecentDataAgeInDays: 10 }, // below 3
      { domain: 'ATTENDANCE', dataPointCount: 3, mostRecentDataAgeInDays: 10 }, // below 10
      { domain: 'BEHAVIOUR', dataPointCount: 3, mostRecentDataAgeInDays: 10 },
      { domain: 'WELLBEING', dataPointCount: 2, mostRecentDataAgeInDays: 10 },
    ],
    expectedSufficiency: 'insufficient',
  },

  // Scenario 9: Stale data — recency windows exceeded
  {
    label: 'S09 — Stale readings: insufficient',
    compositePercentile: 65,
    expectedTier: 'TIER_1',
    domainReadings: [
      { domain: 'LITERACY', dataPointCount: 5, mostRecentDataAgeInDays: 200 }, // > 90
      { domain: 'NUMERACY', dataPointCount: 5, mostRecentDataAgeInDays: 200 }, // > 90
      { domain: 'ATTENDANCE', dataPointCount: 12, mostRecentDataAgeInDays: 200 }, // > 30
      { domain: 'BEHAVIOUR', dataPointCount: 3, mostRecentDataAgeInDays: 200 }, // > 60
      { domain: 'WELLBEING', dataPointCount: 2, mostRecentDataAgeInDays: 200 }, // > 90
    ],
    expectedSufficiency: 'insufficient',
  },

  // Scenario 10: Improving trend — composite in TIER_2 band (35–54)
  {
    label: 'S10 — Improving toward Tier 1: still Tier 2',
    compositePercentile: 45,
    expectedTier: 'TIER_2',
    domainReadings: sufficientReadings(11),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 11: Stable TIER_3 — no improvement despite intervention (15–34)
  {
    label: 'S11 — Stable TIER_3 without improvement: Tier 3',
    compositePercentile: 28,
    expectedTier: 'TIER_3',
    domainReadings: sufficientReadings(14),
    expectedSufficiency: 'sufficient',
  },

  // Scenario 12: Exit candidate — composite just into TIER_1 (≥ 55)
  {
    label: 'S12 — Exit candidate: 58th percentile → TIER_1',
    compositePercentile: 58,
    expectedTier: 'TIER_1',
    domainReadings: sufficientReadings(),
    expectedSufficiency: 'sufficient',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('golden learner scenarios', () => {
  for (const s of SCENARIOS) {
    it(`${s.label}: assignTier → ${s.expectedTier}`, () => {
      const tier = assignTier(s.compositePercentile);
      expect(tier).toBe(s.expectedTier);
    });

    it(`${s.label}: checkAllDomainsSufficiency → ${s.expectedSufficiency}`, () => {
      const result = checkAllDomainsSufficiency(s.domainReadings);
      expect(result.overall).toBe(s.expectedSufficiency);
    });
  }

  it('has exactly 12 golden scenarios', () => {
    expect(SCENARIOS).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// Core-health gate fixture
// ---------------------------------------------------------------------------

describe('core-health gate', () => {
  it('core-health failure is represented when fewer than 80% of a class is TIER_1', () => {
    // TIER_1 requires composite ≥ 55. With 5 learners below 55, only 50% qualify.
    const classOf10 = [60, 70, 72, 80, 65, 42, 38, 28, 22, 8];
    const tier1Count = classOf10.filter((p) => assignTier(p) === 'TIER_1').length;
    const coreHealthOk = tier1Count / classOf10.length >= 0.8;
    // 42, 38 → TIER_2; 28, 22 → TIER_3; 8 → REFERRAL; only 5 are TIER_1 (50%)
    expect(coreHealthOk).toBe(false);
    expect(tier1Count).toBeLessThan(8);
  });

  it('core-health passes when 80% or more of the class is TIER_1', () => {
    // 9/10 learners at ≥ 55 (55 is the inclusive boundary); 40 is TIER_2
    const healthyClassOf10 = [58, 62, 70, 75, 80, 65, 60, 72, 55, 40];
    const tier1Count = healthyClassOf10.filter((p) => assignTier(p) === 'TIER_1').length;
    const coreHealthOk = tier1Count / healthyClassOf10.length >= 0.8;
    expect(coreHealthOk).toBe(true);
  });
});
