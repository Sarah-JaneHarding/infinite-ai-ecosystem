// The write path proven against real Postgres — Stage 05 step 2.
//
// The unit specs prove the pure pieces (extraction, ordering, contradiction decision) in
// isolation; this is what proves the wiring actually works: a candidate persists through
// every transition, resumes correctly after a "crash" (a fresh fetch mid-pipeline, not
// state held in memory), a ratified tier stops for a human and picks back up once
// ratified, versioning and supersession leave old rows readable, and an undeclared
// conflict refuses to commit silently.

import { randomUUID } from 'node:crypto';

import {
  disconnect,
  listOpenBrainConflicts,
  withTenant,
  type TenantClient,
} from '@infinite-ai/db';
import { verifyChain, type ChainedAuditEvent } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BrainWritePathError,
  advanceOnce,
  listOpenWrites,
  openWrite,
  ratify,
  resolveConflict,
  run,
} from '../src/write-path.js';
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

/** A fresh tenant, seeded through the same `withTenant()` production code path uses. */
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

describe('the write path, end to end', () => {
  it('drives an unratified tier (L1_NODE) from candidate to retention-scheduled', async () => {
    const { tenantId, actorId } = await seedTenant();

    const finished = await withTenant({ tenantId, actorId }, async (tx: TenantClient) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Fractions' },
        source: 'test',
        createdBy: actorId,
      });
      expect(opened.status).toBe('CANDIDATE');
      return run(tx, opened.id);
    });

    expect(finished.status).toBe('RETENTION_SCHEDULED');
    expect(finished.committedRowId).not.toBeNull();
    expect(finished.committedVersion).toBeNull(); // L1_NODE has no version column
    expect(finished.contradictionOf).toBeNull();
  });

  it('persists every transition, so resuming means picking the status back up, not restarting', async () => {
    const { tenantId, actorId } = await seedTenant();

    const openedId = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Long division' },
        source: 'test',
      });
      // Advance exactly two steps, "crashing" in between each — a fresh fetch, not a
      // variable held across calls.
      await advanceOnce(tx, opened.id);
      return opened.id;
    });

    const afterFirstResume = await withTenant({ tenantId, actorId }, (tx) =>
      advanceOnce(tx, openedId),
    );
    expect(afterFirstResume.status).toBe('CONTRADICTION_CHECKED');

    // A completely separate transaction resumes the same candidate to completion.
    const finished = await withTenant({ tenantId, actorId }, (tx) => run(tx, openedId));
    expect(finished.status).toBe('RETENTION_SCHEDULED');
  });

  it('lists a candidate under listOpenWrites until it reaches the terminal status', async () => {
    const { tenantId, actorId } = await seedTenant();

    await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Ratios' },
        source: 'test',
      });

      const openBefore = await listOpenWrites(tx);
      expect(openBefore.map((c) => c.id)).toContain(opened.id);

      const finished = await run(tx, opened.id);
      expect(finished.status).toBe('RETENTION_SCHEDULED');

      const openAfter = await listOpenWrites(tx);
      expect(openAfter.map((c) => c.id)).not.toContain(opened.id);
    });
  });

  it('stops a ratified tier (L0_CONSTITUTION) at AWAITING_RATIFICATION for a human', async () => {
    const { tenantId, actorId } = await seedTenant();

    const awaiting = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key: 'assessment_policy',
          kind: 'ASSESSMENT_POLICY',
          content: { weighting: 'term-based' },
        },
        source: 'test',
      });
      return run(tx, opened.id);
    });

    expect(awaiting.status).toBe('AWAITING_RATIFICATION');
    expect(awaiting.committedRowId).toBeNull();

    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');
    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      await ratify(tx, awaiting.id, actorId, ratifiedAt);
      return run(tx, awaiting.id);
    });

    expect(finished.status).toBe('RETENTION_SCHEDULED');
    expect(finished.committedVersion).toBe(1);
  });

  it('versions a second L0_CONSTITUTION candidate for the same key and supersedes the first, without touching it', async () => {
    const { tenantId, actorId } = await seedTenant();

    async function commitPolicy(content: unknown) {
      return withTenant({ tenantId, actorId }, async (tx) => {
        const opened = await openWrite(tx, {
          targetTier: 'L0_CONSTITUTION',
          rawPayload: { key: 'assessment_policy', kind: 'ASSESSMENT_POLICY', content },
          source: 'test',
        });
        const awaiting = await run(tx, opened.id);
        await ratify(tx, awaiting.id, actorId, new Date('2026-05-01T00:00:00.000Z'));
        return run(tx, awaiting.id);
      });
    }

    const first = await commitPolicy({ weighting: 'term-based' });
    const second = await commitPolicy({ weighting: 'annual' });

    expect(first.committedVersion).toBe(1);
    expect(second.committedVersion).toBe(2);
    expect(second.committedRowId).not.toBe(first.committedRowId);

    // The superseded row is still readable, unchanged — no destructive update anywhere.
    await withTenant({ tenantId, actorId }, async (tx) => {
      const originalRow = await tx.brainConstitution.findFirstOrThrow({
        where: { id: first.committedRowId! },
      });
      expect(originalRow.version).toBe(1);
      expect((originalRow.content as { weighting: string }).weighting).toBe('term-based');

      const newRow = await tx.brainConstitution.findFirstOrThrow({
        where: { id: second.committedRowId! },
      });
      expect(newRow.supersedes).toBe(first.committedRowId);
    });
  });

  it('refuses to commit an L1_NODE candidate over an undeclared conflict', async () => {
    const { tenantId, actorId } = await seedTenant();

    const committed = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_0001',
          label: 'A learner',
        },
        source: 'test',
      });
      return run(tx, opened.id);
    });
    expect(committed.status).toBe('RETENTION_SCHEDULED');

    await withTenant({ tenantId, actorId }, async (tx) => {
      // Lower confidence than the committed fact's default (1): provenance comparison
      // cannot resolve this in the new candidate's favour, so it must be enqueued rather
      // than auto-superseded — see the "contradiction resolution" describe block below
      // for the case where a higher-confidence candidate *does* auto-supersede.
      const conflicting = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_0001',
          label: 'A learner (different label, no supersedes declared)',
        },
        source: 'test',
        confidence: 0.5,
      });
      await expect(run(tx, conflicting.id)).rejects.toThrow(BrainWritePathError);

      const afterFailure = await listOpenWrites(tx);
      const stuck = afterFailure.find((c) => c.id === conflicting.id);
      expect(stuck?.status).toBe('CONTRADICTION_CHECKED');
      expect(stuck?.contradictionOf).toBe(committed.committedRowId);
      expect(stuck?.contradictionResolution).toBeNull();
    });

    // Declaring the correction explicitly is the way through.
    const corrected = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_0001',
          label: 'A learner (corrected)',
          supersedes: committed.committedRowId,
        },
        source: 'test',
      });
      return run(tx, opened.id);
    });
    expect(corrected.status).toBe('RETENTION_SCHEDULED');
    expect(corrected.contradictionOf).toBeNull();
  });

  it('refuses provenance-stamping a candidate with an out-of-range confidence', async () => {
    const { tenantId, actorId } = await seedTenant();

    await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Bad confidence' },
        source: 'test',
        confidence: 1.5,
      });
      await expect(run(tx, opened.id)).rejects.toThrow(BrainWritePathError);
    });
  });
});

