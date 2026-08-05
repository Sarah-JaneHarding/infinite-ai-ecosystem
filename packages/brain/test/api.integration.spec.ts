// The Brain API proven against real Postgres — Stage 05 step 9.
//
// Each of `remember`/`recall`/`ratify`/`supersede`/`forget`/`explain` is a thin
// composition of pieces already proven end to end in write-path.integration.spec.ts,
// retrieval-path.integration.spec.ts and brain-forgetting.integration.spec.ts (the last of
// those lives in packages/db, since tombstoneBrainFact itself does). This suite proves the
// facade wiring itself, plus the two behaviours that only exist at this layer: `supersede`
// asserting its result actually replaced something, and `explain` walking a real
// supersession chain back to its origin.

import { randomUUID } from 'node:crypto';

import { disconnect, withTenant, type TenantClient } from '@infinite-ai/db';
import type { Actor, Resource } from '@infinite-ai/policy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BrainApiError,
  explain,
  forget,
  ratify,
  recall,
  remember,
  supersede,
} from '../src/api.js';
import { RETRIEVAL_PATH_ORDER } from '../src/retrieval-path.js';
import type { RetrievalQuery } from '../src/retrieval-types.js';
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

async function seedTenant(): Promise<{ tenantId: string; actorId: string }> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  await withTenant({ tenantId, actorId }, (tx) =>
    tx.tenant.create({
      data: {
        id: tenantId,
        name: `Test tenant ${tenantId.slice(0, 8)}`,
        slug: `test-${tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
  return { tenantId, actorId };
}

describe('remember()', () => {
  it('drives an unratified fact all the way to RETENTION_SCHEDULED', async () => {
    const { tenantId, actorId } = await seedTenant();

    const finished = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Fractions' },
        source: 'test',
        createdBy: actorId,
      }),
    );

    expect(finished.status).toBe('RETENTION_SCHEDULED');
    expect(finished.committedRowId).not.toBeNull();
  });

  it('stops a ratified tier at AWAITING_RATIFICATION for a human', async () => {
    const { tenantId, actorId } = await seedTenant();

    const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key: `remember_policy_${randomUUID().slice(0, 8)}`,
          kind: 'ASSESSMENT_POLICY',
          content: { weighting: 'term-based' },
        },
        source: 'test',
      }),
    );

    expect(awaiting.status).toBe('AWAITING_RATIFICATION');
    expect(awaiting.committedRowId).toBeNull();
  });
});

describe('ratify()', () => {
  it('records the ratification and drives the candidate the rest of the way through', async () => {
    const { tenantId, actorId } = await seedTenant();

    const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key: `ratify_api_${randomUUID().slice(0, 8)}`,
          kind: 'ASSESSMENT_POLICY',
          content: { weighting: 'annual' },
        },
        source: 'test',
      }),
    );

    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');
    const finished = await withTenant({ tenantId, actorId }, (tx) =>
      ratify(tx, awaiting.id, actorId, ratifiedAt),
    );

    expect(finished.status).toBe('RETENTION_SCHEDULED');
    expect(finished.committedVersion).toBe(1);
    expect(finished.ratifiedBy).toBe(actorId);
  });
});

describe('supersede()', () => {
  it('replaces a specific existing fact and leaves the original readable', async () => {
    const { tenantId, actorId } = await seedTenant();
    const externalRef = `LNR_${randomUUID().slice(0, 8)}`;

    const original = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'LEARNER', externalRef, label: 'Original label' },
        source: 'test',
      }),
    );
    expect(original.status).toBe('RETENTION_SCHEDULED');

    const corrected = await withTenant({ tenantId, actorId }, (tx) =>
      supersede(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef,
          label: 'Corrected label',
          supersedes: original.committedRowId,
        },
        source: 'test',
      }),
    );

    expect(corrected.status).toBe('RETENTION_SCHEDULED');
    await withTenant({ tenantId, actorId }, async (tx: TenantClient) => {
      const originalRow = await tx.brainNode.findFirstOrThrow({
        where: { id: original.committedRowId! },
      });
      expect(originalRow.label).toBe('Original label');
      const newRow = await tx.brainNode.findFirstOrThrow({
        where: { id: corrected.committedRowId! },
      });
      expect(newRow.supersedes).toBe(original.committedRowId);
    });
  });

  it('throws when nothing effective matched what the candidate declared', async () => {
    const { tenantId, actorId } = await seedTenant();

    await withTenant({ tenantId, actorId }, async (tx) => {
      await expect(
        supersede(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'TOPIC', label: 'Nothing to replace' },
          source: 'test',
        }),
      ).rejects.toThrow(BrainApiError);
    });
  });

  it('throws when the conflict was left unresolved rather than superseded', async () => {
    const { tenantId, actorId } = await seedTenant();
    const externalRef = `LNR_${randomUUID().slice(0, 8)}`;

    await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'LEARNER', externalRef, label: 'Strong claim' },
        source: 'test',
      }),
    );

    await withTenant({ tenantId, actorId }, async (tx) => {
      // Lower confidence, no declared `supersedes`: provenance comparison cannot resolve
      // this automatically, so it is enqueued for a human rather than superseding anything.
      await expect(
        supersede(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'LEARNER', externalRef, label: 'Weaker claim' },
          source: 'test',
          confidence: 0.2,
        }),
      ).rejects.toThrow(BrainApiError);
    });
  });
});

describe('forget()', () => {
  it('tombstones an existing fact, leaving the original untouched', async () => {
    const { tenantId, actorId } = await seedTenant();

    const committed = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Forgettable' },
        source: 'test',
      }),
    );

    const tombstoned = await withTenant({ tenantId, actorId }, (tx) =>
      forget(tx, 'L1_NODE', committed.committedRowId!, 'retention_expired', new Date()),
    );

    expect(tombstoned.supersedes).toBe(committed.committedRowId);
    await withTenant({ tenantId, actorId }, async (tx) => {
      const originalRow = await tx.brainNode.findFirstOrThrow({
        where: { id: committed.committedRowId! },
      });
      expect(originalRow.tombstonedAt).toBeNull();
    });
  });
});

describe('recall()', () => {
  const TENANT_ID = randomUUID();
  const ACTOR_ID = randomUUID();

  const smtActor: Actor = {
    userId: ACTOR_ID,
    tenantId: TENANT_ID,
    grants: [
      {
        role: 'smt',
        schoolId: null,
        classGroupId: null,
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
    classGroupId: null,
    subjectId: null,
    learnerId: null,
    ownerId: null,
  };

  it('delegates to the same retrieval path retrieve() itself runs', async () => {
    await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      tx.tenant.create({
        data: {
          id: TENANT_ID,
          name: 'Recall API Test',
          slug: `recall-api-${TENANT_ID.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const query: RetrievalQuery = {
      actor: smtActor,
      resource: learnerResource,
      purpose: 'planning',
      subject: null,
      entityTypeHints: null,
      queryEmbedding: null,
      vectorK: 5,
      graphHops: 0,
      episodicWindow: null,
      episodicSubjectNodeId: null,
      tokenBudget: 1000,
      now: new Date('2026-08-06T00:00:00.000Z'),
    };

    const result = await withTenant({ tenantId: TENANT_ID, actorId: ACTOR_ID }, (tx) =>
      recall(tx, query),
    );

    expect(result.policy.allowed).toBe(true);
    expect(result.trace).toEqual(RETRIEVAL_PATH_ORDER);
  });
});

describe('explain()', () => {
  it('walks a supersession chain back to its origin, newest first', async () => {
    const { tenantId, actorId } = await seedTenant();
    const externalRef = `LNR_${randomUUID().slice(0, 8)}`;

    const original = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'LEARNER', externalRef, label: 'v1' },
        source: 'test',
      }),
    );
    const corrected = await withTenant({ tenantId, actorId }, (tx) =>
      supersede(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef,
          label: 'v2',
          supersedes: original.committedRowId,
        },
        source: 'test',
      }),
    );

    const chain = await withTenant({ tenantId, actorId }, (tx) =>
      explain(tx, 'L1_NODE', corrected.committedRowId!),
    );

    expect(chain.map((f) => f.id)).toEqual([
      corrected.committedRowId,
      original.committedRowId,
    ]);
    expect(chain[0]?.supersedes).toBe(original.committedRowId);
    expect(chain[1]?.supersedes).toBeNull();
  });

  it('carries ratification metadata through a ratified tier’s version chain', async () => {
    const { tenantId, actorId } = await seedTenant();
    const key = `explain_policy_${randomUUID().slice(0, 8)}`;
    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');

    async function commitPolicy(content: unknown) {
      const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
        remember(tx, {
          targetTier: 'L0_CONSTITUTION',
          rawPayload: { key, kind: 'ASSESSMENT_POLICY', content },
          source: 'test',
        }),
      );
      return withTenant({ tenantId, actorId }, (tx) =>
        ratify(tx, awaiting.id, actorId, ratifiedAt),
      );
    }

    await commitPolicy({ weighting: 'term-based' });
    const second = await commitPolicy({ weighting: 'annual' });

    const chain = await withTenant({ tenantId, actorId }, (tx) =>
      explain(tx, 'L0_CONSTITUTION', second.committedRowId!),
    );

    expect(chain).toHaveLength(2);
    expect(chain[0]?.version).toBe(2);
    expect(chain[0]?.ratifiedBy).toBe(actorId);
    expect(chain[1]?.version).toBe(1);
    expect(chain[1]?.supersedes).toBeNull();
  });

  // The exit gate asks for a complete chain "for every fact type" — five tiers. The two
  // tests above cover L1_NODE and L0_CONSTITUTION; these three cover the rest.
  it('walks an L1_EDGE correction chain back to its origin', async () => {
    const { tenantId, actorId } = await seedTenant();

    const { sourceId, targetId, originalEdgeId } = await withTenant(
      { tenantId, actorId },
      async (tx) => {
        const source = await remember(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'TOPIC', label: 'Edge chain source' },
          source: 'test',
        });
        const target = await remember(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'TOPIC', label: 'Edge chain target' },
          source: 'test',
        });
        const edge = await remember(tx, {
          targetTier: 'L1_EDGE',
          rawPayload: {
            sourceId: source.committedRowId,
            targetId: target.committedRowId,
            relation: 'related_to',
          },
          source: 'test',
        });
        return {
          sourceId: source.committedRowId!,
          targetId: target.committedRowId!,
          originalEdgeId: edge.committedRowId!,
        };
      },
    );

    const corrected = await withTenant({ tenantId, actorId }, (tx) =>
      supersede(tx, {
        targetTier: 'L1_EDGE',
        rawPayload: {
          sourceId,
          targetId,
          relation: 'related_to',
          supersedes: originalEdgeId,
        },
        source: 'test',
      }),
    );

    const chain = await withTenant({ tenantId, actorId }, (tx) =>
      explain(tx, 'L1_EDGE', corrected.committedRowId!),
    );

    expect(chain.map((f) => f.id)).toEqual([corrected.committedRowId, originalEdgeId]);
    expect(chain[0]?.supersedes).toBe(originalEdgeId);
    expect(chain[1]?.supersedes).toBeNull();
  });

  it('walks an L2_EPISODE correction chain back to its origin', async () => {
    const { tenantId, actorId } = await seedTenant();

    const original = await withTenant({ tenantId, actorId }, (tx) =>
      remember(tx, {
        targetTier: 'L2_EPISODE',
        rawPayload: {
          eventType: 'explain_test_event',
          occurredAt: '2026-06-01T00:00:00.000Z',
          summary: 'What we first thought happened.',
        },
        source: 'test',
      }),
    );

    const corrected = await withTenant({ tenantId, actorId }, (tx) =>
      supersede(tx, {
        targetTier: 'L2_EPISODE',
        rawPayload: {
          eventType: 'explain_test_event',
          occurredAt: '2026-06-01T00:00:00.000Z',
          summary: 'What we now know actually happened.',
          supersedes: original.committedRowId,
        },
        source: 'test',
      }),
    );

    const chain = await withTenant({ tenantId, actorId }, (tx) =>
      explain(tx, 'L2_EPISODE', corrected.committedRowId!),
    );

    expect(chain.map((f) => f.id)).toEqual([
      corrected.committedRowId,
      original.committedRowId,
    ]);
    expect(chain[0]?.supersedes).toBe(original.committedRowId);
    expect(chain[1]?.supersedes).toBeNull();
  });

  it('walks an L3_PROCEDURE version chain back to its origin', async () => {
    const { tenantId, actorId } = await seedTenant();
    const ref = `explain_procedure_${randomUUID().slice(0, 8)}`;
    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');

    async function commitProcedure(content: unknown) {
      const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
        remember(tx, {
          targetTier: 'L3_PROCEDURE',
          rawPayload: { kind: 'SOP', ref, content },
          source: 'test',
        }),
      );
      return withTenant({ tenantId, actorId }, (tx) =>
        ratify(tx, awaiting.id, actorId, ratifiedAt),
      );
    }

    await commitProcedure({ step: 'v1' });
    const second = await commitProcedure({ step: 'v2' });

    const chain = await withTenant({ tenantId, actorId }, (tx) =>
      explain(tx, 'L3_PROCEDURE', second.committedRowId!),
    );

    expect(chain).toHaveLength(2);
    expect(chain[0]?.version).toBe(2);
    expect(chain[0]?.ratifiedBy).toBe(actorId);
    expect(chain[1]?.version).toBe(1);
    expect(chain[1]?.supersedes).toBeNull();
  });

  it('throws for a fact that does not exist under the given tier', async () => {
    const { tenantId, actorId } = await seedTenant();

    await withTenant({ tenantId, actorId }, async (tx) => {
      await expect(explain(tx, 'L1_NODE', randomUUID())).rejects.toThrow(BrainApiError);
    });
  });
});
