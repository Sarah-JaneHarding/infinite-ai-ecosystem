import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RATE_LIMIT,
  RESTRICTED_RATE_LIMIT,
  checkRateLimit,
  emptyRateLimitState,
  type RateLimitState,
} from '../src/rate-limit.js';

const NOW = 1_700_000_000_000; // arbitrary fixed timestamp

describe('emptyRateLimitState', () => {
  it('returns a state with no timestamps', () => {
    expect(emptyRateLimitState().timestamps).toHaveLength(0);
  });
});

describe('checkRateLimit — happy path', () => {
  it('allows the first request', () => {
    const result = checkRateLimit(emptyRateLimitState(), DEFAULT_RATE_LIMIT, NOW);
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(DEFAULT_RATE_LIMIT.maxRequests - 1);
    expect(result.newState.timestamps).toHaveLength(1);
  });

  it('adds the timestamp to newState', () => {
    const result = checkRateLimit(emptyRateLimitState(), DEFAULT_RATE_LIMIT, NOW);
    expect(result.newState.timestamps).toContain(NOW);
  });

  it('counts correctly after several requests', () => {
    let state = emptyRateLimitState();
    const config = { maxRequests: 5, windowMs: 60_000 };
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(state, config, NOW + i);
      state = result.newState;
      expect(result.limited).toBe(false);
    }
    const last = checkRateLimit(state, config, NOW + 4);
    expect(last.limited).toBe(false);
    expect(last.remaining).toBe(0);
  });
});

describe('checkRateLimit — rate limited', () => {
  it('limits the request when maxRequests is reached', () => {
    const config = { maxRequests: 3, windowMs: 60_000 };
    const state: RateLimitState = { timestamps: [NOW - 2000, NOW - 1000, NOW - 500] };
    const result = checkRateLimit(state, config, NOW);
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('returns a positive retryAfterMs when limited', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    const state: RateLimitState = { timestamps: [NOW - 1000] };
    const result = checkRateLimit(state, config, NOW);
    expect(result.limited).toBe(true);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(config.windowMs);
  });

  it('does not add the timestamp to newState when limited', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    const state: RateLimitState = { timestamps: [NOW - 1000] };
    const result = checkRateLimit(state, config, NOW);
    expect(result.newState.timestamps).toHaveLength(1);
  });
});

describe('checkRateLimit — sliding window expiry', () => {
  it('allows a request after old timestamps expire', () => {
    const config = { maxRequests: 2, windowMs: 10_000 };
    // Two timestamps that are now outside the window.
    const state: RateLimitState = { timestamps: [NOW - 20_000, NOW - 15_000] };
    const result = checkRateLimit(state, config, NOW);
    expect(result.limited).toBe(false);
  });

  it('discards expired timestamps from newState', () => {
    const config = { maxRequests: 5, windowMs: 10_000 };
    const state: RateLimitState = { timestamps: [NOW - 20_000, NOW - 500] };
    const result = checkRateLimit(state, config, NOW);
    // Only the still-active timestamp (NOW - 500) is kept, plus the new one.
    expect(result.newState.timestamps).not.toContain(NOW - 20_000);
  });
});

describe('checkRateLimit — tenant isolation', () => {
  it('tenant A reaching limit does not affect tenant B', () => {
    const config = { maxRequests: 2, windowMs: 60_000 };
    const stateA: RateLimitState = { timestamps: [NOW - 1000, NOW - 500] };
    const stateB = emptyRateLimitState();

    const resultA = checkRateLimit(stateA, config, NOW);
    const resultB = checkRateLimit(stateB, config, NOW);

    expect(resultA.limited).toBe(true);
    expect(resultB.limited).toBe(false);
  });
});

describe('DEFAULT_RATE_LIMIT', () => {
  it('allows 600 requests per minute', () => {
    expect(DEFAULT_RATE_LIMIT.maxRequests).toBe(600);
    expect(DEFAULT_RATE_LIMIT.windowMs).toBe(60_000);
  });
});

describe('RESTRICTED_RATE_LIMIT', () => {
  it('is more restrictive than DEFAULT_RATE_LIMIT', () => {
    expect(RESTRICTED_RATE_LIMIT.maxRequests).toBeLessThan(
      DEFAULT_RATE_LIMIT.maxRequests,
    );
  });
});
