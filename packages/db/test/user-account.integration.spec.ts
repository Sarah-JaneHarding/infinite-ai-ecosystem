// Subject → account resolution against a real Postgres: that RLS limits it to the caller's own
// tenant (the same subject at two schools is two accounts), and that only an ACTIVE account
// resolves. Connects as `app_rw`; see `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { listActiveRoles } from '../src/roles.js';
import { findActiveUserAccountId, isUserAccountActive } from '../src/user-account.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();
/** The same person at two schools: one subject, two accounts. */
const SHARED_SUBJECT = randomUUID();
const SUSPENDED_SUBJECT = randomUUID();
const OFFBOARDED_SUBJECT = randomUUID();
const SUSPENDED_ACCOUNT = randomUUID();
const OFFBOARDED_ACCOUNT = randomUUID();
const ACCOUNT_A = randomUUID();
const ACCOUNT_B = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  for (const [tenantId, accountId] of [
    [TENANT_A, ACCOUNT_A],
    [TENANT_B, ACCOUNT_B],
  ] as const) {
    await asTenant(migrator, tenantId, ACTOR, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: `School ${tenantId.slice(0, 4)}`,
          slug: `acct-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });
      await tx.userAccount.create({
        data: {
          id: accountId,
          tenantId,
          subject: SHARED_SUBJECT,
          email: `shared-${tenantId.slice(0, 4)}@example.invalid`,
          displayName: 'Dev fixture',
        },
      });
    });
  }
  await asTenant(migrator, TENANT_A, ACTOR, (tx) =>
    tx.userAccount.create({
      data: {
        id: OFFBOARDED_ACCOUNT,
        tenantId: TENANT_A,
        subject: OFFBOARDED_SUBJECT,
        email: 'offboarded@example.invalid',
        displayName: 'Dev fixture',
        status: 'OFFBOARDED',
      },
    }),
  );
  await asTenant(migrator, TENANT_A, ACTOR, (tx) =>
    tx.userAccount.create({
      data: {
        id: SUSPENDED_ACCOUNT,
        tenantId: TENANT_A,
        subject: SUSPENDED_SUBJECT,
        email: 'suspended@example.invalid',
        displayName: 'Dev fixture',
        status: 'SUSPENDED',
      },
    }),
  );
  appRw = db.clientFor('app_rw');
});

afterAll(async () => {
  await db.stop();
});

const resolve = (tenantId: string, subject: string) =>
  asTenant(appRw, tenantId, ACTOR, (tx) =>
    findActiveUserAccountId(tx as TenantClient, subject),
  );

describe('findActiveUserAccountId (real Postgres)', () => {
  it('gives the same subject a different account in each tenant', async () => {
    await expect(resolve(TENANT_A, SHARED_SUBJECT)).resolves.toBe(ACCOUNT_A);
    await expect(resolve(TENANT_B, SHARED_SUBJECT)).resolves.toBe(ACCOUNT_B);
  });

  it('does not resolve a subject that has no account in the tenant', async () => {
    await expect(resolve(TENANT_A, randomUUID())).resolves.toBeNull();
    await expect(resolve(randomUUID(), SHARED_SUBJECT)).resolves.toBeNull();
  });

  it('does not resolve a suspended account', async () => {
    await expect(resolve(TENANT_A, SUSPENDED_SUBJECT)).resolves.toBeNull();
  });
});

describe('listActiveRoles (real Postgres)', () => {
  const NOW = new Date('2026-11-12T08:00:00.000Z');
  const roles = (tenantId: string, accountId: string) =>
    asTenant(appRw, tenantId, ACTOR, (tx) =>
      listActiveRoles(tx as TenantClient, accountId, NOW),
    );
  const assign = (
    tenantId: string,
    userAccountId: string,
    role: string,
    expiresAt: Date | null,
  ) =>
    asTenant(migrator, tenantId, ACTOR, (tx) =>
      tx.roleAssignment.create({ data: { tenantId, userAccountId, role, expiresAt } }),
    );

  it('lists live roles — no expiry, or an expiry after now — sorted, each once', async () => {
    await assign(TENANT_A, ACCOUNT_A, 'teacher', null);
    await assign(TENANT_A, ACCOUNT_A, 'hod', new Date('2099-01-01T00:00:00.000Z'));
    await assign(TENANT_A, ACCOUNT_A, 'hod', null); // a second assignment of the same role
    await expect(roles(TENANT_A, ACCOUNT_A)).resolves.toEqual(['hod', 'teacher']);
  });

  it('leaves out a role whose assignment has expired, including one expiring exactly now', async () => {
    await assign(TENANT_A, ACCOUNT_A, 'sbst', new Date('2026-01-01T00:00:00.000Z'));
    await assign(TENANT_A, ACCOUNT_A, 'smt', NOW);
    await expect(roles(TENANT_A, ACCOUNT_A)).resolves.toEqual(['hod', 'teacher']);
  });

  it('is empty for an account with no assignments, and for one that does not exist', async () => {
    await expect(roles(TENANT_B, ACCOUNT_B)).resolves.toEqual([]);
    await expect(roles(TENANT_A, randomUUID())).resolves.toEqual([]);
  });

  it("cannot see another school's account: its roles are invisible from this school", async () => {
    await assign(TENANT_B, ACCOUNT_B, 'admin', null);
    await expect(roles(TENANT_B, ACCOUNT_B)).resolves.toEqual(['admin']);
    await expect(roles(TENANT_A, ACCOUNT_B)).resolves.toEqual([]);
  });
});

describe('isUserAccountActive (real Postgres)', () => {
  const active = (tenantId: string, accountId: string) =>
    asTenant(appRw, tenantId, ACTOR, (tx) =>
      isUserAccountActive(tx as TenantClient, accountId),
    );

  it('is true for an ACTIVE account in the caller’s own school', async () => {
    await expect(active(TENANT_A, ACCOUNT_A)).resolves.toBe(true);
    await expect(active(TENANT_B, ACCOUNT_B)).resolves.toBe(true);
  });

  it('is false for a suspended account and for an offboarded one', async () => {
    await expect(active(TENANT_A, SUSPENDED_ACCOUNT)).resolves.toBe(false);
    await expect(active(TENANT_A, OFFBOARDED_ACCOUNT)).resolves.toBe(false);
  });

  it('is false for an account that does not exist', async () => {
    await expect(active(TENANT_A, randomUUID())).resolves.toBe(false);
  });

  it('is false for another school’s ACTIVE account — RLS hides it', async () => {
    await expect(active(TENANT_A, ACCOUNT_B)).resolves.toBe(false);
    await expect(active(TENANT_B, ACCOUNT_A)).resolves.toBe(false);
  });
});
