// Per-tenant rate limiting — Stage 16 step 9.
//
// Algorithm: sliding window counter. The window slides forward with each request; requests
// older than `windowMs` are discarded. This is a pure function over an in-memory state
// snapshot; the production implementation backs the state with Redis and an atomic Lua
// script, but the algorithm and its invariants are tested here without infrastructure.
//
// Per-tenant isolation: a tenant that saturates their rate limit cannot affect another
// tenant's limit, because each tenant maintains an independent state object. There is no
// shared global counter a noisy neighbour could starve.

/** The sliding-window state for a single tenant. */
export interface RateLimitState {
  /** Timestamps (ms since epoch) of requests within the current window. */
  readonly timestamps: readonly number[];
}

/** Rate limit configuration. Immutable; shared across all tenants. */
export interface RateLimitConfig {
  /** Maximum number of requests allowed per window. */
  readonly maxRequests: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
}

/** The default per-tenant API rate limit. */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 600,
  windowMs: 60_000, // 600 req/min
} as const;

/** The tighter limit applied during a noisy-neighbour intervention. */
export const RESTRICTED_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 60 req/min
} as const;

export interface RateLimitResult {
  readonly limited: boolean;
  /** Requests remaining in the current window (0 when limited). */
  readonly remaining: number;
  /** Updated state to persist back to the store. */
  readonly newState: RateLimitState;
  /** Milliseconds until the oldest request ages out and frees a slot. */
  readonly retryAfterMs: number;
}

/**
 * Evaluates whether a new request should be rate-limited.
 *
 * Pure function: no I/O, no side effects. The caller is responsible for persisting
 * `result.newState` back to the store atomically.
 */
export function checkRateLimit(
  state: RateLimitState,
  config: RateLimitConfig,
  now: number,
): RateLimitResult {
  // Discard timestamps outside the current window.
  const windowStart = now - config.windowMs;
  const active = state.timestamps.filter((t) => t > windowStart);

  if (active.length >= config.maxRequests) {
    const oldest = active[0] ?? now;
    return {
      limited: true,
      remaining: 0,
      newState: { timestamps: active },
      retryAfterMs: config.windowMs - (now - oldest),
    };
  }

  const updated = [...active, now];
  return {
    limited: false,
    remaining: config.maxRequests - updated.length,
    newState: { timestamps: updated },
    retryAfterMs: 0,
  };
}

/** Returns a fresh empty state for a tenant that has made no requests yet. */
export function emptyRateLimitState(): RateLimitState {
  return { timestamps: [] };
}
