// The retrieval path's data-touching stages, against a real Postgres — Stage 05 step 4.
//
// Embeddings have no write path of their own yet (see brain-write-path.ts's own note), so
// this suite inserts them directly via raw SQL — the same thing a future embedding writer
// will do, proven here against vectorTopK's read side of that same raw SQL boundary.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BrainRetrievalError,
  expandGraph,
  filterEpisodesByWindow,
  vectorTopK,
} from '../src/brain-retrieval.js';
import type { TenantClient } from '../src/client.js';
import { commitBrainFact } from '../src/brain-write-path.js';
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
        name: 'Retrieval Test',
        slug: `retrieval-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

/** Inserts an embedding directly — there is no write-path function for this yet. */
async function insertEmbedding(
  tx: TenantClient,
  nodeId: string,
  vector: readonly number[],
): Promise<void> {
  const literal = `[${vector.join(',')}]`;
  await tx.$executeRawUnsafe(
    `INSERT INTO "brain_embedding" (id, tenant_id, node_id, model, dimensions, embedding, created_at)
     VALUES ($1, $2, $3, 'test-model', $4, $5::vector, now())`,
    randomUUID(),
    TENANT,
    nodeId,
    vector.length,
    literal,
  );
}

async function makeNode(
  tx: TenantClient,
  label: string,
  confidence = 1,
): Promise<string> {
  const created = await commitBrainFact(tx, {
    targetTier: 'L1_NODE',
    entityType: 'TOPIC',
    externalRef: null,
    label,
    attributes: {},
    source: 'test',
    confidence,
    derivationRunId: null,
    traceId: null,
    supersedes: null,
    createdBy: null,
  });
  return created.id;
}

describe('vectorTopK', () => {
  it('orders matches by ascending distance and respects k', async () => {
    const { closeId, midId, farId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const closeId = await makeNode(tx, 'Close');
      const midId = await makeNode(tx, 'Mid');
      const farId = await makeNode(tx, 'Far');
      await insertEmbedding(tx, closeId, [1, 0, 0]);
      await insertEmbedding(tx, midId, [0.7, 0.7, 0]);
      await insertEmbedding(tx, farId, [-1, 0, 0]);
      return { closeId, midId, farId };
    });

    const matches = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      vectorTopK(tx, { queryEmbedding: [1, 0, 0], entityTypes: null, k: 2 }),
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]!.node.id).toBe(closeId);
    expect(matches[1]!.node.id).toBe(midId);
    expect(matches.map((m) => m.node.id)).not.toContain(farId);
    expect(matches[0]!.distance).toBeLessThan(matches[1]!.distance);
  });

  it('filters by entity type', async () => {
    const { topicId, learnerId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const topicId = await makeNode(tx, 'Filtered topic');
      const learnerCreated = await commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'LEARNER',
        externalRef: `LNR_${randomUUID().slice(0, 8)}`,
        label: 'Filtered learner',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      await insertEmbedding(tx, topicId, [1, 0, 0]);
      await insertEmbedding(tx, learnerCreated.id, [1, 0, 0]);
      return { topicId, learnerId: learnerCreated.id };
    });

    const matches = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      vectorTopK(tx, { queryEmbedding: [1, 0, 0], entityTypes: ['LEARNER'], k: 10 }),
    );

    expect(matches.map((m) => m.node.id)).toContain(learnerId);
    expect(matches.map((m) => m.node.id)).not.toContain(topicId);
  });

  it('excludes a superseded node', async () => {
    const { supersededId, replacementId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const supersededId = await makeNode(tx, 'Superseded original');
        await insertEmbedding(tx, supersededId, [1, 0, 0]);
        const replacement = await commitBrainFact(tx, {
          targetTier: 'L1_NODE',
          entityType: 'TOPIC',
          externalRef: null,
          label: 'Replacement',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: supersededId,
          createdBy: null,
        });
        await insertEmbedding(tx, replacement.id, [1, 0, 0]);
        return { supersededId, replacementId: replacement.id };
      },
    );

    const matches = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      vectorTopK(tx, { queryEmbedding: [1, 0, 0], entityTypes: null, k: 10 }),
    );

    expect(matches.map((m) => m.node.id)).toContain(replacementId);
    expect(matches.map((m) => m.node.id)).not.toContain(supersededId);
  });

  it('throws on an empty query embedding', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        vectorTopK(tx, { queryEmbedding: [], entityTypes: null, k: 1 }),
      ),
    ).rejects.toThrow(BrainRetrievalError);
  });

  it('throws on a non-finite embedding component', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        vectorTopK(tx, { queryEmbedding: [1, Number.NaN], entityTypes: null, k: 1 }),
      ),
    ).rejects.toThrow(BrainRetrievalError);
  });

  it('throws when k is less than 1', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        vectorTopK(tx, { queryEmbedding: [1, 0], entityTypes: null, k: 0 }),
      ),
    ).rejects.toThrow(BrainRetrievalError);
  });
});

describe('expandGraph', () => {
  it('returns nothing for an empty seed set', async () => {
    const result = await asTenant(appRw, TENANT, ACTOR, (tx) => expandGraph(tx, [], 2));
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('throws on a negative hop count', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) => expandGraph(tx, [randomUUID()], -1)),
    ).rejects.toThrow(BrainRetrievalError);
  });

  it('expands one hop but not two, when asked for one', async () => {
    const { seedId, oneHopId, twoHopId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const seedId = await makeNode(tx, 'Seed');
        const oneHopId = await makeNode(tx, 'One hop');
        const twoHopId = await makeNode(tx, 'Two hops');
        await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId: seedId,
          targetId: oneHopId,
          relation: 'related_to',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId: oneHopId,
          targetId: twoHopId,
          relation: 'related_to',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        return { seedId, oneHopId, twoHopId };
      },
    );

    const oneHop = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      expandGraph(tx, [seedId], 1),
    );
    expect(oneHop.nodes.map((n) => n.id)).toEqual([oneHopId]);
    expect(oneHop.nodes[0]!.hops).toBe(1);
    expect(oneHop.nodes.map((n) => n.id)).not.toContain(twoHopId);

    const twoHops = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      expandGraph(tx, [seedId], 2),
    );
    expect(twoHops.nodes.map((n) => n.id).sort()).toEqual([oneHopId, twoHopId].sort());
    expect(twoHops.nodes.find((n) => n.id === oneHopId)?.hops).toBe(1);
    expect(twoHops.nodes.find((n) => n.id === twoHopId)?.hops).toBe(2);
  });

  it('traverses an edge in either direction', async () => {
    const { seedId, incomingId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const seedId = await makeNode(tx, 'Seed (target side)');
      const incomingId = await makeNode(tx, 'Incoming');
      await commitBrainFact(tx, {
        targetTier: 'L1_EDGE',
        sourceId: incomingId,
        targetId: seedId,
        relation: 'points_to',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      return { seedId, incomingId };
    });

    const result = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      expandGraph(tx, [seedId], 1),
    );
    expect(result.nodes.map((n) => n.id)).toEqual([incomingId]);
  });
});

describe('filterEpisodesByWindow', () => {
  it('returns only episodes within the window, inclusive', async () => {
    const inWindow = new Date('2026-05-01T00:00:00.000Z');
    const before = new Date('2026-01-01T00:00:00.000Z');
    const after = new Date('2026-12-01T00:00:00.000Z');

    const { insideId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const inside = await commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'window_test_inside',
        subjectNodeId: null,
        actorId: null,
        occurredAt: inWindow,
        summary: 'Inside the window',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      await commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'window_test_before',
        subjectNodeId: null,
        actorId: null,
        occurredAt: before,
        summary: 'Before the window',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      return { insideId: inside.id };
    });

    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      filterEpisodesByWindow(tx, null, {
        from: new Date('2026-04-01T00:00:00.000Z'),
        to: after,
      }),
    );

    expect(found.map((e) => e.id)).toContain(insideId);
    expect(found.every((e) => e.eventType !== 'window_test_before')).toBe(true);
  });

  it('narrows to one subject node when given one', async () => {
    const window = { from: new Date('2026-01-01'), to: new Date('2026-12-31') };
    const { subjectId, matchingId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const subjectId = await makeNode(tx, 'Episode subject');
      const otherSubjectId = await makeNode(tx, 'Other subject');
      const matching = await commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'subject_test',
        subjectNodeId: subjectId,
        actorId: null,
        occurredAt: new Date('2026-06-01'),
        summary: 'About the right subject',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      await commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'subject_test',
        subjectNodeId: otherSubjectId,
        actorId: null,
        occurredAt: new Date('2026-06-01'),
        summary: 'About the wrong subject',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      return { subjectId, matchingId: matching.id };
    });

    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      filterEpisodesByWindow(tx, subjectId, window),
    );

    expect(found.map((e) => e.id)).toEqual([matchingId]);
  });

  it('throws when the window start is after its end', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        filterEpisodesByWindow(tx, null, {
          from: new Date('2026-06-01'),
          to: new Date('2026-01-01'),
        }),
      ),
    ).rejects.toThrow(BrainRetrievalError);
  });
});
