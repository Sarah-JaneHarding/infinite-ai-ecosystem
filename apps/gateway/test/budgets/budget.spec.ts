import { describe, expect, it } from 'vitest';

import { BudgetExceededError, BudgetTracker } from '../../src/budgets/budget.js';

const scope = { tenantId: 'tenant-1', module: 'mod-01', agent: 'CE-05' };

describe('BudgetTracker — happy path', () => {
  it('allows spend with no warning when no limit is configured for the scope', () => {
    const tracker = new BudgetTracker({ limitsFor: () => undefined });
    expect(tracker.check(scope)).toEqual({ allowed: true, warning: null });
  });

  it('warns but still allows once the soft daily limit is reached', () => {
    const tracker = new BudgetTracker({ limitsFor: () => ({ softDailyLimit: 1 }) });
    tracker.record(scope, 1);
    const verdict = tracker.check(scope);
    expect(verdict.allowed).toBe(true);
    expect(verdict).toMatchObject({ warning: expect.stringContaining('soft limit') });
  });

  it('scopes spend independently per tenant/module/agent', () => {
    const tracker = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 1 }) });
    tracker.record(scope, 1);
    expect(tracker.check(scope).allowed).toBe(false);
    expect(tracker.check({ ...scope, agent: 'CE-06' }).allowed).toBe(true);
  });

  it('resets when a new day begins', () => {
    let now = new Date('2026-08-04T10:00:00Z');
    const tracker = new BudgetTracker({
      limitsFor: () => ({ hardDailyLimit: 1 }),
      now: () => now,
    });
    tracker.record(scope, 1);
    expect(tracker.check(scope).allowed).toBe(false);
    now = new Date('2026-08-05T00:00:01Z');
    expect(tracker.check(scope).allowed).toBe(true);
  });
});

describe('BudgetTracker — enforced before the call, not after', () => {
  it('refuses once the hard daily limit is met, without needing a call to have happened', () => {
    const tracker = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 5 }) });
    tracker.record(scope, 5);

    // check() is what a caller runs before ever touching the router. Nothing here
    // invokes an adapter — the refusal is available purely from prior recorded spend.
    const verdict = tracker.check(scope);
    expect(verdict.allowed).toBe(false);
    expect(!verdict.allowed && verdict.reason).toContain('Daily budget of 5 exceeded');
    expect(() => tracker.assertWithinBudget(scope)).toThrow(BudgetExceededError);
  });

  it('refuses on the monthly hard limit even when under the daily one', () => {
    const tracker = new BudgetTracker({ limitsFor: () => ({ hardMonthlyLimit: 2 }) });
    tracker.record(scope, 2);
    expect(tracker.check(scope).allowed).toBe(false);
  });

  it('never lets recorded spend decrease — record() only accumulates', () => {
    const tracker = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 10 }) });
    tracker.record(scope, 4);
    tracker.record(scope, 4);
    expect(tracker.check(scope).allowed).toBe(true);
    tracker.record(scope, 4);
    expect(tracker.check(scope).allowed).toBe(false);
  });
});
