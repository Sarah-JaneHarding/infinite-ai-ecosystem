// Tier model unit tests — Stage 10 step 1.
//
// The tier model is pure arithmetic: a percentile score in, a tier out, and a
// data-sufficiency check that returns 'insufficient' whenever the caller cannot
// support a recommendation. These tests prove every band boundary, every branch in
// the sufficiency check, and the cross-domain aggregation that blocks a recommendation
// when any single domain is stale.

import { describe, expect, it } from 'vitest';

import {
  DATA_SUFFICIENCY_REQUIREMENTS,
  DEFAULT_TIER_BANDS,
  SCREENING_DOMAINS,
  assignTier,
  checkAllDomainsSufficiency,
  checkDataSufficiency,
  type ScreeningDomain,
} from '../src/index.js';

describe('assignTier', () => {
  it('assigns REFERRAL for scores below 15', () => {
    expect(assignTier(0)).toBe('REFERRAL');
    expect(assignTier(14)).toBe('REFERRAL');
    expect(assignTier(14.9)).toBe('REFERRAL');
  });

  it('assigns TIER_3 for scores from 15 up to (but not including) 35', () => {
    expect(assignTier(15)).toBe('TIER_3');
    expect(assignTier(25)).toBe('TIER_3');
    expect(assignTier(34.9)).toBe('TIER_3');
  });

  it('assigns TIER_2 for scores from 35 up to (but not including) 55', () => {
    expect(assignTier(35)).toBe('TIER_2');
    expect(assignTier(45)).toBe('TIER_2');
    expect(assignTier(54.9)).toBe('TIER_2');
  });

  it('assigns TIER_1 for scores from 55 upward', () => {
    expect(assignTier(55)).toBe('TIER_1');
    expect(assignTier(75)).toBe('TIER_1');
    expect(assignTier(100)).toBe('TIER_1');
  });

  it('falls back to TIER_1 for scores at or above the ceiling of the last band', () => {
    // 101 is above every scoreBelow in DEFAULT_TIER_BANDS — the for-loop exits
    // without returning, so the fallback return at the end of assignTier fires.
    expect(assignTier(101)).toBe('TIER_1');
    expect(assignTier(200)).toBe('TIER_1');
  });

  it('accepts custom bands and applies them in order', () => {
    const customBands = [
      { tier: 'TIER_3' as const, scoreBelow: 25 },
      { tier: 'TIER_1' as const, scoreBelow: 101 },
    ];
    expect(assignTier(10, customBands)).toBe('TIER_3');
    expect(assignTier(50, customBands)).toBe('TIER_1');
  });

  it('covers every entry in DEFAULT_TIER_BANDS with an explicit case', () => {
    for (const band of DEFAULT_TIER_BANDS) {
      const justBelow = band.scoreBelow - 0.1;
      if (justBelow >= 0) {
        expect(assignTier(justBelow)).toBe(band.tier);
      }
    }
  });
});

describe('checkDataSufficiency — single domain', () => {
  it('returns sufficient when data points and recency both meet requirements', () => {
    expect(checkDataSufficiency('LITERACY', 3, 30)).toBe('sufficient');
    expect(checkDataSufficiency('ATTENDANCE', 10, 15)).toBe('sufficient');
    expect(checkDataSufficiency('WELLBEING', 1, 0)).toBe('sufficient');
  });

  it('returns insufficient when data point count is below the minimum', () => {
    expect(checkDataSufficiency('LITERACY', 2, 30)).toBe('insufficient');
    expect(checkDataSufficiency('NUMERACY', 0, 10)).toBe('insufficient');
    expect(checkDataSufficiency('BEHAVIOUR', 1, 30)).toBe('insufficient');
  });

  it('returns insufficient when the most recent data point is too old', () => {
    expect(checkDataSufficiency('LITERACY', 5, 91)).toBe('insufficient');
    expect(checkDataSufficiency('ATTENDANCE', 15, 31)).toBe('insufficient');
    expect(checkDataSufficiency('WELLBEING', 2, 90 + 1)).toBe('insufficient');
  });

  it('treats the recency boundary as inclusive (exactly recencyWindowDays is sufficient)', () => {
    // LITERACY requires data within 90 days; a 90-day-old record is still valid.
    expect(checkDataSufficiency('LITERACY', 3, 90)).toBe('sufficient');
    expect(checkDataSufficiency('ATTENDANCE', 10, 30)).toBe('sufficient');
  });

  it('is consistent with the DATA_SUFFICIENCY_REQUIREMENTS table for each domain', () => {
    for (const domain of SCREENING_DOMAINS) {
      const req = DATA_SUFFICIENCY_REQUIREMENTS[domain];
      // Exactly at the boundary → sufficient.
      expect(
        checkDataSufficiency(domain, req.minimumDataPoints, req.recencyWindowDays),
      ).toBe('sufficient');
      // One data point short → insufficient.
      expect(
        checkDataSufficiency(domain, req.minimumDataPoints - 1, req.recencyWindowDays),
      ).toBe('insufficient');
      // One day too old → insufficient.
      expect(
        checkDataSufficiency(domain, req.minimumDataPoints, req.recencyWindowDays + 1),
      ).toBe('insufficient');
    }
  });
});

describe('checkAllDomainsSufficiency', () => {
  const allSufficient = SCREENING_DOMAINS.map((domain) => ({
    domain,
    dataPointCount: DATA_SUFFICIENCY_REQUIREMENTS[domain].minimumDataPoints,
    mostRecentDataAgeInDays: 0,
  }));

  it('returns overall: sufficient when all domains are sufficient', () => {
    const result = checkAllDomainsSufficiency(allSufficient);
    expect(result.overall).toBe('sufficient');
    for (const domain of SCREENING_DOMAINS) {
      expect(result.byDomain[domain]).toBe('sufficient');
    }
  });

  it('returns overall: insufficient and flags the failing domain when one domain fails', () => {
    const readings = allSufficient.map((r) =>
      r.domain === 'ATTENDANCE'
        ? { ...r, dataPointCount: 0 } // below minimum for ATTENDANCE
        : r,
    );
    const result = checkAllDomainsSufficiency(readings);
    expect(result.overall).toBe('insufficient');
    expect(result.byDomain['ATTENDANCE']).toBe('insufficient');
    // All other domains remain sufficient.
    for (const domain of SCREENING_DOMAINS.filter((d) => d !== 'ATTENDANCE')) {
      expect(result.byDomain[domain as ScreeningDomain]).toBe('sufficient');
    }
  });

  it('flags multiple failing domains independently', () => {
    const readings = allSufficient.map((r) =>
      r.domain === 'LITERACY' || r.domain === 'WELLBEING'
        ? { ...r, mostRecentDataAgeInDays: 999 } // stale
        : r,
    );
    const result = checkAllDomainsSufficiency(readings);
    expect(result.overall).toBe('insufficient');
    expect(result.byDomain['LITERACY']).toBe('insufficient');
    expect(result.byDomain['WELLBEING']).toBe('insufficient');
    expect(result.byDomain['NUMERACY']).toBe('sufficient');
  });

  it('returns overall: sufficient on an empty readings array', () => {
    // No domains checked → nothing is blocking.
    const result = checkAllDomainsSufficiency([]);
    expect(result.overall).toBe('sufficient');
  });
});
