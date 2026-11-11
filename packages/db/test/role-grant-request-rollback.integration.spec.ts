// Rule 10: a schema change needs a forward migration AND a tested rollback. This applies the real
// rollback script to a real database holding a real request, checks that only the request objects
// went (and the roles an applied request already granted stayed), then re-applies the forward
// migrations to show the pair is repeatable.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
const FORWARD = [
  '20261111100000_oq033_role_grant_request/migration.sql',
  '20261111100100_oq033_role_grant_request_rls/migration.sql',
];
const ROLLBACK = '20261111100000_oq033_role_grant_request/rollback.sql';

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
        name: 'Rollback Grants',
        slug: `rbg-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
    const [proposer, decider, target] = await Promise.all(
      ['proposer', 'decider', 'target'].map((name) =>
        tx.userAccount.create({
          data: {
            tenantId: TENANT,
            subject: `sub-${randomUUID()}`,
            email: `${name}@example.invalid`,
            displayName: name,
          },
        }),
      ),
    );
    if (proposer === undefined || decider === undefined || target === undefined) {
      throw new Error('setup: accounts not created');
    }
    // A request that has already been applied, and the role it granted.
    await tx.roleGrantRequest.create({
      data: {
        tenantId: TENANT,
        targetAccountId: target.id,
        roles: ['smt'],
        requestedBy: proposer.id,
        status: 'APPLIED',
        decidedBy: decider.id,
        decidedAt: new Date('2026-11-11T08:00:00.000Z'),
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
    await tx.roleAssignment.create({
      data: { tenantId: TENANT, userAccountId: target.id, role: 'smt' },
    });
  });
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

describe('role_grant_request rollback', () => {
  it('starts with the table and its enum in place', async () => {
    expect(await exists('role_grant_request')).toBe(true);
    expect(await typeExists('role_grant_request_status')).toBe(true);
  });

  it('removes only the request objects, leaving every other table and the granted role alone', async () => {
    await runSql(ROLLBACK);
    expect(await exists('role_grant_request')).toBe(false);
    expect(await typeExists('role_grant_request_status')).toBe(false);
    for (const table of [
      'tenant',
      'school',
      'user_account',
      'role_assignment',
      'user_invitation',
    ]) {
      expect(await exists(table), `${table} must survive the rollback`).toBe(true);
    }
    const kept = await asTenant(migrator, TENANT, ACTOR, async (tx) => ({
      accounts: await tx.userAccount.count(),
      grantedRole: await tx.roleAssignment.count({ where: { role: 'smt' } }),
    }));
    expect(kept).toEqual({ accounts: 3, grantedRole: 1 });
  });

  it('can be applied again after a rollback, restoring RLS and the constraints', async () => {
    for (const file of FORWARD) await runSql(file);
    expect(await exists('role_grant_request')).toBe(true);
    const flags = await migrator.$queryRaw<{ enabled: boolean; forced: boolean }[]>`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE oid = to_regclass('public."role_grant_request"')`;
    expect(flags[0]).toEqual({ enabled: true, forced: true });
    const policies = await migrator.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE tablename = 'role_grant_request'`;
    expect(policies.map((p) => p.policyname)).toEqual(['tenant_isolation']);
    const constraints = await migrator.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = to_regclass('public."role_grant_request"') AND contype = 'c'
      ORDER BY conname`;
    expect(constraints.map((c) => c.conname)).toEqual([
      'role_grant_request_decision_consistent',
      'role_grant_request_not_self',
      'role_grant_request_roles_sensitive',
      'role_grant_request_two_person',
    ]);
  });
});
