// The tenant name read, against a real Postgres: that RLS — not an argument — is what limits
// it to the caller's own school. Connects as `app_rw`; see `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { readTenantName } from '../src/tenant-name.js';
import { isTenantActive } from '../src/tenant-status.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  for (const [id, name] of [
    [TENANT_A, 'Sunridge Primary'],
    [TENANT_B, 'Hillcrest Primary'],
  ] as const) {
    await asTenant(migrator, id, ACTOR, (tx) =>
      tx.tenant.create({
        data: { id, name, slug: `name-${id.slice(0, 8)}`, kind: 'SCHOOL' },
      }),
    );
  }
  appRw = db.clientFor('app_rw');
});

afterAll(async () => {
  await db.stop();
});

describe('readTenantName (real Postgres)', () => {
  it('returns each tenant its own name and never the other tenant’s', async () => {
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) => readTenantName(tx as TenantClient)),
    ).resolves.toBe('Sunridge Primary');
    await expect(
      asTenant(appRw, TENANT_B, ACTOR, (tx) => readTenantName(tx as TenantClient)),
    ).resolves.toBe('Hillcrest Primary');
  });

  it('returns null for a tenant context that has no tenant row', async () => {
    await expect(
      asTenant(appRw, randomUUID(), ACTOR, (tx) => readTenantName(tx as TenantClient)),
    ).resolves.toBeNull();
  });
});

describe('isTenantActive (real Postgres)', () => {
  const active = (tenantId: string) =>
    asTenant(appRw, tenantId, ACTOR, (tx) => isTenantActive(tx as TenantClient));

  it('is true for an ACTIVE tenant', async () => {
    await expect(active(TENANT_A)).resolves.toBe(true);
  });

  it('is false once the tenant is SUSPENDED or CLOSED, and only for that tenant', async () => {
    await asTenant(migrator, TENANT_A, ACTOR, (tx) =>
      tx.tenant.update({ where: { id: TENANT_A }, data: { status: 'SUSPENDED' } }),
    );
    await expect(active(TENANT_A)).resolves.toBe(false);
    await expect(active(TENANT_B)).resolves.toBe(true); // another school is unaffected
    await asTenant(migrator, TENANT_A, ACTOR, (tx) =>
      tx.tenant.update({ where: { id: TENANT_A }, data: { status: 'CLOSED' } }),
    );
    await expect(active(TENANT_A)).resolves.toBe(false);
  });

  it('is false for a context that has no tenant row', async () => {
    await expect(active(randomUUID())).resolves.toBe(false);
  });
});
