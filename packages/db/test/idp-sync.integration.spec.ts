// "Has the identity provider been told?" against a real Postgres (OQ-033 step 7c). Connects as `app_rw`,
// so RLS is enforced: what is proved here holds for the role the application actually uses.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  loadIdpAccountWork,
  loadIdpInvitationWork,
  markAccountIdpPending,
  recordAccountIdp,
  recordInvitationIdp,
  requestInvitationIdpSync,
} from '../src/idp-sync.js';
import {
  acceptInvitation,
  createInvitation,
  reinstateAccount,
  revokeRole,
  setAccountStatus,
} from '../src/provisioning.js';
import { grantRole } from '../src/role-grant.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';
import { testRules } from './support/provisioning-rules.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;
const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const NOW = new Date('2026-11-13T08:00:00.000Z');
const FUTURE = new Date('2026-12-13T08:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  for (const id of [TENANT, OTHER_TENANT]) {
    await asTenant(migrator, id, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id,
          name: `School ${id.slice(0, 4)}`,
          slug: `idp-${id.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
  }
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

const inTenant = <T>(tenantId: string, fn: Parameters<typeof asTenant<T>>[3]) =>
  asTenant(appRw, tenantId, randomUUID(), fn);

async function makeAccount(
  roles: string[],
  idpState: 'NOT_MANAGED' | 'SYNCED' = 'NOT_MANAGED',
  tenantId = TENANT,
) {
  return asTenant(migrator, tenantId, randomUUID(), async (tx) => {
    const account = await tx.userAccount.create({
      data: {
        tenantId,
        subject: `sub-${randomUUID()}`,
        email: `${randomUUID()}@example.invalid`,
        displayName: 'Test',
        idpState,
      },
    });
    for (const role of roles) {
      await tx.roleAssignment.create({
        data: {
          tenantId,
          userAccountId: account.id,
          role,
          grantedAt: new Date('2026-01-01'),
        },
      });
    }
    return account;
  });
}

const stateOf = (accountId: string, tenantId = TENANT) =>
  inTenant(tenantId, async (tx) => {
    const row = await tx.userAccount.findFirst({ where: { id: accountId } });
    return `${row?.idpState}/${row?.idpErrorKind ?? '-'}`;
  });

describe('marking an account out of date', () => {
  it('leaves an unmanaged account alone, and moves a managed one to PENDING', async () => {
    const unmanaged = await makeAccount(['teacher']);
    const managed = await makeAccount(['teacher'], 'SYNCED');
    await inTenant(TENANT, (tx) => markAccountIdpPending(tx, unmanaged.id));
    await inTenant(TENANT, (tx) => markAccountIdpPending(tx, managed.id));
    expect(await stateOf(unmanaged.id)).toBe('NOT_MANAGED/-');
    expect(await stateOf(managed.id)).toBe('PENDING/-');
  });

  it('clears an earlier failure when the account changes again', async () => {
    const account = await makeAccount(['teacher'], 'SYNCED');
    await inTenant(TENANT, async (tx) => {
      await markAccountIdpPending(tx, account.id);
      await recordAccountIdp(
        tx,
        account.id,
        { ok: false, errorKind: 'unavailable' },
        NOW,
      );
    });
    expect(await stateOf(account.id)).toBe('FAILED/unavailable');
    await inTenant(TENANT, (tx) => markAccountIdpPending(tx, account.id));
    expect(await stateOf(account.id)).toBe('PENDING/-');
  });

  it('cannot reach another school’s account', async () => {
    const foreign = await makeAccount(['teacher'], 'SYNCED', OTHER_TENANT);
    await inTenant(TENANT, (tx) => markAccountIdpPending(tx, foreign.id));
    expect(await stateOf(foreign.id, OTHER_TENANT)).toBe('SYNCED/-');
  });
});

describe('every status and role change marks a managed account — and only a managed one', () => {
  const rules = testRules;
  const run = (fn: Parameters<typeof asTenant<unknown>>[3]) => inTenant(TENANT, fn);

  it.each([
    [
      'suspending',
      (admin: string, target: string) => (tx: Parameters<typeof setAccountStatus>[0]) =>
        setAccountStatus(tx, rules, {
          actorAccountId: admin,
          targetAccountId: target,
          status: 'SUSPENDED',
          now: NOW,
        }),
    ],
    [
      'removing a role',
      (admin: string, target: string) => (tx: Parameters<typeof revokeRole>[0]) =>
        revokeRole(tx, rules, {
          actorAccountId: admin,
          targetAccountId: target,
          role: 'teacher',
          now: NOW,
        }),
    ],
    [
      'granting a role',
      (admin: string, target: string) => (tx: Parameters<typeof grantRole>[0]) =>
        grantRole(tx, rules, {
          actorAccountId: admin,
          targetAccountId: target,
          roles: ['hod'],
          now: NOW,
        }),
    ],
  ])('%s', async (_name, action) => {
    const admin = await makeAccount(['admin']);
    const managed = await makeAccount(['teacher'], 'SYNCED');
    const unmanaged = await makeAccount(['teacher']);
    expect(
      (await run(action(admin.id, managed.id) as never)) as { ok: boolean },
    ).toMatchObject({ ok: true });
    expect(
      (await run(action(admin.id, unmanaged.id) as never)) as { ok: boolean },
    ).toMatchObject({ ok: true });
    expect(await stateOf(managed.id)).toBe('PENDING/-');
    expect(await stateOf(unmanaged.id)).toBe('NOT_MANAGED/-');
  });

  it('reinstating', async () => {
    const admin = await makeAccount(['admin']);
    const managed = await makeAccount(['teacher'], 'SYNCED');
    await run((tx) =>
      setAccountStatus(tx, rules, {
        actorAccountId: admin.id,
        targetAccountId: managed.id,
        status: 'SUSPENDED',
        now: NOW,
      }),
    );
    await run((tx) => recordAccountIdp(tx, managed.id, { ok: true }, NOW));
    expect(await stateOf(managed.id)).toBe('SYNCED/-');
    await run((tx) =>
      reinstateAccount(tx, rules, {
        actorAccountId: admin.id,
        targetAccountId: managed.id,
        now: NOW,
      }),
    );
    expect(await stateOf(managed.id)).toBe('PENDING/-');
  });

  it('a refused change marks nothing', async () => {
    const admin = await makeAccount(['admin']);
    const managed = await makeAccount(['teacher'], 'SYNCED');
    const refused = await run((tx) =>
      revokeRole(tx, rules, {
        actorAccountId: admin.id,
        targetAccountId: managed.id,
        role: 'hod',
        now: NOW,
      }),
    );
    expect(refused).toEqual({ ok: false, reason: 'no_such_role' });
    expect(await stateOf(managed.id)).toBe('SYNCED/-');
  });
});

describe('invitations', () => {
  const invite = async (email: string, roles: string[] = ['teacher']) => {
    const admin = await makeAccount(['admin']);
    const result = await inTenant(TENANT, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles,
        expiresAt: FUTURE,
        now: NOW,
      }),
    );
    if (!result.ok) throw new Error(`invite refused: ${result.reason}`);
    return result.invitationId;
  };
  const row = (id: string) =>
    inTenant(TENANT, (tx) => tx.userInvitation.findFirstOrThrow({ where: { id } }));

  it('opts in once; recording a created user makes it SYNCED and audits it without the address', async () => {
    const email = `${randomUUID()}@example.invalid`;
    const id = await invite(email);
    expect(await inTenant(TENANT, (tx) => requestInvitationIdpSync(tx, id))).toBe(true);
    expect(await inTenant(TENANT, (tx) => requestInvitationIdpSync(tx, id))).toBe(false);
    await inTenant(TENANT, (tx) =>
      recordInvitationIdp(tx, id, { ok: true }, 'kc-user-1', NOW),
    );
    expect(await row(id)).toMatchObject({
      idpState: 'SYNCED',
      idpUserId: 'kc-user-1',
      idpErrorKind: null,
    });
    const audit = await inTenant(TENANT, (tx) =>
      tx.auditEvent.findMany({ where: { resourceId: id } }),
    );
    const created = audit.find((e) => e.action === 'user_invitation.idp_user_created');
    expect(created).toBeDefined();
    expect(JSON.stringify(created?.diff)).not.toContain(email);
  });

  it('keeps the user id from a half-finished attempt, so a retry finds it', async () => {
    const id = await invite(`${randomUUID()}@example.invalid`);
    await inTenant(TENANT, (tx) => requestInvitationIdpSync(tx, id));
    await inTenant(TENANT, (tx) =>
      recordInvitationIdp(
        tx,
        id,
        { ok: false, errorKind: 'unavailable' },
        'kc-half',
        NOW,
      ),
    );
    expect(await row(id)).toMatchObject({
      idpState: 'FAILED',
      idpUserId: 'kc-half',
      idpErrorKind: 'unavailable',
    });
    const work = await inTenant(TENANT, (tx) => loadIdpInvitationWork(tx, NOW));
    expect(work.find((w) => w.id === id)).toMatchObject({ idpUserId: 'kc-half' });
  });

  it('offers only what should become a login: not unmanaged, not awaiting confirmation, not expired, not revoked', async () => {
    const ready = await invite(`${randomUUID()}@example.invalid`);
    const unmanaged = await invite(`${randomUUID()}@example.invalid`);
    const awaiting = await invite(`${randomUUID()}@example.invalid`);
    const expired = await invite(`${randomUUID()}@example.invalid`);
    const revoked = await invite(`${randomUUID()}@example.invalid`);
    await inTenant(TENANT, async (tx) => {
      for (const id of [ready, awaiting, expired, revoked])
        await requestInvitationIdpSync(tx, id);
    });
    await asTenant(migrator, TENANT, randomUUID(), async (tx) => {
      await tx.userInvitation.update({
        where: { id: awaiting },
        data: { confirmation: 'AWAITING' },
      });
      await tx.userInvitation.update({
        where: { id: expired },
        data: { expiresAt: new Date('2026-11-01T00:00:00Z') },
      });
      await tx.userInvitation.update({
        where: { id: revoked },
        data: { status: 'REVOKED' },
      });
    });
    const ids = (await inTenant(TENANT, (tx) => loadIdpInvitationWork(tx, NOW))).map(
      (w) => w.id,
    );
    expect(ids).toContain(ready);
    for (const excluded of [unmanaged, awaiting, expired, revoked])
      expect(ids).not.toContain(excluded);
  });

  it('a school never sees another school’s work', async () => {
    const id = await invite(`${randomUUID()}@example.invalid`);
    await inTenant(TENANT, (tx) => requestInvitationIdpSync(tx, id));
    const other = await inTenant(OTHER_TENANT, (tx) => loadIdpInvitationWork(tx, NOW));
    expect(other.map((w) => w.id)).not.toContain(id);
  });

  it('refuses a synced invitation with no user id at the database, not only in code', async () => {
    const id = await invite(`${randomUUID()}@example.invalid`);
    await expect(
      asTenant(migrator, TENANT, randomUUID(), (tx) =>
        tx.userInvitation.update({ where: { id }, data: { idpState: 'SYNCED' } }),
      ),
    ).rejects.toThrow();
  });
});

describe('accepting an invitation Keycloak was told about', () => {
  async function syncedInvitation(email: string, kcUserId: string) {
    const admin = await makeAccount(['admin']);
    const created = await inTenant(TENANT, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles: ['teacher'],
        expiresAt: FUTURE,
        now: NOW,
      }),
    );
    if (!created.ok) throw new Error('invite refused');
    await inTenant(TENANT, async (tx) => {
      await requestInvitationIdpSync(tx, created.invitationId);
      await recordInvitationIdp(tx, created.invitationId, { ok: true }, kcUserId, NOW);
    });
    return created.invitationId;
  }
  const accept = (email: string, subject: string) =>
    inTenant(TENANT, (tx) =>
      acceptInvitation(tx, {
        subject,
        email,
        emailVerified: true,
        displayName: 'New Person',
        now: NOW,
      }),
    );

  it('the Keycloak user we created links, and the new account is managed from then on', async () => {
    const email = `${randomUUID()}@example.invalid`;
    await syncedInvitation(email, 'kc-ours');
    const result = await accept(email, 'kc-ours');
    expect(result).toMatchObject({ ok: true, outcome: 'linked' });
    if (!result.ok) return;
    expect(await stateOf(result.accountId)).toBe('SYNCED/-');
  });

  it('a different Keycloak user at the same address is refused, and no account is created', async () => {
    const email = `${randomUUID()}@example.invalid`;
    await syncedInvitation(email, 'kc-ours');
    expect(await accept(email, 'kc-someone-else')).toEqual({
      ok: false,
      reason: 'subject_mismatch',
    });
    const accounts = await inTenant(TENANT, (tx) =>
      tx.userAccount.count({ where: { subject: 'kc-someone-else' } }),
    );
    expect(accounts).toBe(0);
  });

  it('an invitation nobody opted in still links as before, and the account stays unmanaged', async () => {
    const admin = await makeAccount(['admin']);
    const email = `${randomUUID()}@example.invalid`;
    await inTenant(TENANT, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles: ['teacher'],
        expiresAt: FUTURE,
        now: NOW,
      }),
    );
    const result = await accept(email, `sub-${randomUUID()}`);
    expect(result).toMatchObject({ ok: true, outcome: 'linked' });
    if (!result.ok) return;
    expect(await stateOf(result.accountId)).toBe('NOT_MANAGED/-');
  });
});

describe('the work for an account', () => {
  it('is derived from the database now: enabled only while ACTIVE, with the roles held now', async () => {
    const admin = await makeAccount(['admin']);
    const target = await makeAccount(['teacher', 'hod'], 'SYNCED');
    await inTenant(TENANT, async (tx) => {
      await revokeRole(tx, testRules, {
        actorAccountId: admin.id,
        targetAccountId: target.id,
        role: 'hod',
        now: NOW,
      });
    });
    let work = (await inTenant(TENANT, (tx) => loadIdpAccountWork(tx, NOW))).find(
      (w) => w.id === target.id,
    );
    expect(work).toMatchObject({ enabled: true, roles: ['teacher'] });
    await inTenant(TENANT, (tx) =>
      setAccountStatus(tx, testRules, {
        actorAccountId: admin.id,
        targetAccountId: target.id,
        status: 'SUSPENDED',
        now: NOW,
      }),
    );
    work = (await inTenant(TENANT, (tx) => loadIdpAccountWork(tx, NOW))).find(
      (w) => w.id === target.id,
    );
    expect(work).toMatchObject({ enabled: false, roles: ['teacher'] });
  });

  it('does not list an unmanaged or an already synced account', async () => {
    const unmanaged = await makeAccount(['teacher']);
    const synced = await makeAccount(['teacher'], 'SYNCED');
    const ids = (await inTenant(TENANT, (tx) => loadIdpAccountWork(tx, NOW))).map(
      (w) => w.id,
    );
    expect(ids).not.toContain(unmanaged.id);
    expect(ids).not.toContain(synced.id);
  });
});
