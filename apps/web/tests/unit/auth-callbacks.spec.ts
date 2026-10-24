import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Profile, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

// Security test: an account the identity provider gives none of our roles must not get a
// session, and a stored token without a valid role must not become a session either. The
// old behaviour silently made both a `teacher`.
vi.mock('../../src/lib/env', () => ({
  getWebEnv: () => ({
    AUTH_KEYCLOAK_ID: 'id',
    AUTH_KEYCLOAK_SECRET: 'secret',
    AUTH_KEYCLOAK_ISSUER: 'http://localhost/realms/x',
  }),
}));

// The account lookup is its own unit (actor-resolution.spec.ts); here it is a stand-in so
// the callbacks can be driven without a database.
const { resolveActorId } = vi.hoisted(() => ({ resolveActorId: vi.fn() }));
vi.mock('../../src/lib/actor-resolution', () => ({ resolveActorId }));

import { authOptions } from '../../src/auth.js';

const callbacks = authOptions.callbacks;
if (
  callbacks?.signIn === undefined ||
  callbacks.jwt === undefined ||
  callbacks.session === undefined
) {
  throw new Error('auth callbacks missing');
}
const { signIn, jwt, session } = callbacks;

const TENANT = '10000000-0000-4000-8000-000000000001';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';
const profileWith = (roles: string[]): Profile =>
  ({ realm_access: { roles }, tenant_id: TENANT }) as unknown as Profile;
const ACCOUNT_ID = 'acc00000-0000-4000-8000-000000000001';
const account = { provider: 'keycloak' } as Account;

describe('signIn', () => {
  const run = (profile: Profile | undefined) =>
    signIn({ user: { id: SUB }, account, ...(profile === undefined ? {} : { profile }) });

  it('lets an account with one of our roles in', async () => {
    expect(await run(profileWith(['hod']))).toBe(true);
  });

  it('refuses an account whose only roles are the provider defaults', async () => {
    expect(await run(profileWith(['offline_access', 'default-roles-infinite-ai']))).toBe(
      false,
    );
  });

  it('refuses an account with no role claim at all', async () => {
    expect(await run({} as Profile)).toBe(false);
    expect(await run(undefined)).toBe(false);
  });
});

describe('jwt', () => {
  beforeEach(() => {
    resolveActorId.mockReset();
    resolveActorId.mockResolvedValue(ACCOUNT_ID);
  });

  it('stores the role and tenant from the profile at sign-in', async () => {
    const token = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['smt']),
      user: { id: SUB },
    });
    expect(token['role']).toBe('smt');
    expect(token['tenantId']).toBe(TENANT);
  });

  it('resolves the school’s own account for the provider subject, and stores that as the actor', async () => {
    const token = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['smt']),
      user: { id: SUB },
    });
    expect(resolveActorId).toHaveBeenCalledWith({ tenantId: TENANT, subject: SUB });
    expect(token['userId']).toBe(ACCOUNT_ID);
    expect(token['userId']).not.toBe(SUB);
  });

  it('prefers the verified profile’s subject over the token’s', async () => {
    const profile = { ...profileWith(['hod']), sub: 'profile-sub' } as unknown as Profile;
    await jwt({ token: { sub: SUB } as JWT, account, profile, user: { id: SUB } });
    expect(resolveActorId).toHaveBeenCalledWith({
      tenantId: TENANT,
      subject: 'profile-sub',
    });
  });

  it('stores no actor when the person has no active account — the sign-in is not blocked', async () => {
    resolveActorId.mockResolvedValue('');
    const token = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['hod']),
      user: { id: SUB },
    });
    expect(token['userId']).toBe('');
    expect(token['role']).toBe('hod');
  });

  it('fails the sign-in on a database fault instead of issuing a session without an actor', async () => {
    resolveActorId.mockRejectedValue(new Error('db down'));
    await expect(
      jwt({
        token: { sub: SUB } as JWT,
        account,
        profile: profileWith(['hod']),
        user: { id: SUB },
      }),
    ).rejects.toThrow('db down');
  });

  it('does not look the account up again on later requests', async () => {
    await jwt({
      token: { sub: SUB, role: 'hod' } as JWT,
      user: { id: SUB },
      account: null,
    });
    expect(resolveActorId).not.toHaveBeenCalled();
  });

  it('throws rather than inventing a role if signIn was somehow bypassed', async () => {
    await expect(
      jwt({
        token: { sub: SUB } as JWT,
        account,
        profile: profileWith([]),
        user: { id: SUB },
      }),
    ).rejects.toThrow('recognised role');
  });

  it('leaves an existing token alone on later requests', async () => {
    const token = { sub: SUB, role: 'hod' } as JWT;
    expect(await jwt({ token, user: { id: SUB }, account: null })).toBe(token);
  });
});

describe('session', () => {
  const base = { user: {}, expires: '2099-01-01T00:00:00.000Z' } as Session;
  const run = (token: Record<string, unknown>) =>
    session({
      session: base,
      token: token as JWT,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    });

  it('carries the role, tenant and resolved account id from the token', async () => {
    const s = (await run({
      sub: SUB,
      role: 'hod',
      tenantId: TENANT,
      userId: ACCOUNT_ID,
    })) as Session;
    expect(s.role).toBe('hod');
    expect(s.tenantId).toBe(TENANT);
    expect(s.userId).toBe(ACCOUNT_ID);
  });

  it('never falls back to the provider subject as the actor', async () => {
    // A token without a resolved account (issued before OQ-033, or no active account).
    const s = (await run({ sub: SUB, role: 'hod', tenantId: TENANT })) as Session;
    expect(s.userId).toBe('');
    const empty = (await run({
      sub: SUB,
      role: 'hod',
      tenantId: TENANT,
      userId: '',
    })) as Session;
    expect(empty.userId).toBe('');
  });

  it.each([
    ['no role', { sub: SUB, tenantId: TENANT }],
    ['an unknown role', { sub: SUB, role: 'superuser', tenantId: TENANT }],
    ['a role with the wrong case', { sub: SUB, role: 'Admin', tenantId: TENANT }],
    ['a non-string role', { sub: SUB, role: 7, tenantId: TENANT }],
  ])('is not a session for a token with %s — never a teacher', async (_name, token) => {
    await expect(run(token)).rejects.toThrow('recognised role');
  });
});
