import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rule 5 / OQ-033 / PROVISIONING_DESIGN §4.3: the only way this module reaches the database is
// `withTenant`, with the sign-in's tenant; "no account" is '' — never the subject standing in as an
// actor — and a first sign-in is the only thing that writes.
const {
  withTenant,
  findActiveUserAccountId,
  isTenantActive,
  acceptInvitation,
  InvalidTenantContextError,
} = vi.hoisted(() => ({
  withTenant: vi.fn(),
  findActiveUserAccountId: vi.fn(),
  isTenantActive: vi.fn(),
  acceptInvitation: vi.fn(),
  InvalidTenantContextError: class InvalidTenantContextError extends Error {},
}));

vi.mock('@infinite-ai/db', () => ({
  withTenant,
  findActiveUserAccountId,
  isTenantActive,
  acceptInvitation,
  InvalidTenantContextError,
}));

import { resolveSignIn, type SignInIdentity } from '../../src/lib/actor-resolution.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const TX = { tx: true };
const NOW = new Date('2026-11-11T08:00:00.000Z');
const identity: SignInIdentity = {
  tenantId: TENANT,
  subject: SUB,
  email: 'Ada@Example.invalid',
  emailVerified: true,
  displayName: 'Ada',
};

describe('resolveSignIn', () => {
  beforeEach(() => {
    for (const fn of [
      withTenant,
      findActiveUserAccountId,
      isTenantActive,
      acceptInvitation,
    ]) {
      fn.mockReset();
    }
    withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
    isTenantActive.mockResolvedValue(true);
    findActiveUserAccountId.mockResolvedValue(null);
  });

  describe('an existing account (step 2)', () => {
    it('resolves it inside the tenant, with no invitation lookup and no write', async () => {
      findActiveUserAccountId.mockResolvedValue(ACCOUNT);
      await expect(resolveSignIn(identity, NOW)).resolves.toEqual({
        actorId: ACCOUNT,
        outcome: 'existing',
      });
      expect(withTenant).toHaveBeenCalledWith(
        { tenantId: TENANT, actorId: SUB },
        expect.any(Function),
      );
      expect(findActiveUserAccountId).toHaveBeenCalledWith(TX, SUB);
      expect(acceptInvitation).not.toHaveBeenCalled();
    });

    it('does not need a verified address: the subject, not the address, finds the account', async () => {
      findActiveUserAccountId.mockResolvedValue(ACCOUNT);
      const result = await resolveSignIn({ ...identity, emailVerified: false }, NOW);
      expect(result).toEqual({ actorId: ACCOUNT, outcome: 'existing' });
    });
  });

  describe('a first sign-in (steps 3 and 4)', () => {
    it('links the verified address to its invitation and returns the new account', async () => {
      acceptInvitation.mockResolvedValue({
        ok: true,
        outcome: 'linked',
        accountId: ACCOUNT,
        roles: ['teacher'],
      });
      await expect(resolveSignIn(identity, NOW)).resolves.toEqual({
        actorId: ACCOUNT,
        outcome: 'linked',
      });
      expect(acceptInvitation).toHaveBeenCalledWith(TX, {
        subject: SUB,
        email: 'Ada@Example.invalid',
        emailVerified: true,
        displayName: 'Ada',
        now: NOW,
      });
    });

    it('resolves the account a concurrent first sign-in created', async () => {
      acceptInvitation.mockResolvedValue({
        ok: true,
        outcome: 'existing',
        accountId: ACCOUNT,
      });
      await expect(resolveSignIn(identity, NOW)).resolves.toEqual({
        actorId: ACCOUNT,
        outcome: 'existing',
      });
    });

    it('defaults the moment to now', async () => {
      acceptInvitation.mockResolvedValue({ ok: false, reason: 'no_invitation' });
      await resolveSignIn(identity);
      const passed = acceptInvitation.mock.calls[0]?.[1] as { now: Date };
      expect(Math.abs(passed.now.getTime() - Date.now())).toBeLessThan(5_000);
    });
  });

  describe('refusals: no actor, and the reason', () => {
    it.each([
      'account_not_active', // step 5: a suspended or offboarded subject is never relinked
      'email_not_verified', // step 1
      'invalid_email',
      'no_invitation', // step 3
      'invitation_expired',
      'awaiting_confirmation',
      'email_in_use',
      'subject_mismatch', // step 7: the invitation names the Keycloak user we created; another one may not take it
    ])('%s', async (reason) => {
      acceptInvitation.mockResolvedValue({ ok: false, reason });
      const result = await resolveSignIn(identity, NOW);
      expect(result).toEqual({ actorId: '', outcome: reason });
      expect(result.actorId).not.toBe(SUB); // never the subject standing in
    });

    it('a refusal reason it does not know is a generic refusal, still with no actor', async () => {
      acceptInvitation.mockResolvedValue({ ok: false, reason: 'something_new' });
      await expect(resolveSignIn(identity, NOW)).resolves.toEqual({
        actorId: '',
        outcome: 'refused',
      });
    });

    it('a tenant that is not ACTIVE resolves nothing — not even an existing account', async () => {
      isTenantActive.mockResolvedValue(false);
      findActiveUserAccountId.mockResolvedValue(ACCOUNT);
      await expect(resolveSignIn(identity, NOW)).resolves.toEqual({
        actorId: '',
        outcome: 'tenant_not_active',
      });
      expect(findActiveUserAccountId).not.toHaveBeenCalled();
      expect(acceptInvitation).not.toHaveBeenCalled();
    });
  });

  describe('before the database', () => {
    it.each([
      ['no_tenant', { tenantId: '' }],
      ['no_subject', { subject: '' }],
    ])('%s: the database is not touched', async (outcome, override) => {
      await expect(resolveSignIn({ ...identity, ...override }, NOW)).resolves.toEqual({
        actorId: '',
        outcome,
      });
      expect(withTenant).not.toHaveBeenCalled();
    });

    it('a tenant or subject that is not a UUID (the tenant client refuses it) is no_tenant', async () => {
      withTenant.mockRejectedValue(new InvalidTenantContextError('not a uuid'));
      await expect(
        resolveSignIn({ ...identity, tenantId: 'x', subject: 'y' }, NOW),
      ).resolves.toEqual({ actorId: '', outcome: 'no_tenant' });
    });
  });

  it('lets a database fault through so sign-in can fail and be retried', async () => {
    withTenant.mockRejectedValue(new Error('db down'));
    await expect(resolveSignIn(identity, NOW)).rejects.toThrow('db down');
  });
});
