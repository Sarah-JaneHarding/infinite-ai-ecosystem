import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rule 5 / OQ-033: the only way this module reaches the database is `withTenant`, with the
// sign-in's tenant; and "no account" is '' — never the subject standing in as an actor.
const { withTenant, findActiveUserAccountId, InvalidTenantContextError } = vi.hoisted(
  () => ({
    withTenant: vi.fn(),
    findActiveUserAccountId: vi.fn(),
    InvalidTenantContextError: class InvalidTenantContextError extends Error {},
  }),
);

vi.mock('@infinite-ai/db', () => ({
  withTenant,
  findActiveUserAccountId,
  InvalidTenantContextError,
}));

import { resolveActorId } from '../../src/lib/actor-resolution.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const TX = { tx: true };

describe('resolveActorId', () => {
  beforeEach(() => {
    withTenant.mockReset();
    findActiveUserAccountId.mockReset();
    withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
  });

  it('returns the account id for the subject, looked up inside the tenant', async () => {
    findActiveUserAccountId.mockResolvedValue(ACCOUNT);
    await expect(resolveActorId({ tenantId: TENANT, subject: SUB })).resolves.toBe(
      ACCOUNT,
    );
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: SUB },
      expect.any(Function),
    );
    expect(findActiveUserAccountId).toHaveBeenCalledWith(TX, SUB);
  });

  it('returns "" when the person has no active account — never the subject', async () => {
    findActiveUserAccountId.mockResolvedValue(null);
    const result = await resolveActorId({ tenantId: TENANT, subject: SUB });
    expect(result).toBe('');
    expect(result).not.toBe(SUB);
  });

  it.each([
    ['tenant', { tenantId: '', subject: SUB }],
    ['subject', { tenantId: TENANT, subject: '' }],
  ])('does not touch the database without a %s', async (_what, lookup) => {
    await expect(resolveActorId(lookup)).resolves.toBe('');
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns "" when the tenant or subject is not a UUID (the tenant client refuses it)', async () => {
    withTenant.mockRejectedValue(new InvalidTenantContextError('not a uuid'));
    await expect(resolveActorId({ tenantId: 'x', subject: 'y' })).resolves.toBe('');
  });

  it('lets a database fault through so sign-in can fail and be retried', async () => {
    withTenant.mockRejectedValue(new Error('db down'));
    await expect(resolveActorId({ tenantId: TENANT, subject: SUB })).rejects.toThrow(
      'db down',
    );
  });
});
