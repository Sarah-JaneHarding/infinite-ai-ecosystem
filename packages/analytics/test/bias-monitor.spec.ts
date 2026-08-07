// Bias monitor — unit tests (Stage 10 step 7)
//
// Exit gate: "Bias monitor fires on the skewed fixture."

import { describe, expect, it } from 'vitest';

import {
  BIAS_RATIO_THRESHOLD,
  MIN_POPULATION_FOR_BIAS_CHECK,
  monitorBias,
  type GroupTierCounts,
} from '../src/bias-monitor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function counts(
  tier1: number,
  tier2: number,
  tier3: number,
  referral: number,
): GroupTierCounts {
  return { TIER_1: tier1, TIER_2: tier2, TIER_3: tier3, REFERRAL: referral };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('monitorBias', () => {
  it('fires on a deliberately skewed fixture', () => {
    // Population: 5% REFERRAL rate
    // Group A: 5% REFERRAL — normal
    // Group B: 15% REFERRAL — 3x the population rate (above 2x threshold)
    const result = monitorBias({
      populationCounts: counts(180, 10, 5, 5), // 200 total, 2.5% referral
      groupCounts: {
        groupA: counts(90, 5, 3, 2), // 100 total, 2% referral — fine
        groupB: counts(60, 15, 8, 17), // 100 total, 17% referral — fired
      },
    });
    expect(result.fired).toBe(true);
    const firedGroups = result.findings.map((f) => f.group);
    expect(firedGroups).toContain('groupB');
    expect(firedGroups).not.toContain('groupA');
  });

  it('does not fire on a balanced fixture', () => {
    const result = monitorBias({
      populationCounts: counts(160, 20, 10, 10), // 10% referral
      groupCounts: {
        groupA: counts(80, 10, 5, 5), // 10% referral
        groupB: counts(80, 10, 5, 5), // 10% referral
      },
    });
    expect(result.fired).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  it('does not fire when a group is just below the ratio threshold', () => {
    // Population 10% referral, group at exactly 2x = 20% — below the strict > threshold
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10), // exactly 10%
      groupCounts: {
        marginalGroup: counts(40, 0, 0, 10), // 20% = exactly BIAS_RATIO_THRESHOLD × 10%
      },
    });
    // ratio = 2.0 which is NOT > 2.0 — should not fire
    expect(result.fired).toBe(false);
  });

  it('fires when a group exceeds ratio threshold strictly', () => {
    // Population 10%, group at 21% — ratio 2.1
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10),
      groupCounts: {
        skewedGroup: counts(39, 0, 0, 11), // 21.6% referral, ratio ~2.16
      },
    });
    expect(result.fired).toBe(true);
  });

  it('does not fire for groups with too few learners', () => {
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10),
      groupCounts: {
        tinyGroup: counts(0, 0, 0, 9), // 100% referral but only 9 learners — below MIN
      },
    });
    expect(result.fired).toBe(false);
  });

  it(`fires for groups at exactly MIN_POPULATION_FOR_BIAS_CHECK (${MIN_POPULATION_FOR_BIAS_CHECK})`, () => {
    // Group of exactly 10 with 100% referral vs 10% population
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10),
      groupCounts: {
        minGroup: counts(0, 0, 0, 10), // 10 learners, all REFERRAL
      },
    });
    expect(result.fired).toBe(true);
  });

  it('does not fire when population referral rate is zero', () => {
    const result = monitorBias({
      populationCounts: counts(200, 0, 0, 0), // 0% referral
      groupCounts: {
        groupA: counts(100, 0, 0, 0),
        groupB: counts(50, 50, 0, 0),
      },
    });
    expect(result.fired).toBe(false);
  });

  it('includes group referral rate and population referral rate in findings', () => {
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10), // 10%
      groupCounts: {
        hotGroup: counts(39, 0, 0, 11), // ~21.6%
      },
    });
    expect(result.fired).toBe(true);
    const finding = result.findings[0];
    expect(finding).toBeDefined();
    expect(finding?.groupReferralRate).toBeCloseTo(11 / 50);
    expect(finding?.populationReferralRate).toBeCloseTo(10 / 100);
    expect(finding?.ratio).toBeGreaterThan(BIAS_RATIO_THRESHOLD);
  });

  it('identifies multiple fired groups in one call', () => {
    const result = monitorBias({
      populationCounts: counts(90, 0, 0, 10),
      groupCounts: {
        fired1: counts(37, 0, 0, 13), // 26% referral, ratio ~2.6
        fired2: counts(35, 0, 0, 15), // 30% referral, ratio 3x
        ok: counts(47, 0, 0, 3), // 6% referral, below threshold
      },
    });
    expect(result.fired).toBe(true);
    const groups = result.findings.map((f) => f.group).sort();
    expect(groups).toContain('fired1');
    expect(groups).toContain('fired2');
    expect(groups).not.toContain('ok');
  });

  it('BIAS_RATIO_THRESHOLD is 2.0', () => {
    expect(BIAS_RATIO_THRESHOLD).toBe(2.0);
  });

  it('MIN_POPULATION_FOR_BIAS_CHECK is a positive integer', () => {
    expect(MIN_POPULATION_FOR_BIAS_CHECK).toBeGreaterThan(0);
    expect(Number.isInteger(MIN_POPULATION_FOR_BIAS_CHECK)).toBe(true);
  });
});
