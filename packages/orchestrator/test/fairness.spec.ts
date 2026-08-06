import { describe, expect, it } from 'vitest';

import { selectNextFairly, type FairnessCandidate } from '../src/fairness.js';

describe('selectNextFairly', () => {
  it('returns null when there are no candidates', () => {
    expect(selectNextFairly([], null)).toBeNull();
  });

  it('picks the only candidate when there is one tenant', () => {
    const candidates: FairnessCandidate[] = [{ runId: 'r1', tenantId: 'a' }];
    expect(selectNextFairly(candidates, null)).toEqual(candidates[0]);
  });

  it('rotates round-robin across tenants, not runs', () => {
    const candidates: FairnessCandidate[] = [
      { runId: 'a1', tenantId: 'a' },
      { runId: 'a2', tenantId: 'a' },
      { runId: 'b1', tenantId: 'b' },
    ];
    const first = selectNextFairly(candidates, null);
    expect(first?.tenantId).toBe('a');
    const second = selectNextFairly(candidates, first?.tenantId ?? null);
    expect(second?.tenantId).toBe('b');
    const third = selectNextFairly(candidates, second?.tenantId ?? null);
    expect(third?.tenantId).toBe('a');
  });

  it('a large tenant never delays a small tenant beyond one turn', () => {
    // The manual's own concern, made concrete: tenant "big" has 1000 pending runs, tenant
    // "small" has 1. Regardless of how the rotation starts, "small" is served within the
    // very next call after "big" — never starved behind big's own backlog.
    const big: FairnessCandidate[] = Array.from({ length: 1000 }, (_, i) => ({
      runId: `big-${i}`,
      tenantId: 'big',
    }));
    const candidates: FairnessCandidate[] = [
      ...big,
      { runId: 'small-1', tenantId: 'small' },
    ];

    const first = selectNextFairly(candidates, null);
    expect(first?.tenantId).toBe('big');
    const second = selectNextFairly(candidates, 'big');
    expect(second?.tenantId).toBe('small');
  });

  it('skips a tenant with no remaining candidates and resumes with it once it has one again', () => {
    const withBoth: FairnessCandidate[] = [
      { runId: 'a1', tenantId: 'a' },
      { runId: 'b1', tenantId: 'b' },
    ];
    // "a" served last; "b" has nothing pending right now.
    const onlyA: FairnessCandidate[] = [{ runId: 'a2', tenantId: 'a' }];
    expect(selectNextFairly(onlyA, 'a')?.tenantId).toBe('a');
    // "b" is back with new work — the rotation still finds it after "a".
    expect(selectNextFairly(withBoth, 'a')?.tenantId).toBe('b');
  });

  it('picks the first candidate for a tenant when it has more than one pending', () => {
    const candidates: FairnessCandidate[] = [
      { runId: 'a1', tenantId: 'a' },
      { runId: 'a2', tenantId: 'a' },
    ];
    expect(selectNextFairly(candidates, null)).toEqual(candidates[0]);
  });

  it('treats an unrecognised lastServedTenantId as if nothing was served yet', () => {
    const candidates: FairnessCandidate[] = [{ runId: 'a1', tenantId: 'a' }];
    expect(selectNextFairly(candidates, 'tenant-no-longer-pending')).toEqual(
      candidates[0],
    );
  });
});
