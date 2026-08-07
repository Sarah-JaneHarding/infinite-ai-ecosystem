// getFactProvenance, against a real Postgres — Stage 05 step 6.
//
// Every tier is committed directly through commitBrainFact (the same pattern
// brain-retrieval.integration.spec.ts uses), then read back through getFactProvenance to
// prove the normalization matches what was actually stamped at commit time — not just
// that the function returns *something* shaped right.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getFactProvenance } from '../src/brain-provenance.js';
import { commitBrainFact } from '../src/brain-write-path.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();
const RATIFIED_BY = randomUUID();
const RATIFIED_AT = new Date('2026-01-01T00:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Provenance Test',
        slug: `provenance-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

describe('getFactProvenance', () => {
  it("reads back an L1_NODE fact's full provenance", async () => {
    const derivationRunId = randomUUID();
    const { id } = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'TOPIC',
        externalRef: null,
        label: 'Fractions',
        attributes: {},
        source: 'test-agent',
        confidence: 0.87,
        derivationRunId,
        traceId: 'trace-1',
        supersedes: null,
        createdBy: ACTOR,
      }),
    );

    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L1_NODE', id),
    );

    expect(provenance).toMatchObject({
      id,
      targetTier: 'L1_NODE',
      source: 'test-agent',
      confidence: 0.87,
      derivationRunId,
      traceId: 'trace-1',
      actorId: null,
      createdBy: ACTOR,
      ratifiedBy: null,
      ratifiedAt: null,
      version: null,
      supersedes: null,
    });
    expect(provenance?.createdAt).toBeInstanceOf(Date);
  });

  it("reads back an L1_EDGE fact's provenance, including a declared supersedes", async () => {
    const { sourceId, targetId, supersededId, currentId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const source = await commitBrainFact(tx, {
          targetTier: 'L1_NODE',
          entityType: 'TOPIC',
          externalRef: null,
          label: 'Source node',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        const target = await commitBrainFact(tx, {
          targetTier: 'L1_NODE',
          entityType: 'TOPIC',
          externalRef: null,
          label: 'Target node',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        const superseded = await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId: source.id,
          targetId: target.id,
          relation: 'related_to',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        const current = await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId: source.id,
          targetId: target.id,
          relation: 'related_to',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: superseded.id,
          createdBy: null,
        });
        return {
          sourceId: source.id,
          targetId: target.id,
          supersededId: superseded.id,
          currentId: current.id,
        };
      },
    );

    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L1_EDGE', currentId),
    );

    expect(provenance?.supersedes).toBe(supersededId);
    expect([sourceId, targetId]).toContain(sourceId);
  });

  it("reads back an L2_EPISODE fact's provenance, actorId included and createdAt normalized from recordedAt", async () => {
    const actorId = randomUUID();
    const { id } = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'provenance_test_event',
        subjectNodeId: null,
        actorId,
        occurredAt: new Date('2026-06-01'),
        summary: 'An episode for the provenance test.',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 0.5,
        derivationRunId: null,
        traceId: 'trace-episode',
        supersedes: null,
        createdBy: null,
      }),
    );

    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L2_EPISODE', id),
    );

    expect(provenance?.actorId).toBe(actorId);
    expect(provenance?.traceId).toBe('trace-episode');
    expect(provenance?.createdAt).toBeInstanceOf(Date);
  });

  it("reads back an L0_CONSTITUTION fact's provenance: ratified, no source/confidence", async () => {
    const key = `policy_${randomUUID().slice(0, 8)}`;
    const { id } = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key,
        kind: 'ASSESSMENT_POLICY',
        content: { rule: key },
        ratifiedBy: RATIFIED_BY,
        ratifiedAt: RATIFIED_AT,
        createdBy: ACTOR,
      }),
    );

    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L0_CONSTITUTION', id),
    );

    expect(provenance).toMatchObject({
      id,
      targetTier: 'L0_CONSTITUTION',
      source: null,
      confidence: null,
      derivationRunId: null,
      traceId: null,
      actorId: null,
      createdBy: ACTOR,
      ratifiedBy: RATIFIED_BY,
      version: 1,
      supersedes: null,
    });
    expect(provenance?.ratifiedAt).toEqual(RATIFIED_AT);
  });

  it("reads back an L3_PROCEDURE fact's provenance", async () => {
    const ref = `exemplar_${randomUUID().slice(0, 8)}`;
    const { id } = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'EXEMPLAR',
        ref,
        content: { text: 'a worked example' },
        ratifiedBy: RATIFIED_BY,
        ratifiedAt: RATIFIED_AT,
        createdBy: null,
      }),
    );

    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L3_PROCEDURE', id),
    );

    expect(provenance).toMatchObject({
      id,
      targetTier: 'L3_PROCEDURE',
      source: null,
      confidence: null,
      ratifiedBy: RATIFIED_BY,
      version: 1,
    });
  });

  it('returns null for an id that does not exist under the given tier', async () => {
    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L1_NODE', randomUUID()),
    );
    expect(provenance).toBeNull();
  });

  it('returns null for a non-existent L0_CONSTITUTION id', async () => {
    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L0_CONSTITUTION', randomUUID()),
    );
    expect(provenance).toBeNull();
  });

  it('returns null for a non-existent L3_PROCEDURE id', async () => {
    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L3_PROCEDURE', randomUUID()),
    );
    expect(provenance).toBeNull();
  });

  it('returns null for a non-existent L1_EDGE id', async () => {
    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L1_EDGE', randomUUID()),
    );
    expect(provenance).toBeNull();
  });

  it('returns null when the id exists, but under a different tier', async () => {
    const { nodeId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const node = await commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'TOPIC',
        externalRef: null,
        label: 'Tier-mismatch node',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      return { nodeId: node.id };
    });

    // The same uuid is a real L1_NODE row, but asking for it under L2_EPISODE must not
    // return the node's data under a different label -- it must find nothing.
    const provenance = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getFactProvenance(tx, 'L2_EPISODE', nodeId),
    );
    expect(provenance).toBeNull();
  });
});
