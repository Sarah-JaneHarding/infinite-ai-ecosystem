import { describe, expect, it } from 'vitest';

import {
  QUOTA_TIERS,
  checkQuota,
  tokenBudgetFraction,
  type QuotaUsage,
} from '../src/quota.js';

const STARTER = QUOTA_TIERS.starter;

const EMPTY_USAGE: QuotaUsage = {
  tokensThisMonth: 0,
  runsToday: 0,
  concurrentRuns: 0,
};

describe('checkQuota — within quota', () => {
  it('does not exceed quota when usage is zero', () => {
    const result = checkQuota(EMPTY_USAGE, STARTER, 1000);
    expect(result.exceeded).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('does not exceed quota when usage is just below all limits', () => {
    const usage: QuotaUsage = {
      tokensThisMonth: STARTER.maxTokensPerMonth - 1000,
      runsToday: STARTER.maxRunsPerDay - 1,
      concurrentRuns: STARTER.maxConcurrentRuns - 1,
    };
    const result = checkQuota(usage, STARTER, 999);
    expect(result.exceeded).toBe(false);
  });
});

describe('checkQuota — concurrent run limit', () => {
  it('blocks when concurrent run limit is reached', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      concurrentRuns: STARTER.maxConcurrentRuns,
    };
    const result = checkQuota(usage, STARTER, 0);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('concurrent_run_limit');
    expect(result.limit).toBe(STARTER.maxConcurrentRuns);
    expect(result.usage).toBe(STARTER.maxConcurrentRuns);
  });

  it('concurrent limit takes priority over daily run limit', () => {
    const usage: QuotaUsage = {
      tokensThisMonth: 0,
      runsToday: STARTER.maxRunsPerDay, // also exceeded
      concurrentRuns: STARTER.maxConcurrentRuns, // exceeded first
    };
    const result = checkQuota(usage, STARTER, 0);
    expect(result.reason).toBe('concurrent_run_limit');
  });
});

describe('checkQuota — daily run limit', () => {
  it('blocks when daily run limit is reached', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      runsToday: STARTER.maxRunsPerDay,
    };
    const result = checkQuota(usage, STARTER, 0);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('run_daily_limit');
    expect(result.limit).toBe(STARTER.maxRunsPerDay);
  });
});

describe('checkQuota — monthly token limit', () => {
  it('blocks when estimated tokens would exceed monthly limit', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      tokensThisMonth: STARTER.maxTokensPerMonth - 100,
    };
    const result = checkQuota(usage, STARTER, 500); // 500 > 100 remaining
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('token_monthly_limit');
    expect(result.limit).toBe(STARTER.maxTokensPerMonth);
  });

  it('blocks exactly at the limit boundary', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      tokensThisMonth: STARTER.maxTokensPerMonth,
    };
    const result = checkQuota(usage, STARTER, 1);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('token_monthly_limit');
  });
});

describe('checkQuota — tier ordering', () => {
  it('enterprise tier has higher limits than starter', () => {
    expect(QUOTA_TIERS.enterprise.maxTokensPerMonth).toBeGreaterThan(
      QUOTA_TIERS.starter.maxTokensPerMonth,
    );
    expect(QUOTA_TIERS.enterprise.maxRunsPerDay).toBeGreaterThan(
      QUOTA_TIERS.starter.maxRunsPerDay,
    );
    expect(QUOTA_TIERS.enterprise.maxConcurrentRuns).toBeGreaterThan(
      QUOTA_TIERS.starter.maxConcurrentRuns,
    );
  });
});

describe('tokenBudgetFraction', () => {
  it('returns 1.0 when no tokens have been used', () => {
    expect(tokenBudgetFraction(EMPTY_USAGE, STARTER)).toBe(1);
  });

  it('returns 0.5 when half the budget is used', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      tokensThisMonth: STARTER.maxTokensPerMonth / 2,
    };
    expect(tokenBudgetFraction(usage, STARTER)).toBeCloseTo(0.5);
  });

  it('returns 0 when the budget is exhausted', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      tokensThisMonth: STARTER.maxTokensPerMonth,
    };
    expect(tokenBudgetFraction(usage, STARTER)).toBe(0);
  });

  it('clamps to 0 when usage exceeds the limit', () => {
    const usage: QuotaUsage = {
      ...EMPTY_USAGE,
      tokensThisMonth: STARTER.maxTokensPerMonth * 2,
    };
    expect(tokenBudgetFraction(usage, STARTER)).toBe(0);
  });
});
