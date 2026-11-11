// ---------------------------------------------------------------------------
// Invoicing — Stage 17 step 4 + 5, revised for OQ-043 (2026-11-11)
//
// Builds invoice line items from a billing period using the per-school formula
// in ./pricing.ts, plus any token overage. All amounts are in ZAR cents.
// ---------------------------------------------------------------------------

import type { PeriodUsage, OverageBreakdown } from './metering.js';
import type { SubscriptionTier } from './tiers.js';
import {
  COMMUNITY_RATE_PERCENT,
  LEARNER_STEP_AT,
  PER_EDUCATOR_CENTS,
  PER_LEARNER_ABOVE_STEP_CENTS,
  PER_LEARNER_CENTS,
  VAT_PERCENT,
  priceBreakdown,
} from './pricing.js';

export interface InvoiceLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly totalCents: number;
}

export interface Invoice {
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly tierName: string;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly subtotalCents: number;
  // VAT at 15 % (South African standard rate).
  readonly vatCents: number;
  readonly totalCents: number;
}

export interface InvoiceOptions {
  // Community rate (no-fee / low-budget public school): 50 % of the standard price.
  readonly community?: boolean;
}

export const VAT_RATE = VAT_PERCENT / 100;

const rand = (cents: number): string => `R${(cents / 100).toFixed(2)}`;

/**
 * Builds an invoice for a billing period. Line items, in order:
 *   1. Platform fee (always present).
 *   2. Educators (omitted when zero).
 *   3. Learners, first 500 (omitted when zero).
 *   4. Learners above 500 (omitted when zero).
 *   5. Minimum monthly charge top-up (only when the formula is below the minimum).
 *   6. Community rate reduction (only when options.community is set; negative).
 *   7. Token overage (omitted when zero).
 */
export function buildInvoice(
  usage: PeriodUsage,
  tier: SubscriptionTier,
  overage: OverageBreakdown,
  options: InvoiceOptions = {},
): Invoice {
  const price = priceBreakdown({
    learners: usage.learnerCount,
    educators: usage.educatorCount,
  });
  const lineItems: InvoiceLineItem[] = [];
  const add = (
    description: string,
    quantity: number,
    unitCents: number,
    totalCents: number,
  ): void => {
    lineItems.push({ description, quantity, unitCents, totalCents });
  };

  add(
    `Platform fee (${formatDate(usage.periodStart)} – ${formatDate(usage.periodEnd)})`,
    1,
    price.platformFeeCents,
    price.platformFeeCents,
  );
  if (usage.educatorCount > 0) {
    add(
      `Educators (${usage.educatorCount} × ${rand(PER_EDUCATOR_CENTS)})`,
      usage.educatorCount,
      PER_EDUCATOR_CENTS,
      price.educatorCents,
    );
  }
  const firstBand = Math.min(usage.learnerCount, LEARNER_STEP_AT);
  if (firstBand > 0) {
    add(
      `Learners, first ${LEARNER_STEP_AT} (${firstBand} × ${rand(PER_LEARNER_CENTS)})`,
      firstBand,
      PER_LEARNER_CENTS,
      price.learnerCents,
    );
  }
  const aboveBand = Math.max(usage.learnerCount - LEARNER_STEP_AT, 0);
  if (aboveBand > 0) {
    add(
      `Learners above ${LEARNER_STEP_AT} (${aboveBand} × ${rand(PER_LEARNER_ABOVE_STEP_CENTS)})`,
      aboveBand,
      PER_LEARNER_ABOVE_STEP_CENTS,
      price.learnerAboveStepCents,
    );
  }
  if (price.minimumTopUpCents > 0) {
    add(
      'Minimum monthly charge (top-up)',
      1,
      price.minimumTopUpCents,
      price.minimumTopUpCents,
    );
  }
  if (options.community === true) {
    const reduction = price.communityCents - price.standardCents;
    add(
      `Community rate (${COMMUNITY_RATE_PERCENT} % of standard)`,
      1,
      reduction,
      reduction,
    );
  }
  if (overage.tokenOverageKilos > 0) {
    add(
      `Token overage (${overage.tokenOverageKilos.toLocaleString()} k tokens × ${rand(tier.perKiloTokenOverageCents)}/k)`,
      overage.tokenOverageKilos,
      tier.perKiloTokenOverageCents,
      overage.tokenOverageCents,
    );
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  const vatCents = Math.round((subtotalCents * VAT_PERCENT) / 100);
  return {
    tenantId: usage.tenantId,
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    tierName: tier.name,
    lineItems,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
