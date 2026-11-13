// Rule 10: a schema change needs a forward migration AND a tested rollback. This applies the real
// rollback script for the identity-provider sync state (OQ-033 step 7c) to a real database with real
// rows in it: it must REFUSE while any row has left the default, succeed once none has, and be
// repeatable by re-applying the forward migration.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

const dir = join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20261113100000_oq033_idp_sync_state',
);
let db: TestDatabase;
let migrator: PrismaClient;
const TENANT = randomUUID();
const ACTOR = randomUUID();
let accountId = '';
let invitationId = '';

/** Runs a SQL file as `migrator` through psql in the container, returning the exit code and output. */
async function runSql(file: string): Promise<{ exitCode: number; output: string }> {
  const sql = readFileSync(join(dir, file), 'utf8');
  const password = new URL(db.urlFor('migrator')).password;
  return db.container.exec([
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
}

const idpColumns = async (): Promise<number> => {
  const rows = await migrator.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.columns
    WHERE column_name LIKE 'idp\\_%' AND table_name IN ('user_invitation', 'user_account')`;
  return Number(rows[0]?.n ?? 0);
};
const typeExists = async (): Promise<boolean> => {
  const rows = await migrator.$queryRaw<{ found: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'idp_state') AS found`;
  return rows[0]?.found === true;
};
const leftoverGuards = async (): Promise<number> => {
  const rows = await migrator.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_constraint WHERE conname LIKE '%\\_idp\\_unused'`;
  return Number(rows[0]?.n ?? 0);
};

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  await asTenant(migrator, TENANT, ACTOR, async (tx) => {
    await tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Rollback School',
        slug: `idp-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
    const account = await tx.userAccount.create({
      data: {
        tenantId: TENANT,
        subject: `sub-${randomUUID()}`,
        email: 'a@example.invalid',
        displayName: 'A',
        idpState: 'SYNCED',
      },
    });
    accountId = account.id;
    const invitation = await tx.userInvitation.create({
      data: {
        tenantId: TENANT,
        email: 'invitee@example.invalid',
        roles: ['teacher'],
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
    invitationId = invitation.id;
  });
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

describe('idp sync state rollback', () => {
  it('starts with the five columns and the type in place', async () => {
    expect(await idpColumns()).toBe(5);
    expect(await typeExists()).toBe(true);
  });

  it('refuses while a managed account exists, and leaves the schema exactly as it was', async () => {
    const result = await runSql('rollback.sql');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('violated by some row');
    expect(await idpColumns()).toBe(5);
    expect(await typeExists()).toBe(true);
    expect(await leftoverGuards()).toBe(0); // the temporary guard rolled back with the rest
  });

  it('also refuses while an invitation carries a sync state', async () => {
    await asTenant(migrator, TENANT, ACTOR, async (tx) => {
      await tx.userAccount.update({
        where: { id: accountId },
        data: { idpState: 'NOT_MANAGED' },
      });
      await tx.userInvitation.update({
        where: { id: invitationId },
        data: { idpState: 'PENDING' },
      });
    });
    const result = await runSql('rollback.sql');
    expect(result.exitCode).not.toBe(0);
    expect(await idpColumns()).toBe(5);
  });

  it('rolls back once nothing uses it, keeping every row', async () => {
    await asTenant(migrator, TENANT, ACTOR, (tx) =>
      tx.userInvitation.update({
        where: { id: invitationId },
        data: { idpState: 'NOT_MANAGED' },
      }),
    );
    const result = await runSql('rollback.sql');
    expect(result.exitCode, result.output).toBe(0);
    expect(await idpColumns()).toBe(0);
    expect(await typeExists()).toBe(false);
    const kept = await asTenant(migrator, TENANT, ACTOR, async (tx) => ({
      accounts: await tx.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*) AS n FROM user_account`,
      invitations: await tx.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*) AS n FROM user_invitation`,
    }));
    expect(Number(kept.accounts[0]?.n)).toBe(1);
    expect(Number(kept.invitations[0]?.n)).toBe(1);
  });

  it('re-applies cleanly, and existing rows come back unmanaged', async () => {
    const result = await runSql('migration.sql');
    expect(result.exitCode, result.output).toBe(0);
    expect(await idpColumns()).toBe(5);
    const rows = await asTenant(
      migrator,
      TENANT,
      ACTOR,
      (tx) =>
        tx.$queryRaw<{ idp_state: string }[]>`SELECT idp_state::text FROM user_account`,
    );
    expect(rows.map((r) => r.idp_state)).toEqual(['NOT_MANAGED']);
  });
});
