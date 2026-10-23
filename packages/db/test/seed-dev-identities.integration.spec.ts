// The dev identity seed, against a real Postgres: idempotent, and each seeded subject resolves
// to its account through the production lookup — the path sign-in takes (OQ-033).

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEV_IDENTITIES, DEV_TENANT_ID } from '../prisma/dev-identities.js';
import { seedDevIdentities } from '../prisma/seed-dev-identities.js';
import { findActiveUserAccountId, hasActiveRoleAssignment } from '../src/index.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let migrator: PrismaClient;
let appRw: PrismaClient;
const ACTOR = '00000000-0000-4000-8000-00000000f00d';

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, DEV_TENANT_ID, ACTOR, (tx) =>
    tx.tenant.create({
      data: { id: DEV_TENANT_ID, name: 'Seed small', slug: 'small', kind: 'SCHOOL' },
    }),
  );
  await seedDevIdentities(migrator);
});

afterAll(async () => {
  await db.stop();
});

const countAccounts = () =>
  asTenant(appRw, DEV_TENANT_ID, ACTOR, (tx) => tx.userAccount.count());

describe('seedDevIdentities (real Postgres)', () => {
  it('resolves every seeded subject to its account, and the account holds its role', async () => {
    for (const who of DEV_IDENTITIES) {
      const resolved = await asTenant(appRw, DEV_TENANT_ID, ACTOR, (tx) =>
        findActiveUserAccountId(tx as never, who.subject),
      );
      expect(resolved).toBe(who.accountId);
      const holds = await asTenant(appRw, DEV_TENANT_ID, ACTOR, (tx) =>
        hasActiveRoleAssignment(tx as never, who.accountId, who.role, new Date()),
      );
      expect(holds).toBe(true);
    }
  });

  it('does not let one account act in another role', async () => {
    const teacher = DEV_IDENTITIES.find((w) => w.role === 'teacher');
    if (teacher === undefined) throw new Error('fixture missing');
    const holdsSmt = await asTenant(appRw, DEV_TENANT_ID, ACTOR, (tx) =>
      hasActiveRoleAssignment(tx as never, teacher.accountId, 'smt', new Date()),
    );
    expect(holdsSmt).toBe(false);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const before = await countAccounts();
    await seedDevIdentities(migrator);
    expect(await countAccounts()).toBe(before);
    expect(before).toBe(DEV_IDENTITIES.length);
  });
});
