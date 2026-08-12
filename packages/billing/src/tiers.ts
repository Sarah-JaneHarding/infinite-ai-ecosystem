// ---------------------------------------------------------------------------
// Subscription tiers — Stage 17 step 4 + 5
//
// Ties together the token/request/concurrency quotas from packages/security
// with the financial dimensions of each tier. All amounts are in South African
// cents (integer arithmetic; no floating-point money).
// ---------------------------------------------------------------------------

export interface SubscriptionTier {
  readonly name: string;
  // Token quota per calendar month (matches QUOTA_TIERS in packages/security).
  readonly monthlyTokenLimit: number;
  // Included learner-seat count before per-seat overage applies.
  readonly includedLearners: number;
  // Included educator-seat count before per-seat overage applies.
  readonly includedEducators: number;
  // Monthly base price in ZAR cents.
  readonly monthlyBaseCents: number;
  // Per-learner overage in ZAR cents per learner-month above includedLearners.
  readonly perExtraLearnerCents: number;
  // Per-educator overage in ZAR cents per educator-month above includedEducators.
  readonly perExtraEducatorCents: number;
  // Per-token overage in ZAR cents per 1 000 tokens above monthlyTokenLimit.
  readonly perKiloTokenOverageCents: number;
}

export const SUBSCRIPTION_TIERS: Readonly<Record<string, SubscriptionTier>> = {
  starter: {
    name: 'starter',
    monthlyTokenLimit: 10_000_000,
    includedLearners: 300,
    includedEducators: 20,
    monthlyBaseCents: 0,
    perExtraLearnerCents: 50,
    perExtraEducatorCents: 200,
    perKiloTokenOverageCents: 2,
  },
  standard: {
    name: 'standard',
    monthlyTokenLimit: 100_000_000,
    includedLearners: 1_500,
    includedEducators: 100,
    monthlyBaseCents: 99_900,
    perExtraLearnerCents: 40,
    perExtraEducatorCents: 180,
    perKiloTokenOverageCents: 1,
  },
  enterprise: {
    name: 'enterprise',
    monthlyTokenLimit: 1_000_000_000,
    includedLearners: 10_000,
    includedEducators: 500,
    monthlyBaseCents: 499_900,
    perExtraLearnerCents: 30,
    perExtraEducatorCents: 150,
    perKiloTokenOverageCents: 0,
  },
};

export type TierName = keyof typeof SUBSCRIPTION_TIERS;

export function getTier(name: string): SubscriptionTier {
  const tier = SUBSCRIPTION_TIERS[name];
  if (tier === undefined) {
    throw new Error(`Unknown subscription tier: ${name}`);
  }
  return tier;
}
