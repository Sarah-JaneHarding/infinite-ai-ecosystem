import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_TIERS, getTier, type SubscriptionTier } from '../src/tiers.js';

describe('SUBSCRIPTION_TIERS', () => {
  it('defines starter, standard, and enterprise tiers', () => {
    expect(Object.keys(SUBSCRIPTION_TIERS)).toEqual(
      expect.arrayContaining(['starter', 'standard', 'enterprise']),
    );
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

  it('tiers carry no seat prices: seats follow the per-school formula (OQ-043)', () => {
    for (const tier of Object.values(SUBSCRIPTION_TIERS) as SubscriptionTier[]) {
      expect(Object.keys(tier).sort()).toEqual([
        'monthlyTokenLimit',
        'name',
        'perKiloTokenOverageCents',
      ]);
    }
  });

  it('all monetary values are non-negative integers', () => {
    for (const tier of Object.values(SUBSCRIPTION_TIERS) as SubscriptionTier[]) {
      expect(tier.perKiloTokenOverageCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(tier.perKiloTokenOverageCents)).toBe(true);
      expect(Number.isInteger(tier.monthlyTokenLimit)).toBe(true);
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
