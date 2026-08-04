// The write path's persistence primitives, against a real Postgres — Stage 05 step 2.
//
// packages/brain's own integration suite proves the orchestrator end to end, through
// these functions; this file proves these functions directly and on their own terms —
// the REQUIRED_PREDECESSOR guard, the ratification gate, both branches of
// findEffectiveBrainFact's L1 lookups, and commitBrainFact's versioning for each of the
// five target tiers. Connects as `app_rw`, not the container's superuser.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BrainWriteError,
  advanceBrainWrite,
  commitBrainFact,
  findEffectiveBrainFact,
  getBrainWriteCandidate,
  listOpenBrainWrites,
  openBrainWrite,
  ratifyBrainWrite,
  recordContradictionResolution,
} from '../src/brain-write-path.js';
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
        name: 'Write Path Test',
        slug: `write-path-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

describe('openBrainWrite', () => {
  it('opens a candidate at CANDIDATE, defaulting confidence and the optional fields', async () => {
    const candidate = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Fractions' },
        source: 'test',
      }),
    );
    expect(candidate.status).toBe('CANDIDATE');
    expect(candidate.confidence).toBe(1);
    expect(candidate.derivationRunId).toBeNull();
    expect(candidate.traceId).toBeNull();
    expect(candidate.createdBy).toBeNull();
  });

  it('carries explicit optional fields through unchanged', async () => {
    const derivationRunId = randomUUID();
    const createdBy = randomUUID();
    const candidate = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Ratios' },
        source: 'test',
        confidence: 0.5,
        derivationRunId,
        traceId: 'trace-1',
        createdBy,
      }),
    );
    expect(candidate.confidence).toBe(0.5);
    expect(candidate.derivationRunId).toBe(derivationRunId);
    expect(candidate.traceId).toBe('trace-1');
    expect(candidate.createdBy).toBe(createdBy);
  });

  it('refuses an empty source', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        openBrainWrite(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'TOPIC', label: 'x' },
          source: '   ',
        }),
      ),
    ).rejects.toThrow(BrainWriteError);
  });

  it('throws outside a tenant transaction', async () => {
    await expect(
      appRw.$transaction((tx) =>
        openBrainWrite(tx, {
          targetTier: 'L1_NODE',
          rawPayload: { entityType: 'TOPIC', label: 'x' },
          source: 'test',
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('getBrainWriteCandidate / listOpenBrainWrites', () => {
  it('returns null for an id that does not exist', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getBrainWriteCandidate(tx, randomUUID()),
    );
    expect(found).toBeNull();
  });

  it('lists a candidate until it reaches RETENTION_SCHEDULED, then drops it', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Listing test' },
        source: 'test',
      }),
    );

    const before = await asTenant(appRw, TENANT, ACTOR, (tx) => listOpenBrainWrites(tx));
    expect(before.map((c) => c.id)).toContain(opened.id);

    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
          contradictionOf: null,
          contradictionResolution: null,
        },
        NOW,
      );
      await advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW);
      const committed = await commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'TOPIC',
        externalRef: null,
        label: 'Listing test',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      await advanceBrainWrite(
        tx,
        opened.id,
        {
          toStatus: 'COMMITTED',
          committedRowId: committed.id,
          committedVersion: committed.version,
        },
        NOW,
      );
      await advanceBrainWrite(tx, opened.id, { toStatus: 'INDEXED' }, NOW);
      await advanceBrainWrite(
        tx,
        opened.id,
        {
          toStatus: 'RETENTION_SCHEDULED',
          retentionCategory: null,
          retentionRuleId: null,
        },
        NOW,
      );
    });

    const after = await asTenant(appRw, TENANT, ACTOR, (tx) => listOpenBrainWrites(tx));
    expect(after.map((c) => c.id)).not.toContain(opened.id);
  });
});

describe('advanceBrainWrite', () => {
  it('throws for an id that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        advanceBrainWrite(tx, randomUUID(), { toStatus: 'PROVENANCE_STAMPED' }, NOW),
      ),
    ).rejects.toThrow(BrainWriteError);
  });

  it('refuses a transition whose required predecessor does not match', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Out of order' },
        source: 'test',
      }),
    );
    // CANDIDATE cannot jump straight to PROVENANCE_STAMPED.
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW),
      ),
    ).rejects.toThrow(BrainWriteError);
  });

  it('refuses COMMITTED for a ratified tier that skipped AWAITING_RATIFICATION', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: { key: 'unratified-skip', kind: 'SCHOOL_POLICY', content: {} },
        source: 'test',
      }),
    );
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
          contradictionOf: null,
          contradictionResolution: null,
        },
        NOW,
      );
      await advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW);
    });
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        advanceBrainWrite(
          tx,
          opened.id,
          { toStatus: 'COMMITTED', committedRowId: randomUUID(), committedVersion: 1 },
          NOW,
        ),
      ),
    ).rejects.toThrow(/requires ratification/);
  });

  it('refuses COMMITTED while AWAITING_RATIFICATION and not yet ratified', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: { key: 'unratified-wait', kind: 'SCHOOL_POLICY', content: {} },
        source: 'test',
      }),
    );
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
          contradictionOf: null,
          contradictionResolution: null,
        },
        NOW,
      );
      await advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW);
      await advanceBrainWrite(tx, opened.id, { toStatus: 'AWAITING_RATIFICATION' }, NOW);
    });
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        advanceBrainWrite(
          tx,
          opened.id,
          { toStatus: 'COMMITTED', committedRowId: randomUUID(), committedVersion: 1 },
          NOW,
        ),
      ),
    ).rejects.toThrow(/not been ratified/);
  });

  it('commits from AWAITING_RATIFICATION once ratified', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: { key: 'ratified-commit', kind: 'SCHOOL_POLICY', content: {} },
        source: 'test',
      }),
    );
    const finished = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
          contradictionOf: null,
          contradictionResolution: null,
        },
        NOW,
      );
      await advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW);
      await advanceBrainWrite(tx, opened.id, { toStatus: 'AWAITING_RATIFICATION' }, NOW);
      await ratifyBrainWrite(tx, opened.id, ACTOR, NOW);
      const committed = await commitBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'ratified-commit',
        kind: 'SCHOOL_POLICY',
        content: {},
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      });
      return advanceBrainWrite(
        tx,
        opened.id,
        {
          toStatus: 'COMMITTED',
          committedRowId: committed.id,
          committedVersion: committed.version,
        },
        NOW,
      );
    });
    expect(finished.status).toBe('COMMITTED');
    expect(finished.committedVersion).toBe(1);
  });

  it('refuses PROVENANCE_STAMPED while a conflict is unresolved', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Unresolved conflict' },
        source: 'test',
      }),
    );
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
    });
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW),
      ),
    ).rejects.toThrow(/unresolved conflict/);
  });

  it('allows PROVENANCE_STAMPED once a conflict is resolved with ACCEPT_NEW', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Resolved conflict' },
        source: 'test',
      }),
    );
    const advanced = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
          contradictionResolution: 'ACCEPT_NEW',
        },
        NOW,
      );
      return advanceBrainWrite(tx, opened.id, { toStatus: 'PROVENANCE_STAMPED' }, NOW);
    });
    expect(advanced.status).toBe('PROVENANCE_STAMPED');
  });
});

describe('recordContradictionResolution', () => {
  it('throws for an id that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        recordContradictionResolution(tx, randomUUID(), 'ACCEPT_NEW', NOW),
      ),
    ).rejects.toThrow(BrainWriteError);
  });

  it('refuses a candidate with no unresolved conflict', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'No conflict' },
        source: 'test',
      }),
    );
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        recordContradictionResolution(tx, opened.id, 'ACCEPT_NEW', NOW),
      ),
    ).rejects.toThrow(/no unresolved conflict/);
  });

  it('refuses a conflict that was already resolved', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L1_NODE',
        rawPayload: { entityType: 'TOPIC', label: 'Already resolved' },
        source: 'test',
      }),
    );
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
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
      await recordContradictionResolution(tx, opened.id, 'KEEP_EXISTING', NOW);
    });
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        recordContradictionResolution(tx, opened.id, 'ACCEPT_NEW', NOW),
      ),
    ).rejects.toThrow(/already resolved/);
  });
});

describe('ratifyBrainWrite', () => {
  it('throws for an id that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        ratifyBrainWrite(tx, randomUUID(), ACTOR, NOW),
      ),
    ).rejects.toThrow(BrainWriteError);
  });

  it('refuses to ratify a candidate that is not AWAITING_RATIFICATION', async () => {
    const opened = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openBrainWrite(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: { key: 'not-awaiting', kind: 'SCHOOL_POLICY', content: {} },
        source: 'test',
      }),
    );
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) => ratifyBrainWrite(tx, opened.id, ACTOR, NOW)),
    ).rejects.toThrow(/Nothing to ratify/);
  });
});

describe('findEffectiveBrainFact', () => {
  it('returns null for an L0_CONSTITUTION key with nothing committed yet', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'never-committed',
      }),
    );
    expect(found).toBeNull();
  });

  it('finds the highest version for an L0_CONSTITUTION key', async () => {
    const first = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'effective-fact-l0',
        kind: 'SCHOOL_POLICY',
        content: {},
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'effective-fact-l0',
      }),
    );
    expect(found).toEqual({ id: first.id, version: 1 });
  });

  it('returns null for an L3_PROCEDURE (kind, ref) with nothing committed yet', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'SOP',
        ref: 'never-committed',
      }),
    );
    expect(found).toBeNull();
  });

  it('finds the highest version for an L3_PROCEDURE (kind, ref)', async () => {
    const first = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'SOP',
        ref: 'effective-fact-l3',
        content: {},
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'SOP',
        ref: 'effective-fact-l3',
      }),
    );
    expect(found).toEqual({ id: first.id, version: 1 });
  });

  it('returns null for an L1_NODE natural key with no effective row', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'LEARNER',
        externalRef: 'LNR_NEVER_COMMITTED',
      }),
    );
    expect(found).toBeNull();
  });

  it('finds an effective L1_NODE row by (entityType, externalRef)', async () => {
    const committed = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'LEARNER',
        externalRef: 'LNR_EFFECTIVE',
        label: 'A learner',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      }),
    );
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'LEARNER',
        externalRef: 'LNR_EFFECTIVE',
      }),
    );
    expect(found?.id).toBe(committed.id);
    expect(found?.version).toBeNull();
    expect(found?.provenance?.confidence).toBe(1);
    expect(found?.provenance?.recency).toBeInstanceOf(Date);
  });

  it('returns null for an L1_EDGE natural key with no effective row', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L1_EDGE',
        sourceId: randomUUID(),
        targetId: randomUUID(),
        relation: 'prerequisite_of',
      }),
    );
    expect(found).toBeNull();
  });

  it('finds an effective L1_EDGE row by (sourceId, targetId, relation)', async () => {
    const { sourceId, targetId, edgeId } = await asTenant(
      appRw,
      TENANT,
      ACTOR,
      async (tx) => {
        const source = await commitBrainFact(tx, {
          targetTier: 'L1_NODE',
          entityType: 'TOPIC',
          externalRef: null,
          label: 'Fractions',
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
          label: 'Decimals',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        const edge = await commitBrainFact(tx, {
          targetTier: 'L1_EDGE',
          sourceId: source.id,
          targetId: target.id,
          relation: 'prerequisite_of',
          attributes: {},
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        });
        return { sourceId: source.id, targetId: target.id, edgeId: edge.id };
      },
    );

    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      findEffectiveBrainFact(tx, {
        targetTier: 'L1_EDGE',
        sourceId,
        targetId,
        relation: 'prerequisite_of',
      }),
    );
    expect(found?.id).toBe(edgeId);
    expect(found?.version).toBeNull();
    expect(found?.provenance?.confidence).toBe(1);
  });
});

describe('commitBrainFact', () => {
  it('versions a second L0_CONSTITUTION commit for the same key and supersedes the first', async () => {
    const first = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'versioning-l0',
        kind: 'SCHOOL_POLICY',
        content: { v: 1 },
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    const second = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: 'versioning-l0',
        kind: 'SCHOOL_POLICY',
        content: { v: 2 },
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const row = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tx.brainConstitution.findFirstOrThrow({ where: { id: second.id } }),
    );
    expect(row.supersedes).toBe(first.id);
  });

  it('versions a second L3_PROCEDURE commit for the same (kind, ref) and supersedes the first', async () => {
    const first = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'SOP',
        ref: 'versioning-l3',
        content: { v: 1 },
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    const second = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: 'SOP',
        ref: 'versioning-l3',
        content: { v: 2 },
        ratifiedBy: ACTOR,
        ratifiedAt: NOW,
        createdBy: null,
      }),
    );
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const row = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tx.brainProcedure.findFirstOrThrow({ where: { id: second.id } }),
    );
    expect(row.supersedes).toBe(first.id);
  });

  it('commits an L1_EDGE fact between two committed nodes', async () => {
    const { edgeId } = await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      const source = await commitBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: 'TOPIC',
        externalRef: null,
        label: 'Edge source',
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
        label: 'Edge target',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      const edge = await commitBrainFact(tx, {
        targetTier: 'L1_EDGE',
        sourceId: source.id,
        targetId: target.id,
        relation: 'commit-test-relation',
        attributes: {},
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      });
      return { edgeId: edge.id };
    });
    expect(edgeId).toBeDefined();
  });

  it('commits an L2_EPISODE fact', async () => {
    const committed = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      commitBrainFact(tx, {
        targetTier: 'L2_EPISODE',
        eventType: 'commit-test-event',
        subjectNodeId: null,
        actorId: null,
        occurredAt: NOW,
        summary: 'A committed episode.',
        detail: {},
        outcome: null,
        source: 'test',
        confidence: 1,
        derivationRunId: null,
        traceId: null,
        supersedes: null,
        createdBy: null,
      }),
    );
    expect(committed.version).toBeNull();

    const row = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tx.brainEpisode.findFirstOrThrow({ where: { id: committed.id } }),
    );
    expect(row.eventType).toBe('commit-test-event');
  });

  it('throws outside a tenant transaction', async () => {
    await expect(
      appRw.$transaction((tx) =>
        commitBrainFact(tx, {
          targetTier: 'L2_EPISODE',
          eventType: 'no-tenant',
          subjectNodeId: null,
          actorId: null,
          occurredAt: NOW,
          summary: 'x',
          detail: {},
          outcome: null,
          source: 'test',
          confidence: 1,
          derivationRunId: null,
          traceId: null,
          supersedes: null,
          createdBy: null,
        }),
      ),
    ).rejects.toThrow();
  });
});
