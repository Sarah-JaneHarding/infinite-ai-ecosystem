// tombstoneBrainFact, against a real Postgres — Stage 05 step 8.
//
// Proves the whole point of the tombstone path in one pass per tier: the original row is
// never touched (still readable, its own tombstonedAt still null), a new row is created
// that both supersedes it and carries its own tombstonedAt, an audit event is written, and
// — the "reindex" step 8 asks for — a tombstoned node no longer surfaces from vectorTopK.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BrainForgettingError, tombstoneBrainFact } from '../src/brain-forgetting.js';
import { commitBrainFact } from '../src/brain-write-path.js';
import { vectorTopK } from '../src/brain-retrieval.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';
import type { TenantClient } from '../src/client.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-08-06T00:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Forgetting Test',
        slug: `forgetting-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

async function insertEmbedding(
  tx: TenantClient,
  nodeId: string,
  vector: readonly number[],
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "brain_embedding" (id, tenant_id, node_id, model, dimensions, embedding, created_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'test-model', $4, $5::vector, now())`,
    randomUUID(),
    TENANT,
    nodeId,
    vector.length,
    `[${vector.join(',')}]`,
  );
}

async function makeNode(tx: TenantClient, label: string): Promise<string> {
  const created = await commitBrainFact(tx, {
    targetTier: 'L1_NODE',
    entityType: 'TOPIC',
    externalRef: null,
    label,
    attributes: { note: 'original' },
    source: 'test',
    confidence: 1,
    derivationRunId: null,
    traceId: null,
    supersedes: null,
    createdBy: null,
  });
  return created.id;
}

async function makeEdge(tx: TenantClient, labelPrefix: string): Promise<string> {
  const sourceId = await makeNode(tx, `${labelPrefix} source`);
  const targetId = await makeNode(tx, `${labelPrefix} target`);
  const edge = await commitBrainFact(tx, {
    targetTier: 'L1_EDGE',
    sourceId,
    targetId,
    relation: 'related_to',
    attributes: {},
    source: 'test',
    confidence: 1,
    derivationRunId: null,
    traceId: null,
    supersedes: null,
    createdBy: null,
  });
  return edge.id;
}

describe('tombstoneBrainFact', () => {
  it('tombstones an L1_NODE: original untouched, new row supersedes it, node drops out of retrieval', async () => {
    const { originalId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const originalId = await makeNode(tx, 'Tombstone target');
      await insertEmbedding(tx, originalId, [1, 0, 0]);
      return { originalId };
    });

    const beforeMatches = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      vectorTopK(tx, { queryEmbedding: [1, 0, 0], entityTypes: null, k: 10 }),
    );
    expect(beforeMatches.map((m) => m.node.id)).toContain(originalId);

    const tombstoned = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_NODE', id: originalId, reason: 'retention_expired' },
        NOW,
      ),
    );
    expect(tombstoned.supersedes).toBe(originalId);

    const { original, replacement } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const original = await tx.brainNode.findFirstOrThrow({ where: { id: originalId } });
      const replacement = await tx.brainNode.findFirstOrThrow({
        where: { id: tombstoned.id },
      });
      return { original, replacement };
    });

    expect(original.tombstonedAt).toBeNull();
    expect(original.label).toBe('Tombstone target');
    expect(replacement.tombstonedAt).toEqual(NOW);
    expect(replacement.supersedes).toBe(originalId);
    expect(replacement.label).toBe('Tombstone target');
    expect(replacement.source).toBe('retention_expired');

    const afterMatches = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      vectorTopK(tx, { queryEmbedding: [1, 0, 0], entityTypes: null, k: 10 }),
    );
    expect(afterMatches.map((m) => m.node.id)).not.toContain(originalId);
    expect(afterMatches.map((m) => m.node.id)).not.toContain(tombstoned.id);
  });

  it('tombstones an L1_EDGE: original untouched, new row supersedes it', async () => {
    const { sourceId, targetId, originalEdgeId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const sourceId = await makeNode(tx, 'Edge source');
        const targetId = await makeNode(tx, 'Edge target');
        const edge = await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId,
          targetId,
          relation: 'related_to',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        return { sourceId, targetId, originalEdgeId: edge.id };
      },
    );

    const tombstoned = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_EDGE', id: originalEdgeId, reason: 'consent_withdrawn' },
        NOW,
      ),
    );

    const { original, replacement } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const original = await tx.brainEdge.findFirstOrThrow({
        where: { id: originalEdgeId },
      });
      const replacement = await tx.brainEdge.findFirstOrThrow({
        where: { id: tombstoned.id },
      });
      return { original, replacement };
    });

    expect(original.tombstonedAt).toBeNull();
    expect(replacement.tombstonedAt).toEqual(NOW);
    expect(replacement.supersedes).toBe(originalEdgeId);
    expect(replacement.sourceId).toBe(sourceId);
    expect(replacement.targetId).toBe(targetId);
    expect(replacement.source).toBe('consent_withdrawn');
  });

  it('logs an audit event for the tombstone', async () => {
    const originalId = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      makeNode(tx, 'Audited tombstone'),
    );
    const tombstoned = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_NODE', id: originalId, reason: 'retention_expired' },
        NOW,
      ),
    );

    const event = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tx.auditEvent.findFirst({
        where: { action: 'brain_fact_tombstoned', resourceId: originalId },
      }),
    );

    expect(event).not.toBeNull();
    expect(event?.resourceType).toBe('L1_NODE');
    expect((event?.diff as Record<string, unknown>).tombstoneId).toBe(tombstoned.id);
  });

  it('throws when the L1_NODE fact does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_NODE', id: randomUUID(), reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });

  it('throws when the L1_NODE fact has already been superseded by an earlier tombstone', async () => {
    const originalId = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      makeNode(tx, 'Double tombstone via original'),
    );
    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_NODE', id: originalId, reason: 'retention_expired' },
        NOW,
      ),
    );

    // The original's own tombstonedAt is still null; it's the "something already
    // supersedes it" branch that must refuse this, not the "is itself tombstoned" one.
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_NODE', id: originalId, reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });

  it('throws when the L1_NODE fact is itself already a tombstone', async () => {
    const originalId = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      makeNode(tx, 'Double tombstone via tombstone row'),
    );
    const tombstoned = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_NODE', id: originalId, reason: 'retention_expired' },
        NOW,
      ),
    );

    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_NODE', id: tombstoned.id, reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });

  it('throws when the L1_EDGE fact does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_EDGE', id: randomUUID(), reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });

  it('throws when the L1_EDGE fact has already been superseded by an earlier tombstone', async () => {
    const originalEdgeId = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      makeEdge(tx, 'Double tombstone via original'),
    );

    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_EDGE', id: originalEdgeId, reason: 'retention_expired' },
        NOW,
      ),
    );

    // The original's own tombstonedAt is still null; it's the "something already
    // supersedes it" branch that must refuse this, not the "is itself tombstoned" one.
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_EDGE', id: originalEdgeId, reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });

  it('throws when the L1_EDGE fact is itself already a tombstone', async () => {
    const originalEdgeId = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      makeEdge(tx, 'Double tombstone via tombstone row'),
    );
    const tombstoned = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tombstoneBrainFact(
        tx,
        { targetTier: 'L1_EDGE', id: originalEdgeId, reason: 'retention_expired' },
        NOW,
      ),
    );

    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        tombstoneBrainFact(
          tx,
          { targetTier: 'L1_EDGE', id: tombstoned.id, reason: 'retention_expired' },
          NOW,
        ),
      ),
    ).rejects.toThrow(BrainForgettingError);
  });
});
