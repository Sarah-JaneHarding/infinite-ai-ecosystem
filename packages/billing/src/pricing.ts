// ---------------------------------------------------------------------------
// Per-school price formula — OQ-043 (decided 2026-11-11, provisional)
//
// A school's monthly subscription is
//   platform fee + per-educator + per-learner (first 500) + per-learner (above 500),
// never less than the minimum. A community rate halves it for no-fee and
// low-budget public schools. All amounts are ZAR cents (integers; no floating-point
// money). Prices are PROVISIONAL until three schools have seen them.
//
// This file is the single source of truth. docs/COST_MODEL.md,
// docs/ONBOARDING_GUIDE.md and docs/financial-model.html must agree with it;
// packages/billing/test/price-parity.spec.ts fails when they do not.
// ---------------------------------------------------------------------------

export const PLATFORM_FEE_CENTS = 30_000; // R300 per school per month
export const PER_EDUCATOR_CENTS = 7_500; // R75 per educator per month
export const PER_LEARNER_CENTS = 400; // R4.00 per learner per month, first 500
export const LEARNER_STEP_AT = 500; // learners priced at PER_LEARNER_CENTS
export const PER_LEARNER_ABOVE_STEP_CENTS = 150; // R1.50 per learner above 500
export const MINIMUM_MONTHLY_CENTS = 75_000; // R750 minimum per school per month
export const COMMUNITY_RATE_PERCENT = 50; // community rate = 50 % of the standard price
export const ANNUAL_PREPAY_DISCOUNT_PERCENT = 10; // 10 % off when a year is paid up front
export const VAT_PERCENT = 15; // South African standard rate

export interface SchoolSize {
  readonly learners: number;
  readonly educators: number;
}

export interface PriceBreakdown {
  readonly platformFeeCents: number;
  readonly educatorCents: number;
  readonly learnerCents: number;
  readonly learnerAboveStepCents: number;
  readonly formulaCents: number;
  // Top-up applied when the formula is below the minimum (0 otherwise).
  readonly minimumTopUpCents: number;
  // Standard monthly price ex VAT.
  readonly standardCents: number;
  // Community-rate monthly price ex VAT (50 % of the standard price).
  readonly communityCents: number;
}

export interface VatSplit {
  readonly exVatCents: number;
  readonly vatCents: number;
  readonly incVatCents: number;
}

function assertCount(name: string, n: number): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${String(n)}`);
  }
}

/** Monthly price for a school of the given size, ex VAT, in ZAR cents. */
export function priceBreakdown(size: SchoolSize): PriceBreakdown {
  assertCount('learners', size.learners);
  assertCount('educators', size.educators);
  const platformFeeCents = PLATFORM_FEE_CENTS;
  const educatorCents = size.educators * PER_EDUCATOR_CENTS;
  const learnerCents = Math.min(size.learners, LEARNER_STEP_AT) * PER_LEARNER_CENTS;
  const learnerAboveStepCents =
    Math.max(size.learners - LEARNER_STEP_AT, 0) * PER_LEARNER_ABOVE_STEP_CENTS;
  const formulaCents =
    platformFeeCents + educatorCents + learnerCents + learnerAboveStepCents;
  const standardCents = Math.max(formulaCents, MINIMUM_MONTHLY_CENTS);
  return {
    platformFeeCents,
    educatorCents,
    learnerCents,
    learnerAboveStepCents,
    formulaCents,
    minimumTopUpCents: standardCents - formulaCents,
    standardCents,
    communityCents: Math.round((standardCents * COMMUNITY_RATE_PERCENT) / 100),
  };
}

/** Splits an ex-VAT amount into ex VAT, VAT and inc VAT (VAT rounded to the nearest cent). */
export function splitVat(exVatCents: number): VatSplit {
  const vatCents = Math.round((exVatCents * VAT_PERCENT) / 100);
  return { exVatCents, vatCents, incVatCents: exVatCents + vatCents };
}

/** Annual prepay: twelve months less the prepay discount, ex VAT. */
export function annualPrepayCents(monthlyCents: number): number {
  return Math.round((monthlyCents * 12 * (100 - ANNUAL_PREPAY_DISCOUNT_PERCENT)) / 100);
}
