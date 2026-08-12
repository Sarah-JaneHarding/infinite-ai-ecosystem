// ---------------------------------------------------------------------------
// Metering — Stage 17 step 4 + 5
//
// Metering events are emitted by the Model Gateway on every completion or
// embedding call. This module aggregates them into period summaries and
// detects overages against the tenant's subscription tier.
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from './tiers';

export interface MeteringEvent {
  readonly tenantId: string;
  readonly at: Date;
  readonly agentId: string;
  readonly tokensUsed: number;
  // Cost in ZAR cents as billed by the gateway adapter.
  readonly costCents: number;
}

export interface PeriodUsage {
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalTokens: number;
  readonly totalCostCents: number;
  readonly learnerCount: number;
  readonly educatorCount: number;
  readonly eventCount: number;
}

export interface OverageBreakdown {
  readonly tokenOverageKilos: number;
  readonly tokenOverageCents: number;
  readonly learnerOverageCount: number;
  readonly learnerOverageCents: number;
  readonly educatorOverageCount: number;
  readonly educatorOverageCents: number;
  readonly totalOverageCents: number;
}

/**
 * Aggregates a list of metering events into a period usage summary.
 * Events outside [periodStart, periodEnd) are excluded.
 */
export function aggregateMeteringEvents(
  events: readonly MeteringEvent[],
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  learnerCount: number,
  educatorCount: number,
): PeriodUsage {
  const inPeriod = events.filter(
    (e) => e.tenantId === tenantId && e.at >= periodStart && e.at < periodEnd,
  );

  const totalTokens = inPeriod.reduce((sum, e) => sum + e.tokensUsed, 0);
  const totalCostCents = inPeriod.reduce((sum, e) => sum + e.costCents, 0);

  return {
    tenantId,
    periodStart,
    periodEnd,
    totalTokens,
    totalCostCents,
    learnerCount,
    educatorCount,
    eventCount: inPeriod.length,
  };
}

/**
 * Computes overage charges for a billing period against the tenant's tier.
 * All amounts are in ZAR cents. Returns zero overages when usage is within
 * the included limits.
 */
export function computeOverage(
  usage: PeriodUsage,
  tier: SubscriptionTier,
): OverageBreakdown {
  const tokenOverageKilos = Math.max(
    0,
    Math.floor((usage.totalTokens - tier.monthlyTokenLimit) / 1_000),
  );
  const tokenOverageCents = tokenOverageKilos * tier.perKiloTokenOverageCents;

  const learnerOverageCount = Math.max(0, usage.learnerCount - tier.includedLearners);
  const learnerOverageCents = learnerOverageCount * tier.perExtraLearnerCents;

  const educatorOverageCount = Math.max(0, usage.educatorCount - tier.includedEducators);
  const educatorOverageCents = educatorOverageCount * tier.perExtraEducatorCents;

  const totalOverageCents =
    tokenOverageCents + learnerOverageCents + educatorOverageCents;

  return {
    tokenOverageKilos,
    tokenOverageCents,
    learnerOverageCount,
    learnerOverageCents,
    educatorOverageCount,
    educatorOverageCents,
    totalOverageCents,
  };
}
