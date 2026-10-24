// Provisioning against a real Postgres (OQ-033 step 3): inviting, confirming, accepting,
// revoking and suspending — each audited — and the race the pure rules cannot see, two
// administrators demoting each other at once. Connects as `app_rw`, so RLS is enforced.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acceptInvitation,
  confirmInvitation,
  createInvitation,
  listActiveAdminAccountIds,
  lockProvisioning,
  revokeInvitation,
  revokeRole,
  setAccountStatus,
} from '../src/provisioning.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';
import { testRules } from './support/provisioning-rules.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const NOW = new Date('2026-10-24T08:00:00.000Z');
const LATER = new Date('2026-11-24T08:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  for (const id of [TENANT_A, TENANT_B]) {
    await asTenant(migrator, id, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id,
          name: `School ${id.slice(0, 4)}`,
          slug: `prov-${id.slice(0, 8)}`,
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

/** An ACTIVE account in `tenantId` holding the given roles. */
async function makeAccount(tenantId: string, roles: string[], email?: string) {
  return asTenant(migrator, tenantId, randomUUID(), async (tx) => {
    const account = await tx.userAccount.create({
      data: {
        tenantId,
        subject: `sub-${randomUUID()}`,
        email: email ?? `${randomUUID()}@example.invalid`,
        displayName: 'Test',
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

const auditActions = (tenantId: string, resourceId: string) =>
  inTenant(tenantId, async (tx) =>
    (
      await tx.auditEvent.findMany({
        where: { resourceId },
        orderBy: { sequence: 'asc' },
      })
    ).map((e) => ({
      action: e.action,
      actorId: e.actorId,
      diff: JSON.stringify(e.diff),
    })),
  );

describe('invitations', () => {
  it('creates a plain invitation and audits it without the address', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const email = `Ada.${randomUUID()}@Example.invalid`;
    const result = await inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email: `  ${email}  `,
        roles: ['teacher'],
        expiresAt: LATER,
        now: NOW,
      }),
    );
    expect(result).toMatchObject({ ok: true, confirmation: 'NOT_REQUIRED' });
    if (!result.ok) throw new Error('unreachable');
    const stored = await inTenant(TENANT_A, (tx) =>
      tx.userInvitation.findFirstOrThrow({ where: { id: result.invitationId } }),
    );
    expect(stored.email).toBe(email.toLowerCase());
    const events = await auditActions(TENANT_A, result.invitationId);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('user_invitation.created');
    expect(events[0]?.actorId).toBe(admin.id);
    expect(events[0]?.diff.toLowerCase()).not.toContain('example.invalid');
  });

  it.each([
    [
      'a non-administrator',
      async () => (await makeAccount(TENANT_A, ['teacher'])).id,
      'actor_not_admin',
    ],
    ['an unknown actor', async () => randomUUID(), 'actor_not_admin'],
  ])('refuses %s and writes nothing', async (_what, actor, reason) => {
    const actorAccountId = await actor();
    const email = `${randomUUID()}@example.invalid`;
    const result = await inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId,
        email,
        roles: ['teacher'],
        expiresAt: LATER,
        now: NOW,
      }),
    );
    expect(result).toEqual({ ok: false, reason });
    const count = await inTenant(TENANT_A, (tx) =>
      tx.userInvitation.count({ where: { email } }),
    );
    expect(count).toBe(0);
  });

  it('refuses an invalid address, a past expiry, a duplicate and an address already in use', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const taken = await makeAccount(TENANT_A, ['teacher']);
    const base = {
      actorAccountId: admin.id,
      roles: ['teacher'],
      expiresAt: LATER,
      now: NOW,
    };
    const run = (extra: { email: string; expiresAt?: Date }) =>
      inTenant(TENANT_A, (tx) => createInvitation(tx, testRules, { ...base, ...extra }));
    expect(await run({ email: 'not-an-address' })).toEqual({
      ok: false,
      reason: 'invalid_email',
    });
    expect(await run({ email: 'a@example.invalid', expiresAt: NOW })).toEqual({
      ok: false,
      reason: 'invalid_expiry',
    });
    expect(await run({ email: taken.email.toUpperCase() })).toEqual({
      ok: false,
      reason: 'email_in_use',
    });
    const fresh = `${randomUUID()}@example.invalid`;
    expect(await run({ email: fresh })).toMatchObject({ ok: true });
    expect(await run({ email: fresh })).toEqual({
      ok: false,
      reason: 'pending_invitation_exists',
    });
  });

  it('holds an admin invitation as AWAITING when two administrators exist, and confirms it', async () => {
    const tenant = randomUUID();
    await asTenant(migrator, tenant, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id: tenant,
          name: 'Two admins',
          slug: `two-${tenant.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
    const a = await makeAccount(tenant, ['admin']);
    const b = await makeAccount(tenant, ['admin']);
    const email = `${randomUUID()}@example.invalid`;
    const created = await inTenant(tenant, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: a.id,
        email,
        roles: ['admin'],
        expiresAt: LATER,
        now: NOW,
      }),
    );
    expect(created).toMatchObject({ ok: true, confirmation: 'AWAITING' });
    if (!created.ok) throw new Error('unreachable');

    // Not acceptable while awaiting.
    const early = await inTenant(tenant, (tx) =>
      acceptInvitation(tx, {
        subject: 's1',
        email,
        emailVerified: true,
        displayName: 'X',
        now: NOW,
      }),
    );
    expect(early).toEqual({ ok: false, reason: 'awaiting_confirmation' });

    const self = await inTenant(tenant, (tx) =>
      confirmInvitation(tx, testRules, {
        confirmerAccountId: a.id,
        invitationId: created.invitationId,
        now: NOW,
      }),
    );
    expect(self).toEqual({ ok: false, reason: 'confirmer_is_actor' });
    const outsider = await makeAccount(tenant, ['teacher']);
    expect(
      await inTenant(tenant, (tx) =>
        confirmInvitation(tx, testRules, {
          confirmerAccountId: outsider.id,
          invitationId: created.invitationId,
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'confirmer_not_admin' });

    expect(
      await inTenant(tenant, (tx) =>
        confirmInvitation(tx, testRules, {
          confirmerAccountId: b.id,
          invitationId: created.invitationId,
          now: NOW,
        }),
      ),
    ).toEqual({ ok: true });

    const accepted = await inTenant(tenant, (tx) =>
      acceptInvitation(tx, {
        subject: 's1',
        email,
        emailVerified: true,
        displayName: 'New Admin',
        now: NOW,
      }),
    );
    expect(accepted).toMatchObject({ ok: true, outcome: 'linked', roles: ['admin'] });
    const actions = (await auditActions(tenant, created.invitationId)).map(
      (e) => e.action,
    );
    expect(actions).toEqual([
      'user_invitation.created',
      'user_invitation.confirmed',
      'user_invitation.accepted',
    ]);
  });

  it('waives confirmation for a sole administrator and records that', async () => {
    const tenant = randomUUID();
    await asTenant(migrator, tenant, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id: tenant,
          name: 'Sole',
          slug: `sole-${tenant.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
    const sole = await makeAccount(tenant, ['admin']);
    const result = await inTenant(tenant, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: sole.id,
        email: `${randomUUID()}@example.invalid`,
        roles: ['smt'],
        expiresAt: LATER,
        now: NOW,
      }),
    );
    expect(result).toMatchObject({ ok: true, confirmation: 'WAIVED_SOLE_ADMIN' });
  });

  it('revokes a pending invitation once, only by an administrator, and it can no longer be accepted', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const teacher = await makeAccount(TENANT_A, ['teacher']);
    const email = `${randomUUID()}@example.invalid`;
    const created = await inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles: ['teacher'],
        expiresAt: LATER,
        now: NOW,
      }),
    );
    if (!created.ok) throw new Error('unreachable');
    expect(
      await inTenant(TENANT_A, (tx) =>
        revokeInvitation(tx, {
          actorAccountId: teacher.id,
          invitationId: created.invitationId,
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'actor_not_admin' });
    expect(
      await inTenant(TENANT_A, (tx) =>
        revokeInvitation(tx, {
          actorAccountId: admin.id,
          invitationId: created.invitationId,
          now: NOW,
        }),
      ),
    ).toEqual({ ok: true });
    expect(
      await inTenant(TENANT_A, (tx) =>
        revokeInvitation(tx, {
          actorAccountId: admin.id,
          invitationId: created.invitationId,
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'invitation_not_pending' });
    expect(
      await inTenant(TENANT_A, (tx) =>
        acceptInvitation(tx, {
          subject: randomUUID(),
          email,
          emailVerified: true,
          displayName: 'X',
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'no_invitation' });
  });
});

describe('acceptInvitation', () => {
  async function invited(roles: string[], expiresAt = LATER) {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const email = `${randomUUID()}@example.invalid`;
    const created = await inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles,
        expiresAt,
        now: NOW,
      }),
    );
    if (!created.ok) throw new Error(`setup failed: ${created.reason}`);
    return { admin, email, invitationId: created.invitationId };
  }
  const accept = (
    email: string,
    subject: string,
    extra: { emailVerified?: boolean; now?: Date } = {},
  ) =>
    inTenant(TENANT_A, (tx) =>
      acceptInvitation(tx, {
        subject,
        email,
        emailVerified: extra.emailVerified ?? true,
        displayName: 'Ada',
        now: extra.now ?? NOW,
      }),
    );

  it('creates the account, its roles and the staff link, and marks the invitation accepted', async () => {
    const staff = await asTenant(migrator, TENANT_A, randomUUID(), async (tx) => {
      const school = await tx.school.create({
        data: { tenantId: TENANT_A, name: 'S', lolt: 'English' },
      });
      return tx.staffMember.create({
        data: { tenantId: TENANT_A, schoolId: school.id, displayName: 'Ada Staff' },
      });
    });
    const admin = await makeAccount(TENANT_A, ['admin']);
    const email = `${randomUUID()}@example.invalid`;
    const created = await inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId: admin.id,
        email,
        roles: ['teacher', 'hod'],
        staffMemberId: staff.id,
        expiresAt: LATER,
        now: NOW,
      }),
    );
    if (!created.ok) throw new Error('unreachable');
    const subject = `sub-${randomUUID()}`;
    const result = await accept(email, subject);
    expect(result).toMatchObject({ ok: true, outcome: 'linked' });
    if (!result.ok || result.outcome !== 'linked') throw new Error('unreachable');
    const state = await inTenant(TENANT_A, async (tx) => ({
      account: await tx.userAccount.findFirstOrThrow({ where: { id: result.accountId } }),
      roles: (
        await tx.roleAssignment.findMany({ where: { userAccountId: result.accountId } })
      )
        .map((r) => r.role)
        .sort(),
      staff: await tx.staffMember.findFirstOrThrow({ where: { id: staff.id } }),
      invitation: await tx.userInvitation.findFirstOrThrow({
        where: { id: created.invitationId },
      }),
    }));
    expect(state.account).toMatchObject({ subject, email, status: 'ACTIVE' });
    expect(state.roles).toEqual(['hod', 'teacher']);
    expect(state.staff.userAccountId).toBe(result.accountId);
    expect(state.invitation).toMatchObject({
      status: 'ACCEPTED',
      acceptedAccountId: result.accountId,
    });
    const events = await auditActions(TENANT_A, created.invitationId);
    expect(events.at(-1)).toMatchObject({
      action: 'user_invitation.accepted',
      actorId: result.accountId,
    });
  });

  it('is idempotent for the same subject', async () => {
    const { email } = await invited(['teacher']);
    const subject = `sub-${randomUUID()}`;
    const first = await accept(email, subject);
    const second = await accept(email, subject);
    expect(first).toMatchObject({ outcome: 'linked' });
    expect(second).toMatchObject({ ok: true, outcome: 'existing' });
  });

  it('refuses an unverified address, an unknown address and an expired invitation', async () => {
    const { email, invitationId } = await invited(['teacher']);
    expect(await accept(email, randomUUID(), { emailVerified: false })).toEqual({
      ok: false,
      reason: 'email_not_verified',
    });
    expect(await accept(`${randomUUID()}@example.invalid`, randomUUID())).toEqual({
      ok: false,
      reason: 'no_invitation',
    });
    expect(await accept(email, randomUUID(), { now: new Date('2027-06-01') })).toEqual({
      ok: false,
      reason: 'invitation_expired',
    });
    const status = await inTenant(TENANT_A, (tx) =>
      tx.userInvitation.findFirstOrThrow({ where: { id: invitationId } }),
    );
    expect(status.status).toBe('EXPIRED');
    expect(await accept(email, randomUUID())).toEqual({
      ok: false,
      reason: 'no_invitation',
    });
  });

  it('never relinks a suspended or offboarded subject', async () => {
    const { email } = await invited(['teacher']);
    const suspended = await makeAccount(TENANT_A, ['teacher']);
    await asTenant(migrator, TENANT_A, randomUUID(), (tx) =>
      tx.userAccount.update({
        where: { id: suspended.id },
        data: { status: 'SUSPENDED' },
      }),
    );
    expect(await accept(email, suspended.subject)).toEqual({
      ok: false,
      reason: 'account_not_active',
    });
  });

  it("does not see another school's invitation", async () => {
    const { email } = await invited(['teacher']);
    const result = await inTenant(TENANT_B, (tx) =>
      acceptInvitation(tx, {
        subject: randomUUID(),
        email,
        emailVerified: true,
        displayName: 'X',
        now: NOW,
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'no_invitation' });
  });

  it('creates exactly one account when the same person signs in twice at once', async () => {
    const { email } = await invited(['teacher']);
    const subject = `sub-${randomUUID()}`;
    const results = await Promise.all([accept(email, subject), accept(email, subject)]);
    expect(results.map((r) => (r.ok ? r.outcome : r.reason)).sort()).toEqual([
      'existing',
      'linked',
    ]);
    const count = await inTenant(TENANT_A, (tx) =>
      tx.userAccount.count({ where: { subject } }),
    );
    expect(count).toBe(1);
  });

  it('lets only one of two different identities claim an address at once', async () => {
    const { email } = await invited(['teacher']);
    const results = await Promise.all([
      accept(email, `sub-${randomUUID()}`),
      accept(email, `sub-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, reason: 'no_invitation' },
    ]);
  });
});

describe('revokeRole and setAccountStatus', () => {
  it('ends a role without deleting it, audits it, and refuses the unknown cases', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const target = await makeAccount(TENANT_A, ['teacher', 'hod']);
    const revoke = (role: string, actor = admin.id, targetId = target.id) =>
      inTenant(TENANT_A, (tx) =>
        revokeRole(tx, testRules, {
          actorAccountId: actor,
          targetAccountId: targetId,
          role,
          now: NOW,
        }),
      );
    expect(await revoke('hod')).toEqual({ ok: true });
    const rows = await inTenant(TENANT_A, (tx) =>
      tx.roleAssignment.findMany({ where: { userAccountId: target.id, role: 'hod' } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.expiresAt?.toISOString()).toBe(NOW.toISOString());
    expect(await revoke('hod')).toEqual({ ok: false, reason: 'no_such_role' });
    expect(await revoke('teacher', target.id)).toEqual({
      ok: false,
      reason: 'actor_not_admin',
    });
    expect(await revoke('admin', admin.id, admin.id)).toEqual({
      ok: false,
      reason: 'cannot_change_own_roles',
    });
    expect(await revoke('teacher', admin.id, randomUUID())).toEqual({
      ok: false,
      reason: 'target_not_found',
    });
    expect((await auditActions(TENANT_A, target.id)).map((e) => e.action)).toEqual([
      'role_assignment.revoked',
    ]);
  });

  it('suspends, then offboards (ending every role), and offboarding is final', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const target = await makeAccount(TENANT_A, ['teacher', 'hod']);
    const set = (status: 'SUSPENDED' | 'OFFBOARDED', actor = admin.id) =>
      inTenant(TENANT_A, (tx) =>
        setAccountStatus(tx, testRules, {
          actorAccountId: actor,
          targetAccountId: target.id,
          status,
          now: NOW,
        }),
      );
    expect(await set('SUSPENDED', target.id)).toEqual({
      ok: false,
      reason: 'actor_not_admin',
    });
    expect(await set('SUSPENDED')).toEqual({ ok: true });
    expect(await set('SUSPENDED')).toEqual({ ok: false, reason: 'no_change' });
    expect(await set('OFFBOARDED')).toEqual({ ok: true });
    expect(await set('SUSPENDED')).toEqual({ ok: false, reason: 'already_offboarded' });
    const live = await inTenant(TENANT_A, (tx) =>
      tx.roleAssignment.count({
        where: {
          userAccountId: target.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
        },
      }),
    );
    expect(live).toBe(0);
    expect((await auditActions(TENANT_A, target.id)).map((e) => e.action)).toEqual([
      'user_account.suspended',
      'user_account.offboarded',
    ]);
  });

  it('stops a suspended administrator counting as one', async () => {
    const tenant = randomUUID();
    await asTenant(migrator, tenant, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id: tenant,
          name: 'Count',
          slug: `cnt-${tenant.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
    const a = await makeAccount(tenant, ['admin']);
    const b = await makeAccount(tenant, ['admin']);
    await asTenant(migrator, tenant, randomUUID(), (tx) =>
      tx.userAccount.update({ where: { id: b.id }, data: { status: 'SUSPENDED' } }),
    );
    expect(await inTenant(tenant, (tx) => listActiveAdminAccountIds(tx, NOW))).toEqual([
      a.id,
    ]);
  });
});

describe('two administrators demoting each other', () => {
  async function freshPair() {
    const tenant = randomUUID();
    await asTenant(migrator, tenant, randomUUID(), (tx) =>
      tx.tenant.create({
        data: {
          id: tenant,
          name: 'Pair',
          slug: `pair-${tenant.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
    const a = await makeAccount(tenant, ['admin']);
    const b = await makeAccount(tenant, ['admin']);
    return { tenant, a, b };
  }
  const demote = (tenant: string, actor: string, target: string) =>
    inTenant(tenant, (tx) =>
      revokeRole(tx, testRules, {
        actorAccountId: actor,
        targetAccountId: target,
        role: 'admin',
        now: NOW,
      }),
    );

  it('makes the second demotion wait for the first, then refuses it', async () => {
    const { tenant, a, b } = await freshPair();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    let bHolds: () => void = () => undefined;
    const bHolding = new Promise<void>((r) => (bHolds = r));

    // B demotes A and keeps its transaction open, holding the provisioning lock.
    const bDone = inTenant(tenant, async (tx) => {
      const result = await revokeRole(tx, testRules, {
        actorAccountId: b.id,
        targetAccountId: a.id,
        role: 'admin',
        now: NOW,
      });
      bHolds();
      await gate;
      return result;
    });
    await bHolding;

    let aSettled = false;
    const aDone = demote(tenant, a.id, b.id).then((r) => {
      aSettled = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(aSettled).toBe(false); // blocked on the lock, not racing ahead

    release();
    expect(await bDone).toEqual({ ok: true });
    expect(await aDone).toEqual({ ok: false, reason: 'actor_not_admin' });
    expect(await inTenant(tenant, (tx) => listActiveAdminAccountIds(tx, NOW))).toEqual([
      b.id,
    ]);
  });

  it('never leaves a school with no administrator, however the race falls', async () => {
    for (let i = 0; i < 8; i += 1) {
      const { tenant, a, b } = await freshPair();
      const results = await Promise.all([
        demote(tenant, a.id, b.id),
        demote(tenant, b.id, a.id),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const admins = await inTenant(tenant, (tx) => listActiveAdminAccountIds(tx, NOW));
      expect(admins).toHaveLength(1);
    }
  });

  it('holds the lock until the transaction ends, so a caller can compose steps', async () => {
    const { tenant } = await freshPair();
    await expect(inTenant(tenant, (tx) => lockProvisioning(tx))).resolves.toBeUndefined();
  });
});

describe('the remaining refusals', () => {
  async function schoolAndStaff(linked: boolean) {
    return asTenant(migrator, TENANT_A, randomUUID(), async (tx) => {
      const school = await tx.school.create({
        data: { tenantId: TENANT_A, name: 'Refusals', lolt: 'English' },
      });
      const owner = linked ? await makeAccountIn(tx, TENANT_A) : null;
      const staff = await tx.staffMember.create({
        data: {
          tenantId: TENANT_A,
          schoolId: school.id,
          displayName: 'Staff',
          userAccountId: owner?.id ?? null,
        },
      });
      return { school, staff };
    });
  }
  async function makeAccountIn(
    tx: Parameters<Parameters<typeof asTenant>[3]>[0],
    tenantId: string,
  ) {
    return tx.userAccount.create({
      data: {
        tenantId,
        subject: `sub-${randomUUID()}`,
        email: `${randomUUID()}@example.invalid`,
        displayName: 'Owner',
      },
    });
  }
  const create = (
    actorAccountId: string,
    extra: { email?: string; schoolId?: string; staffMemberId?: string } = {},
  ) =>
    inTenant(TENANT_A, (tx) =>
      createInvitation(tx, testRules, {
        actorAccountId,
        email: extra.email ?? `${randomUUID()}@example.invalid`,
        roles: ['teacher'],
        ...(extra.schoolId === undefined ? {} : { schoolId: extra.schoolId }),
        ...(extra.staffMemberId === undefined
          ? {}
          : { staffMemberId: extra.staffMemberId }),
        expiresAt: LATER,
        now: NOW,
      }),
    );

  it('scopes an invitation to a school and a free staff record', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const { school, staff } = await schoolAndStaff(false);
    const result = await create(admin.id, {
      schoolId: school.id,
      staffMemberId: staff.id,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('refuses a staff record that is missing or already linked', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const { staff } = await schoolAndStaff(true);
    expect(await create(admin.id, { staffMemberId: randomUUID() })).toEqual({
      ok: false,
      reason: 'staff_member_not_found',
    });
    expect(await create(admin.id, { staffMemberId: staff.id })).toEqual({
      ok: false,
      reason: 'staff_member_already_linked',
    });
  });

  it("refuses inviting the actor's own address", async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    expect(await create(admin.id, { email: admin.email })).toEqual({
      ok: false,
      reason: 'email_in_use',
    });
  });

  describe('confirmInvitation', () => {
    async function twoAdminsAwaiting() {
      const tenant = randomUUID();
      await asTenant(migrator, tenant, randomUUID(), (tx) =>
        tx.tenant.create({
          data: {
            id: tenant,
            name: 'Conf',
            slug: `cf-${tenant.slice(0, 8)}`,
            kind: 'SCHOOL',
          },
        }),
      );
      const a = await makeAccount(tenant, ['admin']);
      const b = await makeAccount(tenant, ['admin']);
      const created = await inTenant(tenant, (tx) =>
        createInvitation(tx, testRules, {
          actorAccountId: a.id,
          email: `${randomUUID()}@example.invalid`,
          roles: ['admin'],
          expiresAt: LATER,
          now: NOW,
        }),
      );
      if (!created.ok) throw new Error('setup failed');
      return { tenant, a, b, invitationId: created.invitationId };
    }
    const confirm = (
      tenant: string,
      confirmerAccountId: string,
      invitationId: string,
      extra: { now?: Date; rules?: typeof testRules } = {},
    ) =>
      inTenant(tenant, (tx) =>
        confirmInvitation(tx, extra.rules ?? testRules, {
          confirmerAccountId,
          invitationId,
          now: extra.now ?? NOW,
        }),
      );

    it('refuses an unknown, revoked, expired or not-awaiting invitation', async () => {
      const { tenant, a, b, invitationId } = await twoAdminsAwaiting();
      expect(await confirm(tenant, b.id, randomUUID())).toEqual({
        ok: false,
        reason: 'invitation_not_found',
      });
      expect(
        await confirm(tenant, b.id, invitationId, { now: new Date('2027-06-01') }),
      ).toEqual({
        ok: false,
        reason: 'invitation_expired',
      });
      const plain = await inTenant(tenant, (tx) =>
        createInvitation(tx, testRules, {
          actorAccountId: a.id,
          email: `${randomUUID()}@example.invalid`,
          roles: ['teacher'],
          expiresAt: LATER,
          now: NOW,
        }),
      );
      if (!plain.ok) throw new Error('setup failed');
      expect(await confirm(tenant, b.id, plain.invitationId)).toEqual({
        ok: false,
        reason: 'not_awaiting_confirmation',
      });
      await inTenant(tenant, (tx) =>
        revokeInvitation(tx, { actorAccountId: a.id, invitationId, now: NOW }),
      );
      expect(await confirm(tenant, b.id, invitationId)).toEqual({
        ok: false,
        reason: 'invitation_not_pending',
      });
    });

    it('refuses when the proposer has since lost the administrator role', async () => {
      const { tenant, a, b, invitationId } = await twoAdminsAwaiting();
      await asTenant(migrator, tenant, randomUUID(), (tx) =>
        tx.roleAssignment.updateMany({
          where: { userAccountId: a.id, role: 'admin' },
          data: { expiresAt: NOW },
        }),
      );
      expect(await confirm(tenant, b.id, invitationId)).toEqual({
        ok: false,
        reason: 'actor_not_admin',
      });
    });

    it('refuses an invitation with no recorded proposer', async () => {
      const { tenant, b } = await twoAdminsAwaiting();
      const orphan = await asTenant(migrator, tenant, randomUUID(), (tx) =>
        tx.userInvitation.create({
          data: {
            tenantId: tenant,
            email: `${randomUUID()}@example.invalid`,
            roles: ['admin'],
            expiresAt: LATER,
            confirmation: 'AWAITING',
            createdBy: null,
          },
        }),
      );
      expect(await confirm(tenant, b.id, orphan.id)).toEqual({
        ok: false,
        reason: 'proposer_unknown',
      });
    });

    it('refuses if the rules do not report a real confirmation', async () => {
      const { tenant, b, invitationId } = await twoAdminsAwaiting();
      const lax: typeof testRules = {
        ...testRules,
        conferral: () => ({
          allowed: true,
          confirmation: 'not_required',
          confirmedBy: null,
        }),
      };
      expect(await confirm(tenant, b.id, invitationId, { rules: lax })).toEqual({
        ok: false,
        reason: 'confirmation_not_applicable',
      });
    });
  });

  it('refuses to revoke an invitation that does not exist', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    expect(
      await inTenant(TENANT_A, (tx) =>
        revokeInvitation(tx, {
          actorAccountId: admin.id,
          invitationId: randomUUID(),
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'invitation_not_found' });
  });

  it('refuses a verified but malformed address, and an address another account holds', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const email = `${randomUUID()}@example.invalid`;
    await create(admin.id, { email });
    const accept = (address: string) =>
      inTenant(TENANT_A, (tx) =>
        acceptInvitation(tx, {
          subject: `sub-${randomUUID()}`,
          email: address,
          emailVerified: true,
          displayName: 'X',
          now: NOW,
        }),
      );
    expect(await accept('not-an-address')).toEqual({
      ok: false,
      reason: 'invalid_email',
    });
    // Someone else came to hold the address after the invitation was issued.
    await makeAccount(TENANT_A, ['teacher'], email);
    expect(await accept(email)).toEqual({ ok: false, reason: 'email_in_use' });
  });

  it('falls back to the address when the provider gives no display name', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    const email = `${randomUUID()}@example.invalid`;
    await create(admin.id, { email });
    const result = await inTenant(TENANT_A, (tx) =>
      acceptInvitation(tx, {
        subject: `sub-${randomUUID()}`,
        email,
        emailVerified: true,
        displayName: '   ',
        now: NOW,
      }),
    );
    if (!result.ok || result.outcome !== 'linked') throw new Error('expected a link');
    const account = await inTenant(TENANT_A, (tx) =>
      tx.userAccount.findFirstOrThrow({ where: { id: result.accountId } }),
    );
    expect(account.displayName).toBe(email);
  });

  it('refuses to change an account that does not exist', async () => {
    const admin = await makeAccount(TENANT_A, ['admin']);
    expect(
      await inTenant(TENANT_A, (tx) =>
        setAccountStatus(tx, testRules, {
          actorAccountId: admin.id,
          targetAccountId: randomUUID(),
          status: 'SUSPENDED',
          now: NOW,
        }),
      ),
    ).toEqual({ ok: false, reason: 'target_not_found' });
  });
});

describe('without a tenant context', () => {
  it('refuses to take the provisioning lock', async () => {
    await expect(
      appRw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', '', true)`;
        await lockProvisioning(tx);
      }),
    ).rejects.toThrow(/tenant/i);
  });
});
