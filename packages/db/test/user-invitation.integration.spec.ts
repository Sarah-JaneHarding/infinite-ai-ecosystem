// The invitation table against a real Postgres (OQ-033 step 1). The generic isolation suite
// (rls.integration.spec.ts) already covers it as a tenant-owned table; this adds what is
// specific to it: that the data layer itself holds the constraints the design relies on —
// no platform role can ever be invited, an address is exact, one live invitation per address,
// acceptance is all-or-nothing — and that one school cannot see or write another's.
//
// Connects as `app_rw` (DML only, RLS enforced) and `worker_rw`; see `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let workerRw: PrismaClient;
let migrator: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  workerRw = db.clientFor('worker_rw');
  for (const id of [TENANT_A, TENANT_B]) {
    await asTenant(migrator, id, ACTOR, (tx) =>
      tx.tenant.create({
        data: {
          id,
          name: `School ${id.slice(0, 4)}`,
          slug: `inv-${id.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );
  }
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

const invite = (
  tenantId: string,
  data: {
    email?: string;
    roles?: string[];
    status?: 'PENDING' | 'REVOKED' | 'EXPIRED';
  } = {},
) =>
  asTenant(appRw, tenantId, ACTOR, (tx) =>
    tx.userInvitation.create({
      data: {
        tenantId,
        email: data.email ?? `${randomUUID()}@example.invalid`,
        roles: data.roles ?? ['teacher'],
        status: data.status ?? 'PENDING',
        expiresAt: FUTURE,
      },
    }),
  );

describe('user_invitation: what the data layer refuses', () => {
  it.each([
    ['a platform_admin role', ['platform_admin']],
    ['a platform_support role', ['platform_support']],
    ['a guardian role (needs its own design)', ['guardian']],
    ['a learner role (needs its own design)', ['learner']],
    ['an unknown role', ['superuser']],
    ['a valid role mixed with a platform role', ['teacher', 'platform_admin']],
    ['no roles at all', []],
  ])('refuses an invitation carrying %s', async (_what, roles) => {
    await expect(invite(TENANT_A, { roles })).rejects.toThrow(
      /user_invitation_roles_school_staff/,
    );
  });

  it('accepts each school staff role, alone and together', async () => {
    for (const roles of [
      ['teacher'],
      ['hod'],
      ['smt'],
      ['sbst'],
      ['admin'],
      ['hod', 'teacher'],
    ]) {
      await expect(invite(TENANT_A, { roles })).resolves.toMatchObject({ roles });
    }
  });

  it.each([
    ['upper-case letters', 'Ada@Example.invalid'],
    ['surrounding whitespace', ' ada@example.invalid '],
    ['no @', 'ada.example.invalid'],
    ['an empty address', ''],
    ['an @ in first position', '@example.invalid'],
  ])(
    'refuses an address with %s — matching is exact after normalisation',
    async (_what, email) => {
      await expect(invite(TENANT_A, { email })).rejects.toThrow(
        /user_invitation_email_normalised/,
      );
    },
  );

  it('allows one PENDING invitation per address, and only one', async () => {
    const email = `dup-${randomUUID()}@example.invalid`;
    await invite(TENANT_A, { email });
    await expect(invite(TENANT_A, { email })).rejects.toThrow(
      /user_invitation_pending_email_key/,
    );
  });

  it('lets a revoked or expired address be invited again', async () => {
    const email = `again-${randomUUID()}@example.invalid`;
    await invite(TENANT_A, { email, status: 'REVOKED' });
    await invite(TENANT_A, { email, status: 'EXPIRED' });
    await expect(invite(TENANT_A, { email })).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('lets two schools invite the same address independently', async () => {
    const email = `both-${randomUUID()}@example.invalid`;
    await invite(TENANT_A, { email });
    await expect(invite(TENANT_B, { email })).resolves.toMatchObject({
      tenantId: TENANT_B,
    });
  });

  it('refuses ACCEPTED without an acceptance time and account, and the reverse', async () => {
    const base = {
      email: `acc-${randomUUID()}@example.invalid`,
      roles: ['teacher'],
      expiresAt: FUTURE,
    };
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        tx.userInvitation.create({
          data: { tenantId: TENANT_A, ...base, status: 'ACCEPTED' },
        }),
      ),
    ).rejects.toThrow(/user_invitation_accepted_consistent/);
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        tx.userInvitation.create({
          data: {
            tenantId: TENANT_A,
            ...base,
            status: 'PENDING',
            acceptedAt: new Date(),
          },
        }),
      ),
    ).rejects.toThrow(/user_invitation_accepted_consistent/);
  });

  it('accepts a consistent ACCEPTED invitation, and links an account to at most one', async () => {
    const account = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.userAccount.create({
        data: {
          tenantId: TENANT_A,
          subject: `oidc-${randomUUID()}`,
          email: `acct-${randomUUID()}@example.invalid`,
          displayName: 'Invitee',
        },
      }),
    );
    const accepted = (email: string) =>
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        tx.userInvitation.create({
          data: {
            tenantId: TENANT_A,
            email,
            roles: ['teacher'],
            expiresAt: FUTURE,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            acceptedAccountId: account.id,
          },
        }),
      );
    await expect(accepted(`one-${randomUUID()}@example.invalid`)).resolves.toMatchObject({
      status: 'ACCEPTED',
    });
    await expect(accepted(`two-${randomUUID()}@example.invalid`)).rejects.toThrow(
      /accepted_account_id/,
    );
  });
});

describe('user_invitation: one school cannot reach another’s', () => {
  it('does not show tenant B’s invitations to tenant A', async () => {
    const email = `iso-${randomUUID()}@example.invalid`;
    await invite(TENANT_B, { email });
    const seenByA = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.userInvitation.findMany({ where: { email } }),
    );
    expect(seenByA).toHaveLength(0);
    const seenByB = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.userInvitation.findMany({ where: { email } }),
    );
    expect(seenByB).toHaveLength(1);
  });

  it('refuses to write an invitation for another tenant while in this one’s context', async () => {
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        tx.userInvitation.create({
          data: {
            tenantId: TENANT_B,
            email: `cross-${randomUUID()}@example.invalid`,
            roles: ['teacher'],
            expiresAt: FUTURE,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('cannot revoke another school’s invitation', async () => {
    const created = await invite(TENANT_B);
    const affected = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.userInvitation.updateMany({
        where: { id: created.id },
        data: { status: 'REVOKED' },
      }),
    );
    expect(affected.count).toBe(0);
  });

  it('is unreadable without any tenant context — an error, not an empty list', async () => {
    await expect(workerRw.$queryRaw`SELECT id FROM "user_invitation"`).rejects.toThrow();
  });
});
