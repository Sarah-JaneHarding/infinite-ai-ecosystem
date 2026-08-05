// The retrieval path proven end to end, against a real Postgres — Stage 05 step 4.
//
// The pure stages (intent routing, the policy gate, rerank, assembly) already have their
// own unit specs; this is what proves the wiring: the manual's own stage order holds even
// when optional stages no-op, the policy gate genuinely runs before any data read (not
// merely before it in the source file), and a real span records the run.

import { randomUUID } from 'node:crypto';

import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { disconnect, withTenant, type TenantClient } from '@infinite-ai/db';
import type { Actor, Resource } from '@infinite-ai/policy';
import { createTracer } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openWrite, ratify, run } from '../src/write-path.js';
import { RETRIEVAL_PATH_ORDER, retrieve } from '../src/retrieval-path.js';
import type { RetrievalQuery } from '../src/retrieval-types.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let spanExporter: InMemorySpanExporter;

const TENANT_ID = randomUUID();
const ACTOR_ID = randomUUID();
const CLASS_ID = randomUUID();
const NOW = new Date('2026-08-05T00:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.appRwUrl;
  await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT_ID,
        name: 'Retrieval Path Test',
        slug: `retrieval-path-${TENANT_ID.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 180_000);

afterAll(async () => {
  await disconnect();
  await db?.stop();
});

beforeEach(() => {
  spanExporter = new InMemorySpanExporter();
});

const smtActor: Actor = {
  userId: ACTOR_ID,
  tenantId: TENANT_ID,
  grants: [
    { role: 'smt', schoolId: null, classGroupId: null, subjectId: null, expiresAt: null },
  ],
  guardianOfLearnerIds: [],
  impersonating: false,
};

const teacherActorWrongClass: Actor = {
  userId: ACTOR_ID,
  tenantId: TENANT_ID,
  grants: [
    {
      role: 'teacher',
      schoolId: null,
      classGroupId: CLASS_ID,
      subjectId: null,
      expiresAt: null,
    },
  ],
  guardianOfLearnerIds: [],
  impersonating: false,
};

const learnerResource: Resource = {
  type: 'learner',
  tenantId: TENANT_ID,
  schoolId: null,
  classGroupId: randomUUID(), // a class the teacher fixture above does not hold
  subjectId: null,
  learnerId: null,
  ownerId: null,
};

async function insertEmbedding(
  tx: TenantClient,
  nodeId: string,
  vector: readonly number[],
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "brain_embedding" (id, tenant_id, node_id, model, dimensions, embedding, created_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'test-model', $4, $5::vector, now())`,
    randomUUID(),
    TENANT_ID,
    nodeId,
    vector.length,
    `[${vector.join(',')}]`,
  );
}

/** Commits an L1_NODE fact via the real write path, end to end, and returns its id. */
async function makeNode(tx: TenantClient, label: string): Promise<string> {
  const opened = await openWrite(tx, {
    targetTier: 'L1_NODE',
    rawPayload: { entityType: 'TOPIC', label },
    source: 'test',
  });
  const finished = await run(tx, opened.id);
  return finished.committedRowId!;
}

/** Commits an `L0_CONSTITUTION` fact via the real write path, ratification included, and
 * returns its id — proving the same pipeline the retrieval side reads back from. */
async function makeConstitution(tx: TenantClient, key: string): Promise<string> {
  const opened = await openWrite(tx, {
    targetTier: 'L0_CONSTITUTION',
    rawPayload: { key, kind: 'ASSESSMENT_POLICY', content: { rule: key } },
    source: 'test',
  });
  await run(tx, opened.id);
  await ratify(tx, opened.id, ACTOR_ID, NOW);
  const finished = await run(tx, opened.id);
  return finished.committedRowId!;
}

const BASE_QUERY: Omit<RetrievalQuery, 'actor' | 'resource' | 'now'> = {
  purpose: 'planning',
  subject: null,
  entityTypeHints: null,
  queryEmbedding: null,
  vectorK: 5,
  graphHops: 0,
  episodicWindow: null,
  episodicSubjectNodeId: null,
  tokenBudget: 1000,
};

