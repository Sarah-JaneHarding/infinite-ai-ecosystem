// The real `withTenant`, against a real database.
//
// This file exists because of a gap the coverage report exposed: `src/client.ts` sat at
// 12.8%. The isolation suite proves the *policies* work, but it drives them through
// `asTenant` in the test harness — a mirror of `withTenant`, not `withTenant` itself. So
// the one function every read and write in the system is supposed to go through (rule 5)
// had never actually been executed.
//
// A mirror that drifts from the thing it mirrors is worse than no test, because it keeps
// reporting success about code nobody runs. These cases use the exported function.

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  disconnect as Disconnect,
  withTenant as WithTenant,
} from '../src/client.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
// Imported dynamically in beforeAll, after DATABASE_URL points at the container. The
// types come from a static type-only import so the lint rule against inline `import()`
// annotations stays satisfied.
let withTenant: typeof WithTenant;
let disconnect: typeof Disconnect;

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();

  // The module builds its Prisma client lazily from DATABASE_URL on first use, so setting
  // it before the first call is enough — no module cache surgery required. Pointing it at
  // `app_rw` is deliberate: this is the role the application runs as.
  process.env['DATABASE_URL'] = db.urlFor('app_rw');
  ({ withTenant, disconnect } = await import('../src/client.js'));

  // Seed through the migrator connection, since the fixture spans two tenants and
  // withTenant deliberately cannot.
  const migrator = db.clientFor('migrator');
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await migrator.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_id', ${ACTOR}, true)`;
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: `Tenant ${tenantId.slice(0, 8)}`,
          slug: `c-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });
      await tx.school.create({
        data: { tenantId, name: 'Only Campus', lolt: 'en' },
      });
    });
  }
}, 180_000);

afterAll(async () => {
  await disconnect?.();
  await db?.stop();
});

describe('withTenant against a real database', () => {
  it('sees its own tenant', async () => {
    const schools = await withTenant({ tenantId: TENANT_A, actorId: ACTOR }, (tx) =>
      tx.school.findMany(),
    );
    expect(schools).toHaveLength(1);
    expect(schools[0]!.tenantId).toBe(TENANT_A);
  });

  it('cannot see another tenant, even asking by primary key', async () => {
    const other = await withTenant({ tenantId: TENANT_B, actorId: ACTOR }, (tx) =>
      tx.school.findFirst(),
    );
    const leak = await withTenant({ tenantId: TENANT_A, actorId: ACTOR }, (tx) =>
      tx.school.findUnique({ where: { id: other!.id } }),
    );
    expect(leak).toBeNull();
  });

  it('cannot write into another tenant', async () => {
    await expect(
      withTenant({ tenantId: TENANT_A, actorId: ACTOR }, (tx) =>
        tx.school.create({
          data: { tenantId: TENANT_B, name: 'Smuggled', lolt: 'en' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('sets the actor for the audit trail, not just the tenant', async () => {
    const rows = await withTenant(
      { tenantId: TENANT_A, actorId: ACTOR },
      (tx) =>
        tx.$queryRaw<
          { actor: string }[]
        >`SELECT current_setting('app.actor_id') AS actor`,
    );
    expect(rows[0]!.actor).toBe(ACTOR);
  });

  it('scopes the setting to the transaction, not the connection', async () => {
    // The property that makes connection pooling safe. If these leaked at session level,
    // the next caller to borrow this connection would inherit another tenant's scope —
    // the exact cross-tenant bug this layer exists to prevent.
    await withTenant({ tenantId: TENANT_A, actorId: ACTOR }, async (tx) => {
      const rows = await tx.$queryRaw<{ tenant: string }[]>`
        SELECT current_setting('app.tenant_id') AS tenant
      `;
      expect(rows[0]!.tenant).toBe(TENANT_A);
    });

    // A second call on the same pooled client must see its own tenant, not the first's.
    await withTenant({ tenantId: TENANT_B, actorId: ACTOR }, async (tx) => {
      const rows = await tx.$queryRaw<{ tenant: string }[]>`
        SELECT current_setting('app.tenant_id') AS tenant
      `;
      expect(rows[0]!.tenant).toBe(TENANT_B);
    });
  });

  it('rolls back on a thrown error, leaving no partial write', async () => {
    await expect(
      withTenant({ tenantId: TENANT_A, actorId: ACTOR }, async (tx) => {
        await tx.school.create({
          data: { tenantId: TENANT_A, name: 'Rolled Back', lolt: 'en' },
        });
        throw new Error('deliberate');
      }),
    ).rejects.toThrow('deliberate');

    const found = await withTenant({ tenantId: TENANT_A, actorId: ACTOR }, (tx) =>
      tx.school.findFirst({ where: { name: 'Rolled Back' } }),
    );
    expect(found).toBeNull();
  });

  it('returns the callback value through', async () => {
    const answer = await withTenant(
      { tenantId: TENANT_A, actorId: ACTOR },
      async () => 42,
    );
    expect(answer).toBe(42);
  });
});
