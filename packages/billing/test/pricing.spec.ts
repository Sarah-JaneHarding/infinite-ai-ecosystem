import { describe, it, expect } from 'vitest';
import {
  annualPrepayCents,
  MINIMUM_MONTHLY_CENTS,
  priceBreakdown,
  splitVat,
} from '../src/pricing.js';

describe('priceBreakdown', () => {
  it('matches the reference prices: R1,380 / R3,100 / R7,925', () => {
    expect(priceBreakdown({ learners: 120, educators: 8 }).standardCents).toBe(138_000);
    expect(priceBreakdown({ learners: 400, educators: 16 }).standardCents).toBe(310_000);
    expect(priceBreakdown({ learners: 1_500, educators: 55 }).standardCents).toBe(
      792_500,
    );
  });

  it('charges R1.50 per learner above 500', () => {
    const a = priceBreakdown({ learners: 500, educators: 0 }).formulaCents;
    const b = priceBreakdown({ learners: 600, educators: 0 }).formulaCents;
    expect(b - a).toBe(100 * 150);
  });

  it('never goes below the minimum and reports the top-up', () => {
    const p = priceBreakdown({ learners: 0, educators: 0 });
    expect(p.formulaCents).toBe(30_000);
    expect(p.standardCents).toBe(MINIMUM_MONTHLY_CENTS);
    expect(p.minimumTopUpCents).toBe(MINIMUM_MONTHLY_CENTS - 30_000);
  });

  it('community rate is 50 % of the standard (post-minimum) price', () => {
    expect(priceBreakdown({ learners: 0, educators: 0 }).communityCents).toBe(37_500);
    expect(priceBreakdown({ learners: 400, educators: 16 }).communityCents).toBe(155_000);
  });

  it('rejects negative, fractional and non-finite counts', () => {
    expect(() => priceBreakdown({ learners: -1, educators: 1 })).toThrow(/learners/);
    expect(() => priceBreakdown({ learners: 10, educators: 1.5 })).toThrow(/educators/);
    expect(() => priceBreakdown({ learners: Number.NaN, educators: 1 })).toThrow();
  });
});

describe('splitVat', () => {
  it('splits R3,100.00 into R465.00 VAT and R3,565.00 inc VAT', () => {
    expect(splitVat(310_000)).toEqual({
      exVatCents: 310_000,
      vatCents: 46_500,
      incVatCents: 356_500,
    });
  });

  it('rounds VAT to the nearest cent and inc = ex + vat always', () => {
    for (const ex of [1, 7, 33, 99_999, 138_001]) {
      const s = splitVat(ex);
      expect(s.incVatCents).toBe(s.exVatCents + s.vatCents);
      expect(Math.abs(s.vatCents - ex * 0.15)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('annualPrepayCents', () => {
  it('is twelve months less 10 %', () => {
    expect(annualPrepayCents(310_000)).toBe(3_348_000);
  });
});
