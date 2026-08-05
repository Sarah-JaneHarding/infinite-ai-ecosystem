// The conflict queue's persistence primitives, against a real Postgres — Stage 05 step 3.
//
// packages/brain's own integration suite proves the write path's end-to-end contradiction
// resolution (auto-resolve, enqueue, and both ways a human can resolve a queued conflict);
// this file proves enqueueBrainConflict/getBrainConflict/listOpenBrainConflicts/
// resolveBrainConflict directly, including their own guards. Connects as `app_rw`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BrainConflictError,
  enqueueBrainConflict,
  getBrainConflict,
  listOpenBrainConflicts,
  resolveBrainConflict,
} from '../src/brain-conflict-queue.js';
import { advanceBrainWrite, openBrainWrite } from '../src/brain-write-path.js';
import type { TenantClient } from '../src/client.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-08-05T09:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Conflict Queue Test',
        slug: `conflict-queue-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

/** A write candidate stuck at CONTRADICTION_CHECKED with an unresolved conflict. */
async function stuckCandidate(tx: TenantClient): Promise<string> {
  const opened = await openBrainWrite(tx, {
    targetTier: 'L1_NODE',
    rawPayload: { entityType: 'TOPIC', label: 'Fixture' },
    source: 'test',
  });
  await advanceBrainWrite(
    tx,
    opened.id,
    { toStatus: 'EXTRACTED', typedPayload: {} },
    NOW,
  );
  await advanceBrainWrite(
    tx,
    opened.id,
    {
      toStatus: 'CONTRADICTION_CHECKED',
      contradictionOf: randomUUID(),
      contradictionResolution: null,
    },
    NOW,
  );
  return opened.id;
}

describe('enqueueBrainConflict / getBrainConflict / listOpenBrainConflicts', () => {
  it('opens a conflict at OPEN, unresolved', async () => {
    const conflict = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const writeCandidateId = await stuckCandidate(tx);
      return enqueueBrainConflict(tx, {
        writeCandidateId,
        targetTier: 'L1_NODE',
        contradictionOf: randomUUID(),
        newConfidence: 0.4,
        existingConfidence: 0.9,
        newRecency: NOW,
        existingRecency: NOW,
      });
    });
    expect(conflict.status).toBe('OPEN');
    expect(conflict.resolution).toBeNull();
    expect(conflict.newConfidence).toBe(0.4);
  });

  it('returns null for an id that does not exist', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getBrainConflict(tx, randomUUID()),
    );
    expect(found).toBeNull();
  });

  it('lists an open conflict until it is resolved, then drops it', async () => {
    const { conflictId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const writeCandidateId = await stuckCandidate(tx);
      const conflict = await enqueueBrainConflict(tx, {
        writeCandidateId,
        targetTier: 'L1_NODE',
        contradictionOf: randomUUID(),
        newConfidence: 0.4,
        existingConfidence: 0.9,
        newRecency: NOW,
        existingRecency: NOW,
      });
      return { conflictId: conflict.id };
    });

    const before = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      listOpenBrainConflicts(tx),
    );
    expect(before.map((c) => c.id)).toContain(conflictId);

    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      resolveBrainConflict(tx, conflictId, 'KEEP_EXISTING', ACTOR, NOW),
    );

    const after = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      listOpenBrainConflicts(tx),
    );
    expect(after.map((c) => c.id)).not.toContain(conflictId);
  });
});

describe('resolveBrainConflict', () => {
  it('throws for an id that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        resolveBrainConflict(tx, randomUUID(), 'ACCEPT_NEW', ACTOR, NOW),
      ),
    ).rejects.toThrow(BrainConflictError);
  });

  it('throws when the conflict is already resolved', async () => {
    const conflictId = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const writeCandidateId = await stuckCandidate(tx);
      const conflict = await enqueueBrainConflict(tx, {
        writeCandidateId,
        targetTier: 'L1_NODE',
        contradictionOf: randomUUID(),
        newConfidence: 0.4,
        existingConfidence: 0.9,
        newRecency: NOW,
        existingRecency: NOW,
      });
      await resolveBrainConflict(tx, conflict.id, 'KEEP_EXISTING', ACTOR, NOW);
      return conflict.id;
    });
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        resolveBrainConflict(tx, conflictId, 'ACCEPT_NEW', ACTOR, NOW),
      ),
    ).rejects.toThrow(/already RESOLVED/);
  });

  it('resolving ACCEPT_NEW unblocks the write candidate that raised the conflict', async () => {
    const { conflictId, writeCandidateId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const id = await stuckCandidate(tx);
        const conflict = await enqueueBrainConflict(tx, {
          writeCandidateId: id,
          targetTier: 'L1_NODE',
          contradictionOf: randomUUID(),
          newConfidence: 0.4,
          existingConfidence: 0.9,
          newRecency: NOW,
          existingRecency: NOW,
        });
        return { conflictId: conflict.id, writeCandidateId: id };
      },
    );

    const resolvedAt = new Date('2026-08-06T09:00:00.000Z');
    const resolved = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      resolveBrainConflict(
        tx,
        conflictId,
        'ACCEPT_NEW',
        ACTOR,
        resolvedAt,
        'looks right',
      ),
    );
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolution).toBe('ACCEPT_NEW');
    expect(resolved.resolutionNote).toBe('looks right');

    const advanced = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      advanceBrainWrite(
        tx,
        writeCandidateId,
        { toStatus: 'PROVENANCE_STAMPED' },
        resolvedAt,
      ),
    );
    expect(advanced.status).toBe('PROVENANCE_STAMPED');
  });
});
