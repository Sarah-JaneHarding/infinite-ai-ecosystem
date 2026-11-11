import { describe, it, expect } from 'vitest';
import { buildInvoice, VAT_RATE } from '../src/invoicing.js';
import {
  aggregateMeteringEvents,
  computeOverage,
  type PeriodUsage,
} from '../src/metering.js';
import { priceBreakdown } from '../src/pricing.js';
import { getTier } from '../src/tiers.js';

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

function invoiceFor(
  tokens: number,
  learners: number,
  educators: number,
  community = false,
  tierName = 'starter',
) {
  const tier = getTier(tierName);
  const usage = makeUsage(tokens, learners, educators);
  return buildInvoice(usage, tier, computeOverage(usage, tier), { community });
}

describe('buildInvoice (per-school formula, OQ-043)', () => {
  it('prices a 120-learner / 8-educator school at R1,380 ex VAT', () => {
    const inv = invoiceFor(0, 120, 8);
    expect(inv.subtotalCents).toBe(138_000);
    expect(inv.vatCents).toBe(20_700);
    expect(inv.totalCents).toBe(158_700);
  });

  it('prices a 400 / 16 school at R3,100 and a 1,500 / 55 school at R7,925 ex VAT', () => {
    expect(invoiceFor(0, 400, 16).subtotalCents).toBe(310_000);
    expect(invoiceFor(0, 1_500, 55).subtotalCents).toBe(792_500);
  });

  it('lists platform fee, educators, learners and the learners-above-500 band in order', () => {
    const inv = invoiceFor(0, 800, 26);
    expect(inv.lineItems.map((l) => l.description.split(' (')[0])).toEqual([
      'Platform fee',
      'Educators',
      'Learners, first 500',
      'Learners above 500',
    ]);
  });

  it('tops a tiny school up to the R750 minimum with an explicit line', () => {
    const inv = invoiceFor(0, 10, 1);
    expect(inv.subtotalCents).toBe(75_000);
    expect(
      inv.lineItems.some((l) => l.description.startsWith('Minimum monthly charge')),
    ).toBe(true);
  });

  it('applies the community rate as a negative line after the minimum', () => {
    const inv = invoiceFor(0, 10, 1, true);
    expect(inv.subtotalCents).toBe(37_500);
    const line = inv.lineItems.find((l) => l.description.startsWith('Community rate'));
    expect(line?.totalCents).toBe(-37_500);
  });

  it('adds a token overage line only when tokens exceed the tier quota', () => {
    const tier = getTier('standard');
    const inv = invoiceFor(101_000_000, 0, 0, false, 'standard');
    const tokenLine = inv.lineItems.find((l) => l.description.includes('Token overage'));
    expect(tokenLine?.quantity).toBe(1_000);
    expect(tokenLine?.totalCents).toBe(1_000 * tier.perKiloTokenOverageCents);
    expect(
      invoiceFor(0, 120, 8).lineItems.some((l) =>
        l.description.includes('Token overage'),
      ),
    ).toBe(false);
  });

  it('computes VAT at 15 % of the subtotal and total = subtotal + VAT', () => {
    const inv = invoiceFor(101_000_000, 1_600, 110, false, 'standard');
    expect(inv.vatCents).toBe(Math.round(inv.subtotalCents * VAT_RATE));
    expect(inv.totalCents).toBe(inv.subtotalCents + inv.vatCents);
  });

  it('line items sum to the subtotal and the subtotal matches priceBreakdown', () => {
    const inv = invoiceFor(0, 577, 18);
    expect(inv.lineItems.reduce((s, l) => s + l.totalCents, 0)).toBe(inv.subtotalCents);
    expect(inv.subtotalCents).toBe(
      priceBreakdown({ learners: 577, educators: 18 }).standardCents,
    );
  });

  it('carries tenantId, period dates and tier name', () => {
    const inv = invoiceFor(0, 120, 8);
    expect(inv.tenantId).toBe(TENANT);
    expect(inv.periodStart).toEqual(START);
    expect(inv.periodEnd).toEqual(END);
    expect(inv.tierName).toBe('starter');
  });
});
