import { describe, it, expect } from 'vitest';
import { buildInvoice, VAT_RATE } from '../src/invoicing';
import {
  aggregateMeteringEvents,
  computeOverage,
  type PeriodUsage,
} from '../src/metering';
import { getTier } from '../src/tiers';

const TENANT = 'tenant-abc';
const START = new Date('2026-08-01T00:00:00Z');
const END = new Date('2026-09-01T00:00:00Z');

function makeUsage(tokens: number, learners: number, educators: number): PeriodUsage {
  return aggregateMeteringEvents(
    tokens > 0
      ? [
          {
            tenantId: TENANT,
            at: new Date('2026-08-15T00:00:00Z'),
            agentId: 'a1',
            tokensUsed: tokens,
            costCents: 0,
          },
        ]
      : [],
    TENANT,
    START,
    END,
    learners,
    educators,
  );
}

describe('buildInvoice', () => {
  describe('starter tier — no overages', () => {
    const tier = getTier('starter');

    it('produces exactly one line item (base subscription)', () => {
      const usage = makeUsage(0, 100, 5);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      expect(invoice.lineItems).toHaveLength(1);
      expect(invoice.lineItems[0]?.description).toMatch(/starter subscription/i);
    });

    it('subtotal is R0 for starter with no overages', () => {
      const usage = makeUsage(0, 0, 0);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      expect(invoice.subtotalCents).toBe(0);
      expect(invoice.vatCents).toBe(0);
      expect(invoice.totalCents).toBe(0);
    });
  });

  describe('standard tier — with overages', () => {
    const tier = getTier('standard');

    it('adds a learner overage line item when learners exceed included count', () => {
      // standard: 1500 included. Use 1600 → 100 overage.
      const usage = makeUsage(0, 1_600, 0);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      const learnerLine = invoice.lineItems.find((l) =>
        l.description.includes('learner'),
      );
      expect(learnerLine).toBeDefined();
      expect(learnerLine?.quantity).toBe(100);
      expect(learnerLine?.totalCents).toBe(100 * tier.perExtraLearnerCents);
    });

    it('adds an educator overage line item when educators exceed included count', () => {
      // standard: 100 included. Use 110 → 10 overage.
      const usage = makeUsage(0, 0, 110);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      const educatorLine = invoice.lineItems.find((l) =>
        l.description.includes('educator'),
      );
      expect(educatorLine).toBeDefined();
      expect(educatorLine?.quantity).toBe(10);
    });

    it('adds a token overage line item when tokens exceed the monthly limit', () => {
      // standard: 100_000_000 limit. Use 101_000_000 → 1000 kilo tokens.
      const usage = makeUsage(101_000_000, 0, 0);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      const tokenLine = invoice.lineItems.find((l) => l.description.includes('token'));
      expect(tokenLine).toBeDefined();
      expect(tokenLine?.quantity).toBe(1_000);
      expect(tokenLine?.totalCents).toBe(1_000 * tier.perKiloTokenOverageCents);
    });

    it('computes VAT at 15% on subtotal (rounded to nearest cent)', () => {
      const usage = makeUsage(0, 1_600, 0);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      expect(invoice.vatCents).toBe(Math.round(invoice.subtotalCents * VAT_RATE));
    });

    it('totalCents equals subtotalCents + vatCents', () => {
      const usage = makeUsage(101_000_000, 1_600, 110);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      expect(invoice.totalCents).toBe(invoice.subtotalCents + invoice.vatCents);
    });
  });

  describe('invoice metadata', () => {
    it('carries tenantId and period dates', () => {
      const tier = getTier('starter');
      const usage = makeUsage(0, 0, 0);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      expect(invoice.tenantId).toBe(TENANT);
      expect(invoice.periodStart).toEqual(START);
      expect(invoice.periodEnd).toEqual(END);
      expect(invoice.tierName).toBe('starter');
    });

    it('does not add overage line items when overage is zero', () => {
      const tier = getTier('enterprise');
      // enterprise: 10_000 learners, 500 educators, no token overage. Use well under limits.
      const usage = makeUsage(0, 100, 5);
      const overage = computeOverage(usage, tier);
      const invoice = buildInvoice(usage, tier, overage);
      // Only base subscription line should be present
      expect(invoice.lineItems).toHaveLength(1);
    });
  });
});
