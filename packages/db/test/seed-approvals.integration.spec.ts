// The dev approval-gate seed, against a real Postgres: it must be idempotent, and the gates
// it opens must respect tenant isolation like any other row.

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  APPROVAL_FIXTURES,
  LARGE_PRIMARY,
  SMALL_PRIMARY,
} from '../prisma/approval-fixtures.js';
import { seedApprovals } from '../prisma/seed-approvals.js';
import { listPendingApprovalTasks } from '../src/index.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let migrator: PrismaClient;
let appRw: PrismaClient;
const ACTOR = '00000000-0000-4000-8000-00000000f00d';

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  for (const [id, slug] of [
    [SMALL_PRIMARY, 'small'],
    [LARGE_PRIMARY, 'large'],
  ] as const) {
    await asTenant(migrator, id, ACTOR, (tx) =>
      tx.tenant.create({ data: { id, name: `Seed ${slug}`, slug, kind: 'SCHOOL' } }),
    );
  }
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

const counts = async () => ({
  small: await asTenant(appRw, SMALL_PRIMARY, ACTOR, (tx) =>
    Promise.all([tx.approvalTask.count(), tx.orchestratorRun.count()]),
  ),
  large: await asTenant(appRw, LARGE_PRIMARY, ACTOR, (tx) =>
    Promise.all([tx.approvalTask.count(), tx.orchestratorRun.count()]),
  ),
});

describe('seedApprovals', () => {
  it('opens every fixture gate, and a second run changes nothing', async () => {
    expect(await seedApprovals(migrator)).toBe(APPROVAL_FIXTURES.length);
    const first = await counts();
    expect(first.small[0] + first.large[0]).toBe(APPROVAL_FIXTURES.length);
    expect(first.small[1] + first.large[1]).toBe(APPROVAL_FIXTURES.length);

    await seedApprovals(migrator);
    expect(await counts()).toEqual(first);
  });

  it("shows each tenant only its own gates, and never the other tenant's", async () => {
    const small = await asTenant(appRw, SMALL_PRIMARY, ACTOR, (tx) =>
      listPendingApprovalTasks(tx),
    );
    const large = await asTenant(appRw, LARGE_PRIMARY, ACTOR, (tx) =>
      listPendingApprovalTasks(tx),
    );
    const ids = (tenant: string) =>
      APPROVAL_FIXTURES.filter((f) => f.tenantId === tenant).map((f) => f.taskId);
    expect(small.map((t) => t.id).sort()).toEqual(ids(SMALL_PRIMARY).sort());
    expect(large.map((t) => t.id).sort()).toEqual(ids(LARGE_PRIMARY).sort());
    expect(small.every((t) => t.tenantId === SMALL_PRIMARY)).toBe(true);
  });

  it('stores the placeholder artefact exactly, with a null diff where there is none', async () => {
    const small = await asTenant(appRw, SMALL_PRIMARY, ACTOR, (tx) =>
      listPendingApprovalTasks(tx),
    );
    const withDiff = APPROVAL_FIXTURES.find((f) => f.diffAgainstPrevious !== null);
    const without = APPROVAL_FIXTURES.find(
      (f) => f.tenantId === SMALL_PRIMARY && f.diffAgainstPrevious === null,
    );
    expect(small.find((t) => t.id === withDiff?.taskId)?.diffAgainstPrevious).toEqual(
      withDiff?.diffAgainstPrevious,
    );
    expect(small.find((t) => t.id === without?.taskId)?.diffAgainstPrevious).toBeNull();
    expect(small[0]?.artefact).toEqual({
      devFixture: true,
      note: expect.stringContaining('Dev fixture'),
    });
  });
});
