// Per-tenant quota enforcement — Stage 16 step 9.
//
// Quotas are hard limits on resource consumption per billing period. Unlike rate limits
// (which smooth traffic), quotas cap total use. A tenant that exceeds their quota is
// blocked until the period resets or their plan is upgraded — not throttled.
//
// The gateway records token usage per tenant in `audit_event` rows. This module provides
// the pure evaluation logic; the gateway applies it before routing each request.

/** Quota configuration for a single subscription tier. */
export interface QuotaConfig {
  /** Maximum LLM tokens (prompt + completion) per calendar month. */
  readonly maxTokensPerMonth: number;
  /** Maximum agent runs per calendar day. */
  readonly maxRunsPerDay: number;
  /** Maximum concurrent runs (noisy-neighbour ceiling). */
  readonly maxConcurrentRuns: number;
}

/** Observed usage totals for the current period. */
export interface QuotaUsage {
  readonly tokensThisMonth: number;
  readonly runsToday: number;
  readonly concurrentRuns: number;
}

/** Standard subscription tiers. */
export const QUOTA_TIERS = {
  starter: {
    maxTokensPerMonth: 10_000_000, // 10M tokens/month
    maxRunsPerDay: 500,
    maxConcurrentRuns: 5,
  },
  standard: {
    maxTokensPerMonth: 100_000_000, // 100M tokens/month
    maxRunsPerDay: 5_000,
    maxConcurrentRuns: 20,
  },
  enterprise: {
    maxTokensPerMonth: 1_000_000_000, // 1B tokens/month
    maxRunsPerDay: 50_000,
    maxConcurrentRuns: 100,
  },
} as const satisfies Record<string, QuotaConfig>;

export type QuotaTier = keyof typeof QUOTA_TIERS;

export interface QuotaCheckResult {
  readonly exceeded: boolean;
  /** Which limit was hit, or undefined if within quota. */
  readonly reason?: 'token_monthly_limit' | 'run_daily_limit' | 'concurrent_run_limit';
  /** The limit value that was reached. */
  readonly limit?: number;
  /** The observed usage that exceeded it. */
  readonly usage?: number;
}

/**
 * Evaluates whether a new agent run would exceed the tenant's quota.
 *
 * Checks are applied in priority order: concurrent first (most urgent for stability),
 * then daily runs, then monthly tokens. Returns on the first breach.
 *
 * `estimatedTokens` is the pre-flight estimate from the budget tracker. The gateway
 * calls this before routing and again after with the actual usage.
 */
export function checkQuota(
  usage: QuotaUsage,
  config: QuotaConfig,
  estimatedTokens: number,
): QuotaCheckResult {
  if (usage.concurrentRuns >= config.maxConcurrentRuns) {
    return {
      exceeded: true,
      reason: 'concurrent_run_limit',
      limit: config.maxConcurrentRuns,
      usage: usage.concurrentRuns,
    };
  }

  if (usage.runsToday >= config.maxRunsPerDay) {
    return {
      exceeded: true,
      reason: 'run_daily_limit',
      limit: config.maxRunsPerDay,
      usage: usage.runsToday,
    };
  }

  if (usage.tokensThisMonth + estimatedTokens > config.maxTokensPerMonth) {
    return {
      exceeded: true,
      reason: 'token_monthly_limit',
      limit: config.maxTokensPerMonth,
      usage: usage.tokensThisMonth + estimatedTokens,
    };
  }

  return { exceeded: false };
}

/** Remaining monthly token budget as a fraction (0–1). */
export function tokenBudgetFraction(usage: QuotaUsage, config: QuotaConfig): number {
  return Math.max(0, 1 - usage.tokensThisMonth / config.maxTokensPerMonth);
}
