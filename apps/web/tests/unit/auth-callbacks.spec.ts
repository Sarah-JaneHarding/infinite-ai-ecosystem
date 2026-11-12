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
const { resolveSignIn } = vi.hoisted(() => ({ resolveSignIn: vi.fn() }));
vi.mock('../../src/lib/actor-resolution', () => ({ resolveSignIn }));

// Which roles the school has granted is its own unit (role-resolution.spec.ts / eligible-roles.spec.ts).
// By default the stand-in agrees with the claim; tests that care say otherwise.
const { resolveEligibleRoles } = vi.hoisted(() => ({ resolveEligibleRoles: vi.fn() }));
vi.mock('../../src/lib/role-resolution', () => ({ resolveEligibleRoles }));

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
    resolveSignIn.mockReset();
    resolveSignIn.mockResolvedValue({ actorId: ACCOUNT_ID, outcome: 'existing' });
    resolveEligibleRoles.mockReset();
    resolveEligibleRoles.mockImplementation(
      async ({ claimRoles }: { claimRoles: string[] }) => ({
        eligible: claimRoles,
        assignedNotClaimed: [],
        claimedNotAssigned: [],
      }),
    );
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
    expect(resolveSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, subject: SUB }),
    );
    expect(token['userId']).toBe(ACCOUNT_ID);
    expect(token['userId']).not.toBe(SUB);
  });

  it('prefers the verified profile’s subject over the token’s', async () => {
    const profile = { ...profileWith(['hod']), sub: 'profile-sub' } as unknown as Profile;
    await jwt({ token: { sub: SUB } as JWT, account, profile, user: { id: SUB } });
    expect(resolveSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, subject: 'profile-sub' }),
    );
  });

  it('stores no actor when the person has no active account — the sign-in is not blocked', async () => {
    resolveSignIn.mockResolvedValue({ actorId: '', outcome: 'no_invitation' });
    resolveEligibleRoles.mockResolvedValue({
      eligible: [],
      assignedNotClaimed: [],
      claimedNotAssigned: ['hod'],
    });
    const token = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['hod']),
      user: { id: SUB },
    });
    expect(token['userId']).toBe('');
    // Nothing granted → nothing to act as: a claim alone never becomes a role (§4.8).
    expect(token['role']).toBeUndefined();
    expect(token['eligibleRoles']).toEqual([]);
  });

  it('fails the sign-in on a database fault instead of issuing a session without an actor', async () => {
    resolveSignIn.mockRejectedValue(new Error('db down'));
    await expect(
      jwt({
        token: { sub: SUB } as JWT,
        account,
        profile: profileWith(['hod']),
        user: { id: SUB },
      }),
    ).rejects.toThrow('db down');
  });

  it('hands the sign-in the verified identity — the address, whether it is verified, the name', async () => {
    const profile = {
      ...profileWith(['teacher']),
      email: 'ada@example.invalid',
      email_verified: true,
      name: 'Ada',
    } as unknown as Profile;
    await jwt({ token: { sub: SUB } as JWT, account, profile, user: { id: SUB } });
    expect(resolveSignIn).toHaveBeenCalledWith({
      tenantId: TENANT,
      subject: SUB,
      email: 'ada@example.invalid',
      emailVerified: true,
      displayName: 'Ada',
    });
  });

  it('treats a profile that does not assert a verified address as unverified', async () => {
    await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['teacher']),
      user: { id: SUB },
    });
    expect(resolveSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false, email: '' }),
    );
  });

  it('stores why: the outcome of the sign-in travels on the token', async () => {
    resolveSignIn.mockResolvedValue({ actorId: ACCOUNT_ID, outcome: 'linked' });
    const linked = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['teacher']),
      user: { id: SUB },
    });
    expect(linked['accountOutcome']).toBe('linked');
    resolveSignIn.mockResolvedValue({ actorId: '', outcome: 'invitation_expired' });
    const refused = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['teacher']),
      user: { id: SUB },
    });
    expect(refused['userId']).toBe('');
    expect(refused['accountOutcome']).toBe('invitation_expired');
  });

  it('asks for eligibility with the resolved account and the whole claim, in the provider’s order', async () => {
    await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['learner', 'offline_access', 'admin', 'learner']),
      user: { id: SUB },
    });
    expect(resolveEligibleRoles).toHaveBeenCalledWith({
      tenantId: TENANT,
      accountId: ACCOUNT_ID,
      claimRoles: ['learner', 'admin'],
    });
  });

  it('acts as the one eligible role without asking', async () => {
    resolveEligibleRoles.mockResolvedValue({
      eligible: ['hod'],
      assignedNotClaimed: [],
      claimedNotAssigned: ['admin'],
    });
    const token = await jwt({
      token: { sub: SUB } as JWT,
      account,
      profile: profileWith(['hod', 'admin']),
      user: { id: SUB },
    });
    expect(token['role']).toBe('hod');
    expect(token['eligibleRoles']).toEqual(['hod']);
  });

  it('leaves the role empty when more than one is eligible — nothing is picked for the person', async () => {
    resolveEligibleRoles.mockResolvedValue({
      eligible: ['teacher', 'hod'],
      assignedNotClaimed: [],
      claimedNotAssigned: [],
    });
    const token = await jwt({
      token: { sub: SUB, role: 'admin' } as JWT, // a stale value must not survive a new sign-in
      account,
      profile: profileWith(['teacher', 'hod']),
      user: { id: SUB },
    });
    expect(token['role']).toBeUndefined();
    expect(token['eligibleRoles']).toEqual(['teacher', 'hod']);
  });

  it('does not look the account up again on later requests', async () => {
    await jwt({
      token: { sub: SUB, role: 'hod' } as JWT,
      user: { id: SUB },
      account: null,
    });
    expect(resolveSignIn).not.toHaveBeenCalled();
    expect(resolveEligibleRoles).not.toHaveBeenCalled();
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

describe('jwt — the chooser’s update (OQ-032)', () => {
  const pending = (extra: Record<string, unknown> = {}) =>
    ({ sub: SUB, eligibleRoles: ['teacher', 'hod'], ...extra }) as JWT;
  const update = (token: JWT, requested: unknown) =>
    jwt({
      token,
      user: { id: SUB },
      account: null,
      trigger: 'update',
      session: { role: requested },
    });

  it('sets the role the person chose, when it is one the token offered', async () => {
    const token = await update(pending(), 'hod');
    expect(token['role']).toBe('hod');
    expect(token['eligibleRoles']).toEqual(['teacher', 'hod']);
  });

  it.each([
    ['a role the token did not offer', 'admin'],
    ['a platform role the token did not offer', 'platform_admin'],
    ['something that is not a role', 'superuser'],
    ['a non-string', 7],
    ['nothing', undefined],
  ])('refuses a forged request for %s', async (_name, requested) => {
    const token = await update(pending(), requested);
    expect(token['role']).toBeUndefined();
  });

  it('does not switch roles: once one is active the request is ignored', async () => {
    const token = await update(pending({ role: 'teacher' }), 'hod');
    expect(token['role']).toBe('teacher');
  });

  it('cannot choose from a token that carries no offered roles', async () => {
    const token = await update({ sub: SUB } as JWT, 'teacher');
    expect(token['role']).toBeUndefined();
  });

  it('cannot choose from a malformed offered list', async () => {
    const token = await update(
      { sub: SUB, eligibleRoles: ['teacher', 'nope'] } as JWT,
      'teacher',
    );
    expect(token['role']).toBeUndefined();
  });

  it('ignores an update with no session payload at all', async () => {
    const token = await jwt({
      token: pending(),
      user: { id: SUB },
      account: null,
      trigger: 'update',
    });
    expect(token['role']).toBeUndefined();
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

  it('carries the outcome, and reads one it does not recognise — or none — as null', async () => {
    const known = (await run({
      sub: SUB,
      role: 'hod',
      tenantId: TENANT,
      accountOutcome: 'no_invitation',
    })) as Session;
    expect(known.accountOutcome).toBe('no_invitation');
    for (const accountOutcome of [undefined, 'made_up', 7]) {
      const s = (await run({
        sub: SUB,
        role: 'hod',
        tenantId: TENANT,
        accountOutcome,
      })) as Session;
      expect(s.accountOutcome).toBeNull();
    }
  });

  it('is a session with no role while the person still has to choose one', async () => {
    const s = (await run({
      sub: SUB,
      tenantId: TENANT,
      userId: ACCOUNT_ID,
      eligibleRoles: ['teacher', 'hod'],
    })) as Session;
    expect(s.role).toBeNull();
    expect(s.eligibleRoles).toEqual(['teacher', 'hod']);
  });

  it('is a session with no role and nothing to choose when no role is eligible', async () => {
    const s = (await run({ sub: SUB, tenantId: TENANT, eligibleRoles: [] })) as Session;
    expect(s.role).toBeNull();
    expect(s.eligibleRoles).toEqual([]);
  });

  it('lists the active role as the only one for a token issued before the chooser', async () => {
    const s = (await run({ sub: SUB, role: 'hod', tenantId: TENANT })) as Session;
    expect(s.eligibleRoles).toEqual(['hod']);
  });

  it('exposes the server’s eligible list alongside an active role', async () => {
    const s = (await run({
      sub: SUB,
      role: 'hod',
      eligibleRoles: ['teacher', 'hod'],
      tenantId: TENANT,
    })) as Session;
    expect(s.role).toBe('hod');
    expect(s.eligibleRoles).toEqual(['teacher', 'hod']);
  });

  it.each([
    ['no role', { sub: SUB, tenantId: TENANT }],
    ['a malformed offered list', { sub: SUB, tenantId: TENANT, eligibleRoles: ['x'] }],
    [
      'an offered list that is not a list',
      { sub: SUB, tenantId: TENANT, eligibleRoles: 'hod' },
    ],
    ['an unknown role', { sub: SUB, role: 'superuser', tenantId: TENANT }],
    ['a role with the wrong case', { sub: SUB, role: 'Admin', tenantId: TENANT }],
    ['a non-string role', { sub: SUB, role: 7, tenantId: TENANT }],
  ])('is not a session for a token with %s — never a teacher', async (_name, token) => {
    await expect(run(token)).rejects.toThrow('recognised role');
  });
});
