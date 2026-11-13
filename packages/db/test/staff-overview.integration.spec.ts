// The administrator's staff overview against a real Postgres: only the caller's own school, pending
// invitations and requests only, lapsed roles flagged rather than hidden, and a stable order.
// Connects as `app_rw`; see `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { loadStaffOverview } from '../src/staff-overview.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-11-12T08:00:00.000Z');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');
const ZOE = randomUUID();
const ADA = randomUUID();
const BEN = randomUUID();
const OTHER_SCHOOL_PERSON = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await asTenant(migrator, tenantId, ACTOR, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: `School ${tenantId.slice(0, 4)}`,
          slug: `staff-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
  }
  const account = (id: string, tenantId: string, name: string, status = 'ACTIVE') => ({
    id,
    tenantId,
    subject: randomUUID(),
    email: `${name.toLowerCase().replace(/\W/g, '')}-${id.slice(0, 4)}@example.invalid`,
    displayName: name,
    status: status as 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED',
  });
  await asTenant(migrator, TENANT_A, ACTOR, async (tx) => {
    // Created out of name order on purpose.
    await tx.userAccount.create({ data: account(ZOE, TENANT_A, 'Zoe Zulu') });
    await tx.userAccount.create({ data: account(ADA, TENANT_A, 'Ada Abrahams') });
    await tx.userAccount.create({
      data: account(BEN, TENANT_A, 'Ben Botha', 'SUSPENDED'),
    });
    const grant = (userAccountId: string, role: string, expiresAt: Date | null) =>
      tx.roleAssignment.create({
        data: { tenantId: TENANT_A, userAccountId, role, expiresAt },
      });
    await grant(ADA, 'teacher', null);
    await grant(ADA, 'hod', FUTURE);
    await grant(ADA, 'admin', PAST); // lapsed
    await grant(BEN, 'sbst', null);

    const invite = (email: string, status: 'PENDING' | 'REVOKED', expiresAt: Date) =>
      tx.userInvitation.create({
        data: {
          tenantId: TENANT_A,
          email,
          roles: ['teacher', 'hod'],
          status,
          expiresAt,
        },
      });
    await invite('later@example.invalid', 'PENDING', FUTURE);
    await invite('lapsed@example.invalid', 'PENDING', PAST);
    await invite('revoked@example.invalid', 'REVOKED', FUTURE);

    await tx.roleGrantRequest.create({
      data: {
        tenantId: TENANT_A,
        targetAccountId: ZOE,
        roles: ['smt', 'admin'],
        requestedBy: ADA,
        status: 'PENDING',
        expiresAt: FUTURE,
      },
    });
    await tx.roleGrantRequest.create({
      data: {
        tenantId: TENANT_A,
        targetAccountId: ZOE,
        roles: ['smt'],
        requestedBy: ADA,
        status: 'CANCELLED',
        decidedBy: ADA,
        decidedAt: PAST,
        expiresAt: FUTURE,
      },
    });
  });
  await asTenant(migrator, TENANT_B, ACTOR, async (tx) => {
    await tx.userAccount.create({
      data: account(OTHER_SCHOOL_PERSON, TENANT_B, 'Other School Person'),
    });
    await tx.userInvitation.create({
      data: {
        tenantId: TENANT_B,
        email: 'b-only@example.invalid',
        roles: ['teacher'],
        expiresAt: FUTURE,
      },
    });
  });
  appRw = db.clientFor('app_rw');
});

afterAll(async () => {
  await db.stop();
});

const overview = (tenantId: string) =>
  asTenant(appRw, tenantId, ACTOR, (tx) => loadStaffOverview(tx as TenantClient, NOW));

describe('loadStaffOverview (real Postgres)', () => {
  it('lists the school’s accounts by name, with their roles sorted and each flagged if lapsed', async () => {
    const { accounts } = await overview(TENANT_A);
    expect(accounts.map((a) => a.displayName)).toEqual([
      'Ada Abrahams',
      'Ben Botha',
      'Zoe Zulu',
    ]);
    const ada = accounts.find((a) => a.id === ADA);
    expect(ada?.roles.map((r) => [r.role, r.expired])).toEqual([
      ['admin', true],
      ['hod', false],
      ['teacher', false],
    ]);
    expect(accounts.find((a) => a.id === BEN)?.status).toBe('SUSPENDED');
    expect(accounts.find((a) => a.id === ZOE)?.roles).toEqual([]);
  });

  it('lists only pending invitations, flagging one past its expiry', async () => {
    const { invitations } = await overview(TENANT_A);
    expect(invitations.map((i) => [i.email, i.expired])).toEqual([
      ['lapsed@example.invalid', true],
      ['later@example.invalid', false],
    ]);
    expect(invitations[0]?.roles).toEqual(['hod', 'teacher']);
  });

  it('lists only pending role-grant requests', async () => {
    const { grantRequests } = await overview(TENANT_A);
    expect(grantRequests).toHaveLength(1);
    expect(grantRequests[0]).toMatchObject({
      targetAccountId: ZOE,
      requestedBy: ADA,
      roles: ['admin', 'smt'],
      expired: false,
    });
  });

  it('shows another school nothing of this one, and this one nothing of another', async () => {
    const b = await overview(TENANT_B);
    expect(b.accounts.map((a) => a.id)).toEqual([OTHER_SCHOOL_PERSON]);
    expect(b.invitations.map((i) => i.email)).toEqual(['b-only@example.invalid']);
    expect(b.grantRequests).toEqual([]);
    const a = await overview(TENANT_A);
    expect(a.accounts.map((x) => x.id)).not.toContain(OTHER_SCHOOL_PERSON);
    expect(a.invitations.map((i) => i.email)).not.toContain('b-only@example.invalid');
  });

  it('is empty, not an error, for a school with no staff yet', async () => {
    const empty = await overview(randomUUID());
    expect(empty).toEqual({
      schools: [],
      idp: { pending: 0, failed: 0 },
      accounts: [],
      invitations: [],
      grantRequests: [],
      truncated: false,
    });
  });

  it('lists the school’s own schools by name, and none of another tenant’s', async () => {
    const own = await asTenant(migrator, TENANT_A, ACTOR, async (tx) => {
      await tx.school.create({
        data: { tenantId: TENANT_A, name: 'Zulu Primary', lolt: 'English' },
      });
      return tx.school.create({
        data: { tenantId: TENANT_A, name: 'Alpha Primary', lolt: 'English' },
      });
    });
    await asTenant(migrator, TENANT_B, ACTOR, (tx) =>
      tx.school.create({
        data: { tenantId: TENANT_B, name: 'Foreign Primary', lolt: 'English' },
      }),
    );
    const a = await overview(TENANT_A);
    expect(a.schools.map((s) => s.name)).toEqual(['Alpha Primary', 'Zulu Primary']);
    expect(a.schools.map((s) => s.id)).toContain(own.id);
    expect(a.schools.map((s) => s.name)).not.toContain('Foreign Primary');
    expect((await overview(TENANT_B)).schools.map((s) => s.name)).toEqual([
      'Foreign Primary',
    ]);
  });

  it('reports the school a role or an invitation is scoped to', async () => {
    const school = await asTenant(migrator, TENANT_A, ACTOR, (tx) =>
      tx.school.findFirstOrThrow({ where: { name: 'Alpha Primary' } }),
    );
    await asTenant(migrator, TENANT_A, ACTOR, async (tx) => {
      await tx.roleAssignment.create({
        data: {
          tenantId: TENANT_A,
          userAccountId: BEN,
          role: 'hod',
          schoolId: school.id,
        },
      });
      await tx.userInvitation.create({
        data: {
          tenantId: TENANT_A,
          email: 'scoped@example.invalid',
          roles: ['teacher'],
          schoolId: school.id,
          expiresAt: FUTURE,
        },
      });
    });
    const a = await overview(TENANT_A);
    expect(
      a.accounts.find((x) => x.id === BEN)?.roles.find((r) => r.role === 'hod')?.schoolId,
    ).toBe(school.id);
    expect(
      a.accounts.find((x) => x.id === BEN)?.roles.find((r) => r.role === 'sbst')
        ?.schoolId,
    ).toBeNull();
    expect(
      a.invitations.find((i) => i.email === 'scoped@example.invalid')?.schoolId,
    ).toBe(school.id);
  });

  it('does not report truncation for a small school', async () => {
    expect((await overview(TENANT_A)).truncated).toBe(false);
  });
});
