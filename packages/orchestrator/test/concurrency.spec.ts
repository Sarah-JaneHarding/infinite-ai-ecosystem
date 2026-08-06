import { describe, expect, it } from 'vitest';

import { ConcurrencyLimiter } from '../src/concurrency.js';

describe('ConcurrencyLimiter', () => {
  it('grants a slot when under both limits', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 2, maxPerAgent: 2 });
    expect(limiter.tryAcquire('tenant-a', 'CE-01')).not.toBeNull();
    expect(limiter.tenantInFlight('tenant-a')).toBe(1);
    expect(limiter.agentInFlight('CE-01')).toBe(1);
  });

  it('refuses once the per-tenant limit is reached', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 1, maxPerAgent: 10 });
    expect(limiter.tryAcquire('tenant-a', 'CE-01')).not.toBeNull();
    expect(limiter.tryAcquire('tenant-a', 'CE-02')).toBeNull();
  });

  it('refuses once the per-agent limit is reached, even across different tenants', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 10, maxPerAgent: 1 });
    expect(limiter.tryAcquire('tenant-a', 'CE-01')).not.toBeNull();
    expect(limiter.tryAcquire('tenant-b', 'CE-01')).toBeNull();
  });

  it('frees the slot on release, allowing a subsequent acquire', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 1, maxPerAgent: 1 });
    const slot = limiter.tryAcquire('tenant-a', 'CE-01');
    expect(slot).not.toBeNull();
    expect(limiter.tryAcquire('tenant-a', 'CE-01')).toBeNull();

    slot!.release();
    expect(limiter.tenantInFlight('tenant-a')).toBe(0);
    expect(limiter.agentInFlight('CE-01')).toBe(0);
    expect(limiter.tryAcquire('tenant-a', 'CE-01')).not.toBeNull();
  });

  it('release is idempotent — calling it twice does not free two slots', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 1, maxPerAgent: 5 });
    const slot = limiter.tryAcquire('tenant-a', 'CE-01')!;
    slot.release();
    slot.release();
    expect(limiter.tenantInFlight('tenant-a')).toBe(0);
  });

  it('tracks tenants and agents independently of one another', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 5, maxPerAgent: 5 });
    limiter.tryAcquire('tenant-a', 'CE-01');
    limiter.tryAcquire('tenant-a', 'CE-02');
    limiter.tryAcquire('tenant-b', 'CE-01');
    expect(limiter.tenantInFlight('tenant-a')).toBe(2);
    expect(limiter.tenantInFlight('tenant-b')).toBe(1);
    expect(limiter.agentInFlight('CE-01')).toBe(2);
    expect(limiter.agentInFlight('CE-02')).toBe(1);
  });

  it('reports zero for a tenant or agent it has never seen', () => {
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 5, maxPerAgent: 5 });
    expect(limiter.tenantInFlight('never-seen')).toBe(0);
    expect(limiter.agentInFlight('never-seen')).toBe(0);
  });
});