describe('the retrieval path, end to end', () => {
  it('refuses before any data read, proven behaviourally rather than by mocking', async () => {
    // Every one of these three inputs would throw if its stage actually ran against the
    // database: an empty query embedding (vectorTopK), and a malformed episodic window
    // (filterEpisodesByWindow, from after to). If retrieve() resolves cleanly, none of
    // them were ever reached.
    const tracer = createTracer({
      serviceName: 'test-brain',
      spanProcessor: new SimpleSpanProcessor(spanExporter),
    });

    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      retrieve(
        tx,
        {
          ...BASE_QUERY,
          actor: teacherActorWrongClass,
          resource: learnerResource,
          queryEmbedding: [],
          graphHops: 3,
          episodicWindow: { from: new Date('2027-01-01'), to: new Date('2020-01-01') },
          now: NOW,
        },
        tracer,
      ),
    );

    expect(result.trace).toEqual(['intent_routed', 'policy_gated']);
    expect(result.policy.allowed).toBe(false);
    expect(result.candidates).toEqual([]);
    expect(result.assembled).toBeNull();

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.name).toBe('brain.retrieve');
    expect(span?.attributes['brain.retrieval.policy_allowed']).toBe(false);
  });

  it('runs every named stage in order, even when the optional ones have nothing to do', async () => {
    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      retrieve(tx, {
        ...BASE_QUERY,
        actor: smtActor,
        resource: { ...learnerResource, classGroupId: null },
        now: NOW,
      }),
    );
    expect(result.trace).toEqual(RETRIEVAL_PATH_ORDER);
    expect(result.policy.allowed).toBe(true);
    expect(result.assembled).toEqual({ included: [], dropped: [], totalTokens: 0 });
  });

  it('finds a vector match, expands it one hop, and assembles both into the context', async () => {
    const tracer = createTracer({
      serviceName: 'test-brain',
      spanProcessor: new SimpleSpanProcessor(spanExporter),
    });

    const { seedId, neighbourId } = await withTenant(
      { tenantId: TENANT_ID, actorId: ACTOR_ID },
      async (tx) => {
        const seedId = await makeNode(tx, 'Fractions');
        const neighbourId = await makeNode(tx, 'Decimals');
        const opened = await openWrite(tx, {
          targetTier: 'L1_EDGE',
          rawPayload: { sourceId: seedId, targetId: neighbourId, relation: 'related_to' },
          source: 'test',
        });
        await run(tx, opened.id);
        await insertEmbedding(tx, seedId, [1, 0, 0]);
        return { seedId, neighbourId };
      },
    );

    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      retrieve(
        tx,
        {
          ...BASE_QUERY,
          actor: smtActor,
          resource: { ...learnerResource, classGroupId: null },
          queryEmbedding: [1, 0, 0],
          graphHops: 1,
          now: NOW,
        },
        tracer,
      ),
    );

    expect(result.trace).toEqual(RETRIEVAL_PATH_ORDER);
    const candidateIds = result.candidates.map((c) => c.id);
    expect(candidateIds).toContain(seedId);
    expect(candidateIds).toContain(neighbourId);
    expect(result.assembled!.included.map((c) => c.id)).toEqual(
      expect.arrayContaining([seedId, neighbourId]),
    );

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.attributes['brain.retrieval.vector_matches']).toBe(1);
    expect(span?.attributes['brain.retrieval.graph_expanded_nodes']).toBe(1);
  });

  it('finds episodes within the declared window', async () => {
    const episodeId = await withTenant(
      { tenantId: TENANT_ID, actorId: ACTOR_ID },
      async (tx) => {
        const opened = await openWrite(tx, {
          targetTier: 'L2_EPISODE',
          rawPayload: {
            eventType: 'retrieval_path_test_event',
            occurredAt: '2026-06-01T00:00:00.000Z',
            summary: 'An episode inside the retrieval window.',
          },
          source: 'test',
        });
        const finished = await run(tx, opened.id);
        return finished.committedRowId!;
      },
    );

    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      retrieve(tx, {
        ...BASE_QUERY,
        actor: smtActor,
        resource: { ...learnerResource, classGroupId: null },
        episodicWindow: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
        now: NOW,
      }),
    );

    expect(result.candidates.map((c) => c.id)).toContain(episodeId);
  });

  it('prioritizes L0 constitution ahead of an L1 match, even under a tight budget', async () => {
    const key = `assessment_policy_${randomUUID().slice(0, 8)}`;
    const { constitutionId, nodeId } = await withTenant(
      { tenantId: TENANT_ID, actorId: ACTOR_ID },
      async (tx) => {
        const constitutionId = await makeConstitution(tx, key);
        const nodeId = await makeNode(tx, 'Prioritized node');
        await insertEmbedding(tx, nodeId, [1, 0, 0]);
        return { constitutionId, nodeId };
      },
    );

    // Just enough budget for the constitution fact's own estimated cost, and nothing else
    // — proving step 5's tier order rather than a coincidence of a generous budget.
    const constitutionText = `ASSESSMENT_POLICY[${key} v1]: ${JSON.stringify({ rule: key })}`;
    const budget = Math.ceil(constitutionText.length / 4);

    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      retrieve(tx, {
        ...BASE_QUERY,
        actor: smtActor,
        resource: { ...learnerResource, classGroupId: null },
        queryEmbedding: [1, 0, 0],
        tokenBudget: budget,
        now: NOW,
      }),
    );

    expect(result.assembled!.included.map((c) => c.id)).toEqual([constitutionId]);
    expect(result.assembled!.dropped.map((c) => c.id)).toContain(nodeId);
  });
});
