// The testkit's own tests. A fixture library that is itself untested is a source of
// confusing failures elsewhere.

import { describe, expect, it } from 'vitest';

import {
  aLearner,
  aSchool,
  aStaffMember,
  aTenant,
  defineFactory,
  tenantScope,
  withTenant,
} from '../src/index.js';

describe('tenantScope', () => {
  it('generates distinct ids per call', () => {
    const a = tenantScope();
    const b = tenantScope();
    expect(a.tenantId).not.toBe(b.tenantId);
    expect(a.actorId).not.toBe(b.actorId);
  });

  it('honours overrides so a test can pin a tenant', () => {
    const scope = tenantScope({ tenantId: 'fixed' });
    expect(scope.tenantId).toBe('fixed');
    expect(scope.actorId).not.toBe('fixed');
  });
});

describe('factories carry the tenant', () => {
  const scope = tenantScope();

  it('stamps tenantId on every fixture that has one', () => {
    expect(aSchool(scope).tenantId).toBe(scope.tenantId);
    expect(aLearner(scope).tenantId).toBe(scope.tenantId);
    expect(aStaffMember(scope).tenantId).toBe(scope.tenantId);
  });

  it('uses the scope tenant as the tenant fixture id', () => {
    // The tenant table is keyed by its own id, so the scope's tenantId *is* its id.
    expect(aTenant(scope).id).toBe(scope.tenantId);
  });

  it('records the actor as creator', () => {
    expect(aSchool(scope).createdBy).toBe(scope.actorId);
  });

  it('applies overrides over generated values', () => {
    expect(aSchool(scope, { lolt: 'af' }).lolt).toBe('af');
  });

  it('produces distinct values on successive calls', () => {
    const first = aStaffMember(scope);
    const second = aStaffMember(scope);
    expect(first.displayName).not.toBe(second.displayName);
  });
});

describe('learner fixtures carry no personal information', () => {
  it('exposes a token and no name, identifier or date of birth', () => {
    // Rule 4. A factory that produced a plausible legal name would make it easy to write
    // a test that leaks one, and easier still to copy the pattern into real code.
    const learner = aLearner(tenantScope());
    expect(learner.token).toMatch(/^LNR_/);
    expect(Object.keys(learner).sort()).toEqual([
      'createdBy',
      'homeLanguage',
      'tenantId',
      'token',
    ]);
  });

  it('scopes the token to the tenant, so two tenants cannot collide', () => {
    const a = aLearner(tenantScope());
    const b = aLearner(tenantScope());
    expect(a.token).not.toBe(b.token);
  });
});

describe('defineFactory', () => {
  it('passes the scope and an incrementing sequence to the builder', () => {
    const seen: number[] = [];
    const factory = defineFactory((scope, n) => {
      seen.push(n);
      return { tenantId: scope.tenantId };
    });
    const scope = tenantScope();
    factory(scope);
    factory(scope);
    expect(seen).toEqual([1, 2]);
  });
});

describe('withTenant', () => {
  it('supplies a scope to the callback', async () => {
    const tenantId = await withTenant(async (scope) => scope.tenantId);
    expect(tenantId).toHaveLength(36);
  });

  it('passes overrides through', async () => {
    const tenantId = await withTenant(async (scope) => scope.tenantId, {
      tenantId: 'pinned',
    });
    expect(tenantId).toBe('pinned');
  });

  it('propagates a rejection rather than swallowing it', async () => {
    await expect(
      withTenant(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
