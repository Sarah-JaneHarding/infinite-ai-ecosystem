// ---------------------------------------------------------------------------
// Subscription tiers — Stage 17 step 4 + 5, revised for OQ-043 (2026-11-11)
//
// A tier now carries only the model-usage quota and the token-overage rate.
// What a school pays for seats is the per-school formula in ./pricing.ts, which
// is independent of the tier. All amounts are in South African cents (integer
// arithmetic; no floating-point money).
// ---------------------------------------------------------------------------

export interface SubscriptionTier {
  readonly name: string;
  // Token quota per calendar month (matches QUOTA_TIERS in packages/security).
  readonly monthlyTokenLimit: number;
  // Per-token overage in ZAR cents per 1 000 tokens above monthlyTokenLimit.
  readonly perKiloTokenOverageCents: number;
}

export const SUBSCRIPTION_TIERS: Readonly<Record<string, SubscriptionTier>> = {
  starter: {
    name: 'starter',
    monthlyTokenLimit: 10_000_000,
    perKiloTokenOverageCents: 2,
  },
  standard: {
    name: 'standard',
    monthlyTokenLimit: 100_000_000,
    perKiloTokenOverageCents: 1,
  },
  enterprise: {
    name: 'enterprise',
    monthlyTokenLimit: 1_000_000_000,
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
