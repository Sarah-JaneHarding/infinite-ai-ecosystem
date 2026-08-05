// The restore drill — Stage 05 step 10.
//
// "A restore test: point-in-time restore reproduces a known state exactly." This proves
// the piece of that claim Stage 05 actually owns: a snapshot-and-restore round trip, using
// `@testcontainers/postgresql`'s own `CREATE DATABASE ... WITH TEMPLATE` (a real Postgres
// physical-copy mechanism, exec'd inside the same container the rest of this suite already
// runs migrations against), reproduces a captured Brain state exactly — a versioned
// L0_CONSTITUTION chain and a tombstoned L1_NODE both survive byte for byte, and anything
// written *after* the snapshot is gone once restored.
//
// This is a snapshot/restore drill, not continuous point-in-time recovery to an arbitrary
// timestamp — that needs WAL archiving against a real deployed environment, which is Stage
// 15 step 6's job (`docs/STAGE_LOG.md`'s own Stage 05 step 7 write-up already gives the same
// reasoning for why a nightly-snapshot job isn't built here). What this proves is real and
// Brain-specific: the exact set of invariants step 10 names — supersession chains and
// tombstones — round-trip through an actual backup and restore untouched.

import { randomUUID } from 'node:crypto';

import { disconnect, withTenant } from '@infinite-ai/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { explain, forget, ratify, remember } from '../src/api.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.appRwUrl;
}, 180_000);

afterAll(async () => {
  await disconnect();
  await db?.stop();
});

describe('the restore drill', () => {
  it('a snapshot-and-restore round trip reproduces a known Brain state exactly', async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const key = `restore_drill_${randomUUID().slice(0, 8)}`;
    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');

    const known = await withTenant({ tenantId, actorId }, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Restore Drill Test',
          slug: `restore-drill-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });

      // A two-version, ratified L0_CONSTITUTION chain — supersession.
      const v1Awaiting = await remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key,
          kind: 'ASSESSMENT_POLICY',
          content: { weighting: 'term-based' },
        },
        source: 'test',
      });
      const v1 = await ratify(tx, v1Awaiting.id, actorId, ratifiedAt);
      const v2Awaiting = await remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: { key, kind: 'ASSESSMENT_POLICY', content: { weighting: 'annual' } },
        source: 'test',
      });
      const v2 = await ratify(tx, v2Awaiting.id, actorId, ratifiedAt);

      // A tombstoned L1_NODE — forgetting.
      const node = await remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Restorable topic' },
        source: 'test',
      });
      const tombstone = await forget(
        tx,
        'L1_NODE',
        node.committedRowId!,
        'retention_expired',
        ratifiedAt,
      );

      const constitutionChain = await explain(tx, 'L0_CONSTITUTION', v2.committedRowId!);

      return {
        constitutionChainIds: constitutionChain.map((f) => f.id),
        v1Id: v1.committedRowId!,
        v2Id: v2.committedRowId!,
        nodeId: node.committedRowId!,
        tombstoneId: tombstone.id,
      };
    });

    // The snapshot needs sole access to the database — release the pooled connection first.
    await disconnect();
    await db.snapshot();

    // Written after the snapshot: this must not survive the restore below.
    const postSnapshotId = await withTenant({ tenantId, actorId }, async (tx) => {
      const finished = await remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Written after the snapshot' },
        source: 'test',
      });
      return finished.committedRowId!;
    });

    await disconnect();
    await db.restoreSnapshot();

    const restored = await withTenant({ tenantId, actorId }, async (tx) => {
      const constitutionChain = await explain(tx, 'L0_CONSTITUTION', known.v2Id);
      const v1Row = await tx.brainConstitution.findFirstOrThrow({
        where: { id: known.v1Id },
      });
      const v2Row = await tx.brainConstitution.findFirstOrThrow({
        where: { id: known.v2Id },
      });
      const nodeRow = await tx.brainNode.findFirstOrThrow({
        where: { id: known.nodeId },
      });
      const tombstoneRow = await tx.brainNode.findFirstOrThrow({
        where: { id: known.tombstoneId },
      });
      const postSnapshotRow = await tx.brainNode.findFirst({
        where: { id: postSnapshotId },
      });
      return {
        constitutionChainIds: constitutionChain.map((f) => f.id),
        v1Content: v1Row.content,
        v2Content: v2Row.content,
        nodeTombstonedAt: nodeRow.tombstonedAt,
        tombstoneSupersedes: tombstoneRow.supersedes,
        tombstoneSource: tombstoneRow.source,
        postSnapshotRow,
      };
    });

    expect(restored.constitutionChainIds).toEqual(known.constitutionChainIds);
    expect(restored.v1Content).toEqual({ weighting: 'term-based' });
    expect(restored.v2Content).toEqual({ weighting: 'annual' });
    expect(restored.nodeTombstonedAt).toBeNull();
    expect(restored.tombstoneSupersedes).toBe(known.nodeId);
    expect(restored.tombstoneSource).toBe('retention_expired');
    // Reproduces the known state exactly — nothing written after the snapshot survives.
    expect(restored.postSnapshotRow).toBeNull();
  });
});
