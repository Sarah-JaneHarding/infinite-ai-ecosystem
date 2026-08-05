// The Brain's tombstone path — Stage 05 step 8 (forgetting by design).
//
// Rule 11: "Nothing is destructively updated in the Brain... Deletion happens only
// through the retention/tombstone path." That is a *distinct* path from the write path
// (Stage 05 step 2) on purpose: the write path is where an agent's own extracted facts
// go through extraction, contradiction-checking and (for L0/L3) ratification before they
// land; a tombstone is not a new fact an agent is proposing, it is the retention job (or a
// consent withdrawal) acting on a fact that already exists. Routing it back through the
// candidate state machine would mean contradiction-checking a fact against itself for no
// reason a caller could explain.
//
// So `tombstoneBrainFact` inserts directly: a new row, copying the original's content,
// with its own `tombstonedAt` set and `supersedes` pointing at the original. Nothing about
// the original row is ever touched — the append-only trigger would refuse it if this
// tried to. `vectorTopK`'s own `WHERE tombstoned_at IS NULL AND NOT EXISTS (... supersedes
// ...)` then excludes *both* rows from retrieval structurally: the original because
// something supersedes it, the tombstone because it is tombstoned itself. That is the
// entire "reindex" step 8 asks for — there is no separate search index for Brain nodes to
// update, only this one table and the query every retrieval already runs against it.
//
// Only `L1_NODE` and `L1_EDGE` are tombstonable here: they are the two tiers with a
// `tombstonedAt` column at all. `L2_EPISODE` has none — episodes are "what happened,"
// and step 8's own text does not ask for episode erasure the way it asks for node/edge
// tombstoning; extending the episode table is a follow-up, not invented here (see
// docs/STAGE_LOG.md). `L0_CONSTITUTION`/`L3_PROCEDURE` are never tombstonable at all:
// "policy and curriculum never expire" (step 8's own text), and neither table has the
// column either.

import type { Prisma } from '@prisma/client';

import { appendAuditEvent } from './audit.js';
import type { TenantClient } from './client.js';

export class BrainForgettingError extends Error {
  public override readonly name = 'BrainForgettingError';
  constructor(message: string) {
    super(message);
  }
}

export type TombstoneTargetTier = 'L1_NODE' | 'L1_EDGE';

/** Why this fact is being tombstoned — recorded in the audit event, and as `source` on
 * the tombstone row itself, so a reader of the row already knows without a join. */
export type TombstoneReason = 'retention_expired' | 'consent_withdrawn';

export interface TombstoneInput {
  readonly targetTier: TombstoneTargetTier;
  readonly id: string;
  readonly reason: TombstoneReason;
}

export interface TombstonedBrainFact {
  readonly id: string;
  readonly supersedes: string;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new BrainForgettingError(
      'No tenant context on this transaction. Use withTenant.',
    );
  }
  return tenantId;
}

/**
 * Tombstones one `L1_NODE`/`L1_EDGE` fact: a new row, copying the original's content, with
 * `tombstonedAt` set to `now` and `supersedes` pointing at the original. Refuses a fact
 * that does not exist, is itself already tombstoned, or has already been superseded by an
 * earlier tombstone — tombstoning is not idempotent by design, the same way
 * `advanceBrainWrite` refuses to re-run a finished transition: a second call on a fact
 * that is no longer effective is a caller bug to surface, not an update to swallow.
 */
export async function tombstoneBrainFact(
  tx: TenantClient,
  input: TombstoneInput,
  now: Date,
): Promise<TombstonedBrainFact> {
  const tenantId = await currentTenantId(tx);

  switch (input.targetTier) {
    case 'L1_NODE': {
      const original = await tx.brainNode.findFirst({ where: { id: input.id } });
      if (original === null) {
        throw new BrainForgettingError(`No L1_NODE ${input.id} in this tenant.`);
      }
      if (original.tombstonedAt !== null) {
        throw new BrainForgettingError(`L1_NODE ${input.id} is already tombstoned.`);
      }
      const supersededBy = await tx.brainNode.findFirst({
        where: { supersedes: original.id },
        select: { id: true },
      });
      if (supersededBy !== null) {
        throw new BrainForgettingError(
          `L1_NODE ${input.id} is no longer effective — already superseded by ${supersededBy.id}.`,
        );
      }
      const created = await tx.brainNode.create({
        data: {
          tenantId,
          entityType: original.entityType,
          externalRef: original.externalRef,
          label: original.label,
          attributes: original.attributes as Prisma.InputJsonValue,
          source: input.reason,
          confidence: original.confidence,
          derivationRunId: null,
          traceId: null,
          supersedes: original.id,
          tombstonedAt: now,
          createdBy: null,
        },
        select: { id: true },
      });
      await logTombstone(tx, 'L1_NODE', original.id, created.id, input.reason, now);
      return { id: created.id, supersedes: original.id };
    }
    case 'L1_EDGE': {
      const original = await tx.brainEdge.findFirst({ where: { id: input.id } });
      if (original === null) {
        throw new BrainForgettingError(`No L1_EDGE ${input.id} in this tenant.`);
      }
      if (original.tombstonedAt !== null) {
        throw new BrainForgettingError(`L1_EDGE ${input.id} is already tombstoned.`);
      }
      const supersededBy = await tx.brainEdge.findFirst({
        where: { supersedes: original.id },
        select: { id: true },
      });
      if (supersededBy !== null) {
        throw new BrainForgettingError(
          `L1_EDGE ${input.id} is no longer effective — already superseded by ${supersededBy.id}.`,
        );
      }
      const created = await tx.brainEdge.create({
        data: {
          tenantId,
          sourceId: original.sourceId,
          targetId: original.targetId,
          relation: original.relation,
          attributes: original.attributes as Prisma.InputJsonValue,
          source: input.reason,
          confidence: original.confidence,
          derivationRunId: null,
          traceId: null,
          supersedes: original.id,
          tombstonedAt: now,
          createdBy: null,
        },
        select: { id: true },
      });
      await logTombstone(tx, 'L1_EDGE', original.id, created.id, input.reason, now);
      return { id: created.id, supersedes: original.id };
    }
  }
}

async function logTombstone(
  tx: TenantClient,
  targetTier: TombstoneTargetTier,
  originalId: string,
  tombstoneId: string,
  reason: TombstoneReason,
  now: Date,
): Promise<void> {
  await appendAuditEvent(tx, {
    actorId: null,
    action: 'brain_fact_tombstoned',
    resourceType: targetTier,
    resourceId: originalId,
    purpose: null,
    traceId: null,
    diff: { reason, tombstoneId },
    at: now,
    createdBy: null,
  });
}
