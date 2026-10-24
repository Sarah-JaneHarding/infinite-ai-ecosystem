// Subject → account resolution against a real Postgres: that RLS limits it to the caller's own
// tenant (the same subject at two schools is two accounts), and that only an ACTIVE account
// resolves. Connects as `app_rw`; see `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { findActiveUserAccountId } from '../src/user-account.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();
/** The same person at two schools: one subject, two accounts. */
const SHARED_SUBJECT = randomUUID();
const SUSPENDED_SUBJECT = randomUUID();
const ACCOUNT_A = randomUUID();
const ACCOUNT_B = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  const migrator = db.clientFor('migrator');
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
