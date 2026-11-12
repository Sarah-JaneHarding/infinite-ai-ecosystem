import { beforeEach, describe, expect, it, vi } from 'vitest';

const { withTenant, listActiveRoles } = vi.hoisted(() => ({
  withTenant: vi.fn(),
  listActiveRoles: vi.fn(),
}));
vi.mock('@infinite-ai/db', () => {
  class InvalidTenantContextError extends Error {}
  return { withTenant, listActiveRoles, InvalidTenantContextError };
});

import { InvalidTenantContextError } from '@infinite-ai/db';

import { resolveEligibleRoles } from '../../src/lib/role-resolution.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const NOW = new Date('2026-11-12T08:00:00.000Z');

describe('resolveEligibleRoles', () => {
  beforeEach(() => {
    withTenant.mockReset();
    listActiveRoles.mockReset();
    withTenant.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn({ tx: true }),
    );
    listActiveRoles.mockResolvedValue(['hod', 'teacher']);
  });

  it('reads the account’s live roles inside the tenant, as that account, at the given time', async () => {
    const result = await resolveEligibleRoles({
      tenantId: TENANT,
      accountId: ACCOUNT,
      claimRoles: ['teacher', 'hod', 'admin'],
      now: NOW,
    });
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(listActiveRoles).toHaveBeenCalledWith({ tx: true }, ACCOUNT, NOW);
    expect(result.eligible).toEqual(['teacher', 'hod']);
    expect(result.claimedNotAssigned).toEqual(['admin']);
  });

  it('reads nothing for a person with no account — a claim alone grants no school role', async () => {
    const result = await resolveEligibleRoles({
      tenantId: TENANT,
      accountId: '',
      claimRoles: ['teacher', 'platform_admin'],
    });
    expect(withTenant).not.toHaveBeenCalled();
    expect(result.eligible).toEqual(['platform_admin']);
  });

  it('reads nothing without a tenant', async () => {
    const result = await resolveEligibleRoles({
      tenantId: '',
      accountId: ACCOUNT,
      claimRoles: ['teacher'],
    });
    expect(withTenant).not.toHaveBeenCalled();
    expect(result.eligible).toEqual([]);
  });

  it('treats a tenant that is not usable as holding nothing', async () => {
    withTenant.mockRejectedValue(new InvalidTenantContextError('bad'));
    const result = await resolveEligibleRoles({
      tenantId: 'not-a-uuid',
      accountId: ACCOUNT,
      claimRoles: ['teacher'],
    });
    expect(result.eligible).toEqual([]);
  });

  it('does not swallow a database fault: sign-in fails rather than issuing a shorter list', async () => {
    withTenant.mockRejectedValue(new Error('db down'));
    await expect(
      resolveEligibleRoles({
        tenantId: TENANT,
        accountId: ACCOUNT,
        claimRoles: ['teacher'],
      }),
    ).rejects.toThrow('db down');
  });

  it('ignores a stored role this build does not know rather than failing', async () => {
    listActiveRoles.mockResolvedValue(['teacher', 'retired_role']);
    const result = await resolveEligibleRoles({
      tenantId: TENANT,
      accountId: ACCOUNT,
      claimRoles: ['teacher'],
    });
    expect(result.eligible).toEqual(['teacher']);
  });
});