describe('contradiction resolution (step 3)', () => {
  it('auto-supersedes when the new candidate has strictly higher confidence', async () => {
    const { tenantId, actorId } = await seedTenant();

    const committed = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_AUTO',
          label: 'Low confidence',
        },
        source: 'test',
        confidence: 0.3,
      });
      return run(tx, opened.id);
    });
    expect(committed.status).toBe('RETENTION_SCHEDULED');

    const superseding = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_AUTO',
          label: 'High confidence, no supersedes declared',
        },
        source: 'test',
        confidence: 0.9,
      });
      return run(tx, opened.id);
    });

    expect(superseding.status).toBe('RETENTION_SCHEDULED');
    expect(superseding.contradictionOf).toBe(committed.committedRowId);
    expect(superseding.contradictionResolution).toBe('ACCEPT_NEW');

    // No queue entry: an auto-resolved conflict never becomes a human's problem.
    const openConflicts = await withTenant({ tenantId, actorId }, (tx) =>
      listOpenBrainConflicts(tx),
    );
    expect(openConflicts).toHaveLength(0);

    const supersededRow = await withTenant({ tenantId, actorId }, (tx) =>
      tx.brainNode.findFirstOrThrow({ where: { id: superseding.committedRowId! } }),
    );
    expect(supersededRow.supersedes).toBe(committed.committedRowId);
  });

  it('enqueues an unresolvable conflict, and a human resolving ACCEPT_NEW unblocks it', async () => {
    const { tenantId, actorId } = await seedTenant();

    const committed = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_HUMAN',
          label: 'Original',
        },
        source: 'test',
      });
      return run(tx, opened.id);
    });

    const stuckId = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_HUMAN',
          label: 'Weaker claim',
        },
        source: 'test',
        confidence: 0.2,
      });
      await expect(run(tx, opened.id)).rejects.toThrow(BrainWritePathError);
      return opened.id;
    });

    const conflict = await withTenant({ tenantId, actorId }, async (tx) => {
      const open = await listOpenBrainConflicts(tx);
      const found = open.find((c) => c.writeCandidateId === stuckId);
      expect(found).toBeDefined();
      return found!;
    });

    const resolvedAt = new Date('2026-05-01T00:00:00.000Z');
    await withTenant({ tenantId, actorId }, (tx) =>
      resolveConflict(tx, conflict.id, 'ACCEPT_NEW', actorId, resolvedAt),
    );

    const finished = await withTenant({ tenantId, actorId }, (tx) => run(tx, stuckId));
    expect(finished.status).toBe('RETENTION_SCHEDULED');
    expect(finished.contradictionResolution).toBe('ACCEPT_NEW');
    expect(finished.committedRowId).not.toBe(committed.committedRowId);

    const supersededRow = await withTenant({ tenantId, actorId }, (tx) =>
      tx.brainNode.findFirstOrThrow({ where: { id: finished.committedRowId! } }),
    );
    expect(supersededRow.supersedes).toBe(committed.committedRowId);
  });

  it('enqueues an unresolvable conflict, and a human resolving KEEP_EXISTING stops it for good', async () => {
    const { tenantId, actorId } = await seedTenant();

    await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_REJECT',
          label: 'Original',
        },
        source: 'test',
      });
      return run(tx, opened.id);
    });

    const stuckId = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          entityType: 'LEARNER',
          externalRef: 'LNR_REJECT',
          label: 'Weaker claim',
        },
        source: 'test',
        confidence: 0.2,
      });
      await expect(run(tx, opened.id)).rejects.toThrow(BrainWritePathError);
      return opened.id;
    });

    const conflict = await withTenant({ tenantId, actorId }, async (tx) => {
      const open = await listOpenBrainConflicts(tx);
      const found = open.find((c) => c.writeCandidateId === stuckId);
      expect(found).toBeDefined();
      return found!;
    });

    const resolvedAt = new Date('2026-05-01T00:00:00.000Z');
    await withTenant({ tenantId, actorId }, (tx) =>
      resolveConflict(tx, conflict.id, 'KEEP_EXISTING', actorId, resolvedAt),
    );

    await withTenant({ tenantId, actorId }, async (tx) => {
      await expect(run(tx, stuckId)).rejects.toThrow(BrainWritePathError);
      const rows = await listOpenWrites(tx);
      const stuck = rows.find((c) => c.id === stuckId);
      expect(stuck?.status).toBe('CONTRADICTION_CHECKED');
      expect(stuck?.contradictionResolution).toBe('KEEP_EXISTING');
    });
  });
});

