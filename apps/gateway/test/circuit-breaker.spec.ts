import { describe, expect, it } from 'vitest';

import { CircuitBreaker } from '../src/circuit-breaker.js';

describe('CircuitBreaker — closed state', () => {
  it('allows requests to a provider it has never seen', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 1000 });
    expect(breaker.allowsRequest('anthropic')).toBe(true);
    expect(breaker.stateOf('anthropic')).toBe('closed');
  });

  it('stays closed below the failure threshold', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 1000 });
    breaker.recordFailure('anthropic');
    breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('closed');
    expect(breaker.allowsRequest('anthropic')).toBe(true);
  });

  it('a success resets the consecutive-failure count', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 1000 });
    breaker.recordFailure('anthropic');
    breaker.recordFailure('anthropic');
    breaker.recordSuccess('anthropic');
    breaker.recordFailure('anthropic');
    breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('closed'); // still below threshold again
  });

  it('tracks providers independently', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 1000 });
    breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('open');
    expect(breaker.stateOf('openai')).toBe('closed');
    expect(breaker.allowsRequest('openai')).toBe(true);
  });
});

describe('CircuitBreaker — opening', () => {
  it('opens once the failure threshold is reached, and refuses further requests', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 60_000 });
    breaker.recordFailure('anthropic');
    breaker.recordFailure('anthropic');
    breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('open');
    expect(breaker.allowsRequest('anthropic')).toBe(false);
  });
});

describe('CircuitBreaker — half-open', () => {
  it('allows exactly one trial once the open duration has elapsed', () => {
    let now = new Date('2026-08-06T00:00:00.000Z');
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 30_000,
      now: () => now,
    });
    breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('open');

    now = new Date(now.getTime() + 10_000);
    expect(breaker.allowsRequest('anthropic')).toBe(false); // cooldown not elapsed yet

    now = new Date(now.getTime() + 30_000);
    expect(breaker.allowsRequest('anthropic')).toBe(true); // the one trial
    expect(breaker.stateOf('anthropic')).toBe('half_open');
    expect(breaker.allowsRequest('anthropic')).toBe(false); // a second concurrent trial is refused
  });

  it('a successful trial closes the breaker and resets its failure count', () => {
    let now = new Date('2026-08-06T00:00:00.000Z');
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 30_000,
      now: () => now,
    });
    breaker.recordFailure('anthropic');
    now = new Date(now.getTime() + 30_000);
    expect(breaker.allowsRequest('anthropic')).toBe(true);
    breaker.recordSuccess('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('closed');
    expect(breaker.allowsRequest('anthropic')).toBe(true);
  });

  it('a failed trial reopens immediately, for a fresh cooldown, without needing the threshold again', () => {
    let now = new Date('2026-08-06T00:00:00.000Z');
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      openDurationMs: 30_000,
      now: () => now,
    });
    for (let i = 0; i < 5; i++) breaker.recordFailure('anthropic');
    expect(breaker.stateOf('anthropic')).toBe('open');

    now = new Date(now.getTime() + 30_000);
    expect(breaker.allowsRequest('anthropic')).toBe(true); // the trial
    breaker.recordFailure('anthropic'); // the trial itself fails
    expect(breaker.stateOf('anthropic')).toBe('open');
    expect(breaker.allowsRequest('anthropic')).toBe(false); // straight back to open, no new threshold needed

    now = new Date(now.getTime() + 30_000);
    expect(breaker.allowsRequest('anthropic')).toBe(true); // a fresh trial after the new cooldown
  });
});
