import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_TIERS, getTier, type SubscriptionTier } from '../src/tiers';

describe('SUBSCRIPTION_TIERS', () => {
  it('defines starter, standard, and enterprise tiers', () => {
    expect(Object.keys(SUBSCRIPTION_TIERS)).toEqual(
      expect.arrayContaining(['starter', 'standard', 'enterprise']),
    );
  });

  it('starter tier has zero monthly base cost', () => {
    expect(getTier('starter').monthlyBaseCents).toBe(0);
  });

  it('enterprise tier has zero per-kilo-token overage cost', () => {
    expect(getTier('enterprise').perKiloTokenOverageCents).toBe(0);
  });

  it('each tier has strictly increasing token limits', () => {
    const starter = getTier('starter');
    const standard = getTier('standard');
    const enterprise = getTier('enterprise');
    expect(starter.monthlyTokenLimit).toBeLessThan(standard.monthlyTokenLimit);
    expect(standard.monthlyTokenLimit).toBeLessThan(enterprise.monthlyTokenLimit);
  });

  it('each tier has strictly increasing included learner counts', () => {
    const starter = getTier('starter');
    const standard = getTier('standard');
    const enterprise = getTier('enterprise');
    expect(starter.includedLearners).toBeLessThan(standard.includedLearners);
    expect(standard.includedLearners).toBeLessThan(enterprise.includedLearners);
  });

  it('all monetary values are non-negative integers', () => {
    for (const tier of Object.values(SUBSCRIPTION_TIERS) as SubscriptionTier[]) {
      expect(tier.monthlyBaseCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(tier.monthlyBaseCents)).toBe(true);
      expect(tier.perExtraLearnerCents).toBeGreaterThanOrEqual(0);
      expect(tier.perExtraEducatorCents).toBeGreaterThanOrEqual(0);
      expect(tier.perKiloTokenOverageCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('getTier', () => {
  it('returns the starter tier by name', () => {
    const tier = getTier('starter');
    expect(tier.name).toBe('starter');
  });

  it('returns the enterprise tier by name', () => {
    const tier = getTier('enterprise');
    expect(tier.name).toBe('enterprise');
  });

  it('throws for an unknown tier name', () => {
    expect(() => getTier('premium')).toThrow(/Unknown subscription tier/);
  });

  it('throws for an empty string', () => {
    expect(() => getTier('')).toThrow();
  });
});
