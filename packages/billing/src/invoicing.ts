// ---------------------------------------------------------------------------
// Invoicing — Stage 17 step 4 + 5
//
// Builds invoice line items from a billing period: base subscription fee,
// seat overages, and token overages. All amounts are in ZAR cents.
// ---------------------------------------------------------------------------

import type { PeriodUsage, OverageBreakdown } from './metering';
import type { SubscriptionTier } from './tiers';

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

export const VAT_RATE = 0.15;

/**
 * Builds an invoice for a billing period. Line items are:
 *   1. Monthly subscription base (always present, even at R0 for starter).
 *   2. Learner seat overage (omitted when zero).
 *   3. Educator seat overage (omitted when zero).
 *   4. Token overage (omitted when zero).
 */
export function buildInvoice(
  usage: PeriodUsage,
  tier: SubscriptionTier,
  overage: OverageBreakdown,
): Invoice {
  const lineItems: InvoiceLineItem[] = [];

  lineItems.push({
    description: `${tier.name} subscription (${formatDate(usage.periodStart)} – ${formatDate(usage.periodEnd)})`,
    quantity: 1,
    unitCents: tier.monthlyBaseCents,
    totalCents: tier.monthlyBaseCents,
  });

  if (overage.learnerOverageCount > 0) {
    lineItems.push({
      description: `Additional learner seats (${overage.learnerOverageCount} × R${(tier.perExtraLearnerCents / 100).toFixed(2)})`,
      quantity: overage.learnerOverageCount,
      unitCents: tier.perExtraLearnerCents,
      totalCents: overage.learnerOverageCents,
    });
  }

  if (overage.educatorOverageCount > 0) {
    lineItems.push({
      description: `Additional educator seats (${overage.educatorOverageCount} × R${(tier.perExtraEducatorCents / 100).toFixed(2)})`,
      quantity: overage.educatorOverageCount,
      unitCents: tier.perExtraEducatorCents,
      totalCents: overage.educatorOverageCents,
    });
  }

  if (overage.tokenOverageKilos > 0) {
    lineItems.push({
      description: `Token overage (${overage.tokenOverageKilos.toLocaleString()} k tokens × R${(tier.perKiloTokenOverageCents / 100).toFixed(2)}/k)`,
      quantity: overage.tokenOverageKilos,
      unitCents: tier.perKiloTokenOverageCents,
      totalCents: overage.tokenOverageCents,
    });
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  const vatCents = Math.round(subtotalCents * VAT_RATE);
  const totalCents = subtotalCents + vatCents;

  return {
    tenantId: usage.tenantId,
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    tierName: tier.name,
    lineItems,
    subtotalCents,
    vatCents,
    totalCents,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
