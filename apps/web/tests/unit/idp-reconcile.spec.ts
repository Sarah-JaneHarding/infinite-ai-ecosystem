// The rules the identity-provider sync keeps (OQ-033 step 7d), against the fake provider and an in-memory
// store — so each is checked without Keycloak or a database. The data-layer half is the db package's
// `idp-sync.integration.spec.ts`; the Keycloak half is slice 7e.

import { describe, expect, it } from 'vitest';

import { IdpError } from '../../src/lib/idp/port';
import { reconcileIdentityProvider, type IdpStore } from '../../src/lib/idp/reconcile';
import { createFakeIdp } from '../support/fake-idp';

const TENANT = '10000000-0000-4000-8000-000000000001';

interface InvitationWork {
  id: string;
  email: string;
  roles: string[];
  schoolId: string | null;
  idpUserId: string | null;
}
interface AccountWork {
  id: string;
  subject: string;
  enabled: boolean;
  roles: string[];
}

function memoryStore(invitations: InvitationWork[] = [], accounts: AccountWork[] = []) {
  const log: string[] = [];
  const outcomes: {
    kind: 'invitation' | 'account';
    id: string;
    outcome: unknown;
    userId?: string | null;
  }[] = [];
  const store: IdpStore & { log: string[]; outcomes: typeof outcomes } = {
    log,
    outcomes,
    async loadWork() {
      return { invitations, accounts };
    },
    async recordInvitationUser(id, userId) {
      log.push(`store:user:${id}:${userId}`);
      const row = invitations.find((i) => i.id === id);
      if (row) row.idpUserId = userId;
    },
    async recordInvitation(id, outcome, userId) {
      log.push(`store:invitation:${id}`);
      outcomes.push({ kind: 'invitation', id, outcome, userId });
    },
    async recordAccount(id, outcome) {
      log.push(`store:account:${id}`);
      outcomes.push({ kind: 'account', id, outcome });
    },
  };
  return store;
}
const invitation = (over: Partial<InvitationWork> = {}): InvitationWork => ({
  id: 'inv-1',
  email: 'new.teacher@school.example',
  roles: ['teacher'],
  schoolId: null,
  idpUserId: null,
  ...over,
});
const account = (over: Partial<AccountWork> = {}): AccountWork => ({
  id: 'acc-1',
  subject: 'kc-0001',
  enabled: true,
  roles: ['teacher'],
  ...over,
});

describe('an invitation that becomes a login', () => {
  it('creates the user, remembers its id BEFORE doing anything else to it, then sets roles and sends the email', async () => {
    const idp = createFakeIdp();
    const store = memoryStore([invitation({ roles: ['teacher', 'hod'] })]);
    const result = await reconcileIdentityProvider(idp, store, TENANT);
    expect(result).toEqual({ synced: 1, failed: 0 });
    const user = [...idp.users.values()][0];
    expect(user).toMatchObject({
      email: 'new.teacher@school.example',
      tenantId: TENANT,
      enabled: true,
    });
    expect(user?.roles.sort()).toEqual(['hod', 'teacher']);
    expect(user?.requiredActions).toEqual(['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
    expect(user?.emailsSent).toHaveLength(1);
    // The id is stored at the moment of creation: before the roles call, so a crash there loses nothing.
    expect(idp.calls).toEqual([
      'findUserByEmail',
      'createUser',
      'setRoles',
      'sendActionsEmail',
    ]);
    expect(store.log.indexOf(`store:user:inv-1:${user?.id}`)).toBeGreaterThanOrEqual(0);
    expect(store.outcomes[0]).toMatchObject({ outcome: { ok: true }, userId: user?.id });
  });

  it('never adopts a Keycloak user it did not create: an existing address is a conflict, and nothing is touched', async () => {
    const idp = createFakeIdp();
    const stranger = await idp.createUser({
      email: 'new.teacher@school.example',
      tenantId: 'other',
      requiredActions: [],
    });
    idp.calls.length = 0;
    const store = memoryStore([invitation()]);
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 0,
      failed: 1,
    });
    expect(idp.calls).toEqual(['findUserByEmail']); // no create, no roles, no email to someone else's account
    expect(idp.users.get(stranger.id)).toMatchObject({
      tenantId: 'other',
      roles: [],
      emailsSent: [],
    });
    expect(store.outcomes[0]).toMatchObject({
      outcome: { ok: false, errorKind: 'conflict' },
      userId: null,
    });
  });

  it('finishes a half-done attempt through the recorded id, without creating a second user', async () => {
    const idp = createFakeIdp();
    const first = await idp.createUser({
      email: 'new.teacher@school.example',
      tenantId: TENANT,
      requiredActions: [],
    });
    idp.calls.length = 0;
    const store = memoryStore([invitation({ idpUserId: first.id })]);
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 0,
    });
    expect(idp.calls).toEqual(['setRoles', 'sendActionsEmail']);
    expect(idp.users.size).toBe(1);
    expect(idp.users.get(first.id)?.roles).toEqual(['teacher']);
  });

  it('after a failure past creation, keeps the id so the next attempt completes instead of conflicting', async () => {
    const idp = createFakeIdp();
    const row = invitation();
    const store = memoryStore([row]);
    idp.failNext('setRoles', 'unavailable');
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 0,
      failed: 1,
    });
    expect(row.idpUserId).not.toBeNull(); // recorded at creation, before the failure
    expect(store.outcomes[0]).toMatchObject({
      outcome: { ok: false, errorKind: 'unavailable' },
      userId: row.idpUserId,
    });
    store.outcomes.length = 0;
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 0,
    });
    expect(idp.users.size).toBe(1); // the same user, completed
  });

  it.each([['platform_admin'], ['platform_support'], ['not_a_role']])(
    'refuses the role %s before touching the provider',
    async (role) => {
      const idp = createFakeIdp();
      const store = memoryStore([invitation({ roles: ['teacher', role] })]);
      expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
        synced: 0,
        failed: 1,
      });
      expect(idp.calls).toEqual([]);
      expect(store.outcomes[0]).toMatchObject({
        outcome: { ok: false, errorKind: 'invalid_role' },
      });
    },
  );

  it('records a failed email as a failure of this invitation only', async () => {
    const idp = createFakeIdp();
    const store = memoryStore([
      invitation({ id: 'a', email: 'a@school.example' }),
      invitation({ id: 'b', email: 'b@school.example' }),
    ]);
    idp.failNext('sendActionsEmail', 'forbidden');
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 1,
    });
    expect(store.outcomes.map((o) => [o.id, (o.outcome as { ok: boolean }).ok])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });
});

