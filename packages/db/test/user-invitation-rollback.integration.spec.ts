// Rule 10: a schema change needs a forward migration AND a tested rollback. This applies the
// real rollback script to a real database (with a real invitation in it), checks that only
// the invitation objects went and nothing else, then re-applies the forward migrations to
// show the pair is repeatable.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
const FORWARD = [
  '20261024090000_oq033_user_invitation/migration.sql',
  '20261024090100_oq033_user_invitation_rls/migration.sql',
];
const ROLLBACK = '20261024090000_oq033_user_invitation/rollback.sql';

let db: TestDatabase;
let migrator: PrismaClient;
const TENANT = randomUUID();
const ACTOR = randomUUID();

/** Runs a SQL file as `migrator` through psql inside the container (multi-statement). */
async function runSql(file: string): Promise<void> {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  // The per-run password comes from the connection URL, so it is never written down here.
  const password = new URL(db.urlFor('migrator')).password;
  const result = await db.container.exec([
    'env',
    `PGPASSWORD=${password}`,
    'psql',
    '-h',
    '127.0.0.1',
    '-U',
    'migrator',
    '-d',
    db.container.getDatabase(),
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);
  expect(result.exitCode, `${file}: ${result.output}`).toBe(0);
}

const exists = async (relation: string): Promise<boolean> => {
  const rows = await migrator.$queryRaw<{ found: boolean }[]>`
    SELECT to_regclass(${`public."${relation}"`}) IS NOT NULL AS found`;
  return rows[0]?.found === true;
};

const typeExists = async (name: string): Promise<boolean> => {
  const rows = await migrator.$queryRaw<{ found: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = ${name}) AS found`;
  return rows[0]?.found === true;
};

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  await asTenant(migrator, TENANT, ACTOR, async (tx) => {
    await tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Rollback School',
        slug: `rb-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
    await tx.userInvitation.create({
      data: {
        tenantId: TENANT,
        email: 'invitee@example.invalid',
        roles: ['teacher'],
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
  });
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

describe('user_invitation rollback', () => {
  it('starts with the table and its enum in place', async () => {
    expect(await exists('user_invitation')).toBe(true);
    expect(await typeExists('user_invitation_status')).toBe(true);
  });

  it('removes only the invitation objects, leaving every other table and row alone', async () => {
    await runSql(ROLLBACK);
    expect(await exists('user_invitation')).toBe(false);
    expect(await typeExists('user_invitation_status')).toBe(false);
    for (const table of [
      'tenant',
      'school',
      'staff_member',
      'user_account',
      'role_assignment',
    ]) {
      expect(await exists(table), `${table} must survive the rollback`).toBe(true);
    }
    const tenants = await asTenant(migrator, TENANT, ACTOR, (tx) => tx.tenant.count());
    expect(tenants).toBe(1);
  });

  it('can be applied again after a rollback, restoring RLS and the constraints', async () => {
    for (const file of FORWARD) await runSql(file);
    expect(await exists('user_invitation')).toBe(true);
    const flags = await migrator.$queryRaw<{ enabled: boolean; forced: boolean }[]>`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE oid = to_regclass('public."user_invitation"')`;
    expect(flags[0]).toEqual({ enabled: true, forced: true });
    const policies = await migrator.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE tablename = 'user_invitation'`;
    expect(policies.map((p) => p.policyname)).toEqual(['tenant_isolation']);
  });
});