describe('the write path audit trail (step 7)', () => {
  it('logs every transition onto an append-only, verifiably-chained ledger', async () => {
    const { tenantId, actorId } = await seedTenant();

    const candidateId = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Audited fact' },
        source: 'test',
        createdBy: actorId,
      });
      await run(tx, opened.id);
      return opened.id;
    });

    const events = await withTenant({ tenantId, actorId }, (tx) =>
      tx.auditEvent.findMany({
        where: { resourceId: candidateId },
        orderBy: { at: 'asc' },
      }),
    );

    // candidate -> extracted -> contradiction_checked -> provenance_stamped -> committed
    // -> indexed -> retention_scheduled: one audit event per transition, six in total
    // (opening the candidate itself is not a transition `advanceBrainWrite` persists).
    expect(events.map((e) => e.action)).toEqual([
      'brain_write_extracted',
      'brain_write_contradiction_checked',
      'brain_write_provenance_stamped',
      'brain_write_committed',
      'brain_write_indexed',
      'brain_write_retention_scheduled',
    ]);
    expect(events.every((e) => e.resourceType === 'L1_NODE')).toBe(true);
    expect(events.every((e) => e.actorId === actorId)).toBe(true);

    const committedEvent = events.find((e) => e.action === 'brain_write_committed')!;
    expect((committedEvent.diff as Record<string, unknown>).committedRowId).toEqual(
      expect.any(String),
    );

    const chained: ChainedAuditEvent[] = events.map((row) => ({
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
    }));
    expect(verifyChain(chained)).toEqual({ intact: true, length: chained.length });
  });

  it('logs ratification onto the same ledger', async () => {
    const { tenantId, actorId } = await seedTenant();
    const ratifiedAt = new Date('2026-03-01T00:00:00.000Z');

    const candidateId = await withTenant({ tenantId, actorId }, async (tx) => {
      const opened = await openWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key: `audit_test_${randomUUID().slice(0, 8)}`,
          kind: 'ASSESSMENT_POLICY',
          content: { rule: 'x' },
        },
        source: 'test',
      });
      await run(tx, opened.id);
      await ratify(tx, opened.id, actorId, ratifiedAt);
      return opened.id;
    });

    const ratifiedEvent = await withTenant({ tenantId, actorId }, (tx) =>
      tx.auditEvent.findFirst({
        where: { resourceId: candidateId, action: 'brain_write_ratified' },
      }),
    );

    expect(ratifiedEvent).not.toBeNull();
    expect(ratifiedEvent?.actorId).toBe(actorId);
    expect((ratifiedEvent?.diff as Record<string, unknown>).ratifiedBy).toBe(actorId);
  });
});
