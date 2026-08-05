// getRetentionRule, against a real Postgres — Stage 05 step 8.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getRetentionRule } from '../src/retention.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Retention Test',
        slug: `retention-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

describe('getRetentionRule', () => {
  it('returns the tenant’s ratified rule for a category', async () => {
    const category = `ATTENDANCE_${randomUUID().slice(0, 8)}`;
    await asTenant(migrator, TENANT, ACTOR, (tx) =>
      tx.retentionRule.create({
        data: {
          tenantId: TENANT,
          category,
          anchor: 'ACADEMIC_YEAR_END',
          retainMonths: 60,
          authority: 'National Archives and Records Service Act, schedule 3',
          ratifiedAt: new Date('2026-01-01T00:00:00.000Z'),
          ratifiedBy: randomUUID(),
        },
      }),
    );

    const rule = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getRetentionRule(tx, category),
    );

    expect(rule).toMatchObject({
      category,
      anchor: 'ACADEMIC_YEAR_END',
      retainMonths: 60,
    });
  });

  it('returns null for a category with no ratified rule', async () => {
    const rule = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getRetentionRule(tx, `UNSCHEDULED_${randomUUID().slice(0, 8)}`),
    );
    expect(rule).toBeNull();
  });
});