describe('an account whose database state changed', () => {
  async function withUser(roles: string[] = ['teacher']) {
    const idp = createFakeIdp();
    const user = await idp.createUser({
      email: 'p@school.example',
      tenantId: TENANT,
      requiredActions: [],
    });
    await idp.setRoles(user.id, roles as never);
    idp.calls.length = 0;
    return { idp, user };
  }

  it('mirrors the roles it holds now and enables it', async () => {
    const { idp, user } = await withUser(['teacher', 'hod']);
    idp.users.get(user.id)!.enabled = false;
    const store = memoryStore(
      [],
      [account({ subject: user.id, enabled: true, roles: ['teacher'] })],
    );
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 0,
    });
    expect(idp.users.get(user.id)).toMatchObject({ enabled: true, roles: ['teacher'] });
    expect(idp.calls).toEqual(['setRoles', 'setEnabled']);
  });

  it('ends access first when disabling: disable, then end sessions, then change roles', async () => {
    const { idp, user } = await withUser();
    const store = memoryStore(
      [],
      [account({ subject: user.id, enabled: false, roles: [] })],
    );
    await reconcileIdentityProvider(idp, store, TENANT);
    expect(idp.calls).toEqual(['setEnabled', 'revokeSessions', 'setRoles']);
    expect(idp.users.get(user.id)).toMatchObject({
      enabled: false,
      sessionsRevoked: 1,
      roles: [],
    });
  });

  it('mirrors only school-staff roles, so a platform role in the database is never pushed', async () => {
    const { idp, user } = await withUser();
    const store = memoryStore(
      [],
      [account({ subject: user.id, roles: ['teacher', 'platform_admin'] })],
    );
    // It must SUCCEED with the platform role left out — not merely leave the user unchanged because the
    // provider refused it — and the database row, not the provider, is where the filtering happens.
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 0,
    });
    expect(idp.users.get(user.id)?.roles).toEqual(['teacher']);
  });

  it('a Keycloak user that has gone is a failure of that account, with its kind', async () => {
    const idp = createFakeIdp();
    const store = memoryStore([], [account({ subject: 'kc-missing' })]);
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 0,
      failed: 1,
    });
    expect(store.outcomes[0]).toMatchObject({
      outcome: { ok: false, errorKind: 'not_found' },
    });
  });

  it('one account failing does not stop the next', async () => {
    const { idp, user } = await withUser();
    const store = memoryStore(
      [],
      [
        account({ id: 'gone', subject: 'kc-missing' }),
        account({ id: 'ok', subject: user.id }),
      ],
    );
    expect(await reconcileIdentityProvider(idp, store, TENANT)).toEqual({
      synced: 1,
      failed: 1,
    });
  });
});

describe('what is recorded about a failure', () => {
  it('is a kind only — never a message, an address or an upstream body', async () => {
    const idp = createFakeIdp();
    const store = memoryStore([invitation({ email: 'victim@school.example' })]);
    idp.createUser = async () => {
      throw new Error('upstream said: victim@school.example already has secret=hunter2');
    };
    await reconcileIdentityProvider(idp, store, TENANT);
    const recorded = JSON.stringify(store.outcomes);
    expect(recorded).toContain('"errorKind":"unexpected"');
    expect(recorded).not.toContain('victim@school.example');
    expect(recorded).not.toContain('hunter2');
  });

  it('keeps an IdpError’s kind', async () => {
    const idp = createFakeIdp();
    idp.findUserByEmail = async () => {
      throw new IdpError('unauthorised');
    };
    const store = memoryStore([invitation()]);
    await reconcileIdentityProvider(idp, store, TENANT);
    expect(store.outcomes[0]).toMatchObject({
      outcome: { ok: false, errorKind: 'unauthorised' },
    });
  });
});

describe('when there is nothing to do', () => {
  it('makes no call to the provider', async () => {
    const idp = createFakeIdp();
    expect(await reconcileIdentityProvider(idp, memoryStore(), TENANT)).toEqual({
      synced: 0,
      failed: 0,
    });
    expect(idp.calls).toEqual([]);
  });
});
