import { describe, it, expect } from 'vitest';
import {
  aggregateMeteringEvents,
  computeOverage,
  type MeteringEvent,
} from '../src/metering';
import { getTier } from '../src/tiers';

const TENANT = 'tenant-abc';
const START = new Date('2026-08-01T00:00:00Z');
const END = new Date('2026-09-01T00:00:00Z');

function makeEvent(overrides: Partial<MeteringEvent> = {}): MeteringEvent {
  return {
    tenantId: TENANT,
    at: new Date('2026-08-15T12:00:00Z'),
    agentId: 'agent-001',
    tokensUsed: 1_000,
    costCents: 10,
    ...overrides,
  };
}

describe('aggregateMeteringEvents', () => {
  it('returns zero totals when there are no events', () => {
    const usage = aggregateMeteringEvents([], TENANT, START, END, 100, 5);
    expect(usage.totalTokens).toBe(0);
    expect(usage.totalCostCents).toBe(0);
    expect(usage.eventCount).toBe(0);
  });

  it('sums tokens and cost from multiple events', () => {
    const events = [
      makeEvent({ tokensUsed: 2_000, costCents: 20 }),
      makeEvent({ tokensUsed: 3_000, costCents: 30 }),
    ];
    const usage = aggregateMeteringEvents(events, TENANT, START, END, 100, 5);
    expect(usage.totalTokens).toBe(5_000);
    expect(usage.totalCostCents).toBe(50);
    expect(usage.eventCount).toBe(2);
  });

  it('excludes events for a different tenant', () => {
    const events = [
      makeEvent({ tenantId: 'other-tenant', tokensUsed: 5_000 }),
      makeEvent({ tokensUsed: 1_000 }),
    ];
    const usage = aggregateMeteringEvents(events, TENANT, START, END, 100, 5);
    expect(usage.totalTokens).toBe(1_000);
    expect(usage.eventCount).toBe(1);
  });

  it('excludes events before periodStart', () => {
    const events = [
      makeEvent({ at: new Date('2026-07-31T23:59:59Z'), tokensUsed: 9_999 }),
      makeEvent({ tokensUsed: 1_000 }),
    ];
    const usage = aggregateMeteringEvents(events, TENANT, START, END, 0, 0);
    expect(usage.eventCount).toBe(1);
  });

  it('excludes events at or after periodEnd', () => {
    const events = [
      makeEvent({ at: END, tokensUsed: 9_999 }),
      makeEvent({ tokensUsed: 1_000 }),
    ];
    const usage = aggregateMeteringEvents(events, TENANT, START, END, 0, 0);
    expect(usage.eventCount).toBe(1);
  });

  it('includes events exactly at periodStart', () => {
    const events = [makeEvent({ at: START, tokensUsed: 500 })];
    const usage = aggregateMeteringEvents(events, TENANT, START, END, 0, 0);
    expect(usage.eventCount).toBe(1);
  });

  it('preserves tenant metadata in the returned usage', () => {
    const usage = aggregateMeteringEvents([], TENANT, START, END, 300, 20);
    expect(usage.tenantId).toBe(TENANT);
    expect(usage.learnerCount).toBe(300);
    expect(usage.educatorCount).toBe(20);
    expect(usage.periodStart).toEqual(START);
    expect(usage.periodEnd).toEqual(END);
  });
});

describe('computeOverage', () => {
  const starterTier = getTier('starter');

  it('returns zero overages when usage is within limits', () => {
    const usage = aggregateMeteringEvents(
      [makeEvent({ tokensUsed: 1_000_000 })],
      TENANT,
      START,
      END,
      100, // within starter's 300 included learners
      5, // within starter's 20 included educators
    );
    const overage = computeOverage(usage, starterTier);
    expect(overage.tokenOverageKilos).toBe(0);
    expect(overage.learnerOverageCount).toBe(0);
    expect(overage.educatorOverageCount).toBe(0);
    expect(overage.totalOverageCents).toBe(0);
  });

  it('computes token overage correctly', () => {
    // starter limit: 10_000_000. Use 11_500_000 → 1_500 kilo tokens overage.
    const usage = aggregateMeteringEvents(
      [makeEvent({ tokensUsed: 11_500_000 })],
      TENANT,
      START,
      END,
      0,
      0,
    );
    const overage = computeOverage(usage, starterTier);
    expect(overage.tokenOverageKilos).toBe(1_500);
    expect(overage.tokenOverageCents).toBe(1_500 * starterTier.perKiloTokenOverageCents);
  });

  it('computes learner seat overage correctly', () => {
    // starter: 300 included. 350 actual → 50 overage.
    const usage = aggregateMeteringEvents([], TENANT, START, END, 350, 0);
    const overage = computeOverage(usage, starterTier);
    expect(overage.learnerOverageCount).toBe(50);
    expect(overage.learnerOverageCents).toBe(50 * starterTier.perExtraLearnerCents);
  });

  it('computes educator seat overage correctly', () => {
    // starter: 20 included. 25 actual → 5 overage.
    const usage = aggregateMeteringEvents([], TENANT, START, END, 0, 25);
    const overage = computeOverage(usage, starterTier);
    expect(overage.educatorOverageCount).toBe(5);
    expect(overage.educatorOverageCents).toBe(5 * starterTier.perExtraEducatorCents);
  });

  it('computes combined overage total', () => {
    const usage = aggregateMeteringEvents(
      [makeEvent({ tokensUsed: 11_000_000 })],
      TENANT,
      START,
      END,
      350,
      25,
    );
    const overage = computeOverage(usage, starterTier);
    expect(overage.totalOverageCents).toBe(
      overage.tokenOverageCents +
        overage.learnerOverageCents +
        overage.educatorOverageCents,
    );
  });

  it('enterprise tier has no token overage regardless of usage', () => {
    const enterprise = getTier('enterprise');
    const usage = aggregateMeteringEvents(
      [makeEvent({ tokensUsed: 5_000_000_000 })],
      TENANT,
      START,
      END,
      0,
      0,
    );
    const overage = computeOverage(usage, enterprise);
    expect(overage.tokenOverageCents).toBe(0);
  });
});
