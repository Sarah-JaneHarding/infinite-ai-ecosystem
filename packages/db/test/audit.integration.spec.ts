// appendAuditEvent, against a real Postgres — Stage 05 step 7.
//
// packages/telemetry's own suite proves the pure hash-chain logic in isolation; this
// proves the persistence side actually produces a chain verifyChain accepts, not just
// individually well-formed rows.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { verifyChain, type ChainedAuditEvent } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditError, appendAuditEvent } from '../src/audit.js';
import type { TenantClient } from '../src/client.js';
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
        name: 'Audit Test',
        slug: `audit-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

const baseInput = {
  actorId: ACTOR,
  resourceType: 'brain_write_candidate',
  purpose: null,
  traceId: null,
  createdBy: ACTOR,
};

/** Reads a row back in the shape `verifyChain` expects. */
async function readEvent(tx: TenantClient, id: string): Promise<ChainedAuditEvent> {
  const row = await tx.auditEvent.findFirstOrThrow({ where: { id } });
  return {
    tenantId: row.tenantId,
    actorId: row.actorId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    purpose: row.purpose,
    traceId: row.traceId,
    diff: row.diff,
    at: row.at,
    previousHash: row.previousHash === null ? null : Buffer.from(row.previousHash),
    hash: Buffer.from(row.hash),
  };
}

describe('appendAuditEvent', () => {
  it('chains the first event for a tenant onto a null previousHash', async () => {
    const appended = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      appendAuditEvent(tx, {
        ...baseInput,
        action: 'brain_write_test_first',
        resourceId: randomUUID(),
        diff: { status: 'EXTRACTED' },
        at: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const row = await asTenant(appRw, TENANT, ACTOR, (tx) => readEvent(tx, appended.id));
    expect(row.previousHash).toBeNull();
    expect(row.hash).toEqual(appended.hash);
  });

  it('chains a second event onto the first, and the pair verifies intact', async () => {
    const tenantId = randomUUID();
    await asTenant(migrator, tenantId, ACTOR, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Audit Chain Test',
          slug: `audit-chain-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const { firstId, secondId } = await asTenant(appRw, tenantId, ACTOR, async (tx) => {
      const first = await appendAuditEvent(tx, {
        ...baseInput,
        action: 'brain_write_test_extracted',
        resourceId: 'candidate-1',
        diff: { status: 'EXTRACTED' },
        at: new Date('2026-01-01T00:00:00.000Z'),
      });
      const second = await appendAuditEvent(tx, {
        ...baseInput,
        action: 'brain_write_test_committed',
        resourceId: 'candidate-1',
        diff: { status: 'COMMITTED' },
        at: new Date('2026-01-01T00:00:01.000Z'),
      });
      return { firstId: first.id, secondId: second.id };
    });

    const [first, second] = await asTenant(appRw, tenantId, ACTOR, async (tx) => [
      await readEvent(tx, firstId),
      await readEvent(tx, secondId),
    ]);

    expect(second.previousHash).toEqual(first.hash);
    expect(verifyChain([first, second])).toEqual({ intact: true, length: 2 });
  });

  it('keeps each tenant on its own chain', async () => {
    const tenantId = randomUUID();
    await asTenant(migrator, tenantId, ACTOR, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Audit Isolation Test',
          slug: `audit-isolation-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const appended = await asTenant(appRw, tenantId, ACTOR, (tx) =>
      appendAuditEvent(tx, {
        ...baseInput,
        action: 'brain_write_test_isolated',
        resourceId: randomUUID(),
        diff: {},
        at: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    // This tenant's own first event chains onto null, exactly like TENANT's did above —
    // proof its "last event" lookup is scoped to its own tenant, not the whole table.
    const row = await asTenant(appRw, tenantId, ACTOR, (tx) =>
      readEvent(tx, appended.id),
    );
    expect(row.previousHash).toBeNull();
  });

  it('refuses to append with no tenant context', async () => {
    await expect(
      appendAuditEvent(appRw as unknown as TenantClient, {
        ...baseInput,
        action: 'brain_write_test_no_context',
        resourceId: randomUUID(),
        diff: {},
        at: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('AuditError is exported for callers to catch', () => {
    expect(new AuditError('x')).toBeInstanceOf(Error);
  });
});
