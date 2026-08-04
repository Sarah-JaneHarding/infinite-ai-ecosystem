// The Brain write path's persistence primitives — Stage 05 step 2.
//
// `candidate → extracted+typed → contradiction-checked → provenance-stamped →
// (ratify if L0/L3) → committed+versioned → indexed → retention-scheduled`, exactly the
// manual's own transition list, backed by `brain_write_candidate` (see the schema's own
// comment for why that table is mutable rather than append-only).
//
// This module is the imperative shell, not the state machine. It knows how to persist one
// transition and how to write one committed fact; it does not decide which transition
// comes next, whether a candidate's payload is well-typed, or how a contradiction ought to
// be resolved — that sequencing and those decisions are `packages/brain`'s job, the same
// division of labour `@infinite-ai/policy` draws against `readLedger` in consent.ts. What
// this module does enforce, structurally, is that a transition cannot be persisted out of
// order and that a finished candidate cannot be advanced again — a database-layer guard
// against two callers racing the same candidate past each other, on top of whatever
// `packages/brain` already checked before calling in.
//
// `L1_EMBEDDING` has no commit path here. See the schema's own comment on
// `BrainTargetTier` for why a vector does not travel through this pipeline at all.

import type {
  BrainConstitutionKind,
  BrainEntityType,
  BrainProcedureKind,
  Prisma,
} from '@prisma/client';

import type { TenantClient } from './client.js';

export type BrainTargetTier =
  'L0_CONSTITUTION' | 'L1_NODE' | 'L1_EDGE' | 'L2_EPISODE' | 'L3_PROCEDURE';

export type BrainWriteStatus =
  | 'CANDIDATE'
  | 'EXTRACTED'
  | 'CONTRADICTION_CHECKED'
  | 'PROVENANCE_STAMPED'
  | 'AWAITING_RATIFICATION'
  | 'COMMITTED'
  | 'INDEXED'
  | 'RETENTION_SCHEDULED';

/** Tiers whose commit is gated on a human ratification — the manual's "(ratify if L0/L3)". */
const RATIFIED_TIERS: ReadonlySet<BrainTargetTier> = new Set([
  'L0_CONSTITUTION',
  'L3_PROCEDURE',
]);

export class BrainWriteError extends Error {
  public override readonly name = 'BrainWriteError';
  constructor(message: string) {
    super(message);
  }
}

export interface BrainWriteCandidateRow {
  readonly id: string;
  readonly tenantId: string;
  readonly targetTier: BrainTargetTier;
  readonly status: BrainWriteStatus;
  readonly rawPayload: unknown;
  readonly typedPayload: unknown;
  readonly source: string;
  readonly confidence: number;
  readonly derivationRunId: string | null;
  readonly traceId: string | null;
  readonly contradictionOf: string | null;
  readonly ratifiedBy: string | null;
  readonly ratifiedAt: Date | null;
  readonly committedRowId: string | null;
  readonly committedVersion: number | null;
  readonly retentionCategory: string | null;
  readonly retentionRuleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface BrainWriteCandidateInput {
  readonly targetTier: BrainTargetTier;
  /** The caller's input, verbatim, before extraction. */
  readonly rawPayload: unknown;
  readonly source: string;
  readonly confidence?: number;
  readonly derivationRunId?: string | null;
  readonly traceId?: string | null;
  readonly createdBy?: string | null;
}

/** Opens a new candidate at the pipeline's first status. Never any other status. */
export async function openBrainWrite(
  tx: TenantClient,
  input: BrainWriteCandidateInput,
): Promise<BrainWriteCandidateRow> {
  if (input.source.trim() === '') {
    throw new BrainWriteError('Refusing to open a write candidate with no source.');
  }
  const tenantId = await currentTenantId(tx);
  const created = await tx.brainWriteCandidate.create({
    data: {
      tenantId,
      targetTier: input.targetTier,
      rawPayload: input.rawPayload as Prisma.InputJsonValue,
      source: input.source,
      confidence: input.confidence ?? 1,
      derivationRunId: input.derivationRunId ?? null,
      traceId: input.traceId ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
  return created as BrainWriteCandidateRow;
}

/**
 * Reads the tenant the transaction is scoped to. Every `create()` in this module needs it
 * explicitly: Prisma does not infer a scalar `tenantId` from the session's RLS setting, so
 * a caller outside a tenant transaction fails here, with a sentence saying what is wrong,
 * rather than at whichever `NOT NULL` constraint happens to be the first one hit.
 */
async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new BrainWriteError('No tenant context on this transaction. Use withTenant.');
  }
  return tenantId;
}

export async function getBrainWriteCandidate(
  tx: TenantClient,
  id: string,
): Promise<BrainWriteCandidateRow | null> {
  const found = await tx.brainWriteCandidate.findFirst({ where: { id } });
  return found as BrainWriteCandidateRow | null;
}

/**
 * Every candidate not yet at the pipeline's terminal status.
 *
 * What a resuming worker polls after a crash: each row's `status` says exactly which
 * transition to attempt next, because that is what `advanceBrainWrite` persisted before
 * the process had a chance to die.
 */
export async function listOpenBrainWrites(
  tx: TenantClient,
): Promise<readonly BrainWriteCandidateRow[]> {
  const rows = await tx.brainWriteCandidate.findMany({
    where: { NOT: { status: 'RETENTION_SCHEDULED' } },
    orderBy: { createdAt: 'asc' },
  });
  return rows as BrainWriteCandidateRow[];
}

export type BrainWriteTransition =
  | { readonly toStatus: 'EXTRACTED'; readonly typedPayload: unknown }
  | {
      readonly toStatus: 'CONTRADICTION_CHECKED';
      readonly contradictionOf: string | null;
    }
  | { readonly toStatus: 'PROVENANCE_STAMPED' }
  | { readonly toStatus: 'AWAITING_RATIFICATION' }
  | {
      readonly toStatus: 'COMMITTED';
      readonly committedRowId: string;
      readonly committedVersion: number | null;
    }
  | { readonly toStatus: 'INDEXED' }
  | {
      readonly toStatus: 'RETENTION_SCHEDULED';
      readonly retentionCategory: string | null;
      readonly retentionRuleId: string | null;
    };

/** The status a transition may legally be persisted from. */
const REQUIRED_PREDECESSOR: Record<
  BrainWriteTransition['toStatus'],
  readonly BrainWriteStatus[]
> = {
  EXTRACTED: ['CANDIDATE'],
  CONTRADICTION_CHECKED: ['EXTRACTED'],
  PROVENANCE_STAMPED: ['CONTRADICTION_CHECKED'],
  AWAITING_RATIFICATION: ['PROVENANCE_STAMPED'],
  // Ratified tiers commit from AWAITING_RATIFICATION; every other tier commits directly
  // from PROVENANCE_STAMPED, having never entered AWAITING_RATIFICATION at all.
  COMMITTED: ['PROVENANCE_STAMPED', 'AWAITING_RATIFICATION'],
  INDEXED: ['COMMITTED'],
  RETENTION_SCHEDULED: ['INDEXED'],
};

/**
 * Persists one forward transition.
 *
 * Refuses a transition whose required predecessor status does not match the candidate's
 * current one — the structural guard against two callers advancing the same candidate out
 * of order, or a caller resuming a candidate that already finished. Refuses `COMMITTED` for
 * a ratified tier that skipped ratification, and refuses it if ratification is still
 * outstanding — the manual's "(ratify if L0/L3)" made concrete rather than trusted to the
 * caller.
 */
export async function advanceBrainWrite(
  tx: TenantClient,
  id: string,
  transition: BrainWriteTransition,
  now: Date,
): Promise<BrainWriteCandidateRow> {
  const candidate = await getBrainWriteCandidate(tx, id);
  if (candidate === null) {
    throw new BrainWriteError(`No write candidate ${id} in this tenant.`);
  }

  const allowed = REQUIRED_PREDECESSOR[transition.toStatus];
  if (!allowed.includes(candidate.status)) {
    throw new BrainWriteError(
      `Cannot move write candidate ${id} to ${transition.toStatus} from ${candidate.status}. ` +
        `Expected one of: ${allowed.join(', ')}.`,
    );
  }

  if (transition.toStatus === 'COMMITTED') {
    const requiresRatification = RATIFIED_TIERS.has(candidate.targetTier);
    if (requiresRatification && candidate.status !== 'AWAITING_RATIFICATION') {
      throw new BrainWriteError(
        `${candidate.targetTier} requires ratification before commit; ` +
          `candidate ${id} never entered AWAITING_RATIFICATION.`,
      );
    }
    if (
      candidate.status === 'AWAITING_RATIFICATION' &&
      (candidate.ratifiedBy === null || candidate.ratifiedAt === null)
    ) {
      throw new BrainWriteError(
        `Candidate ${id} is awaiting ratification and has not been ratified yet.`,
      );
    }
  }

  const data: Prisma.BrainWriteCandidateUncheckedUpdateInput = {
    status: transition.toStatus,
    updatedAt: now,
  };
  switch (transition.toStatus) {
    case 'EXTRACTED':
      data.typedPayload = transition.typedPayload as Prisma.InputJsonValue;
      break;
    case 'CONTRADICTION_CHECKED':
      data.contradictionOf = transition.contradictionOf;
      break;
    case 'COMMITTED':
      data.committedRowId = transition.committedRowId;
      data.committedVersion = transition.committedVersion;
      break;
    case 'RETENTION_SCHEDULED':
      data.retentionCategory = transition.retentionCategory;
      data.retentionRuleId = transition.retentionRuleId;
      break;
    case 'PROVENANCE_STAMPED':
    case 'AWAITING_RATIFICATION':
    case 'INDEXED':
      break;
  }

  const updated = await tx.brainWriteCandidate.update({ where: { id }, data });
  return updated as BrainWriteCandidateRow;
}

/** Records who ratified an `L0_CONSTITUTION`/`L3_PROCEDURE` candidate, and when. */
export async function ratifyBrainWrite(
  tx: TenantClient,
  id: string,
  ratifiedBy: string,
  ratifiedAt: Date,
): Promise<BrainWriteCandidateRow> {
  const candidate = await getBrainWriteCandidate(tx, id);
  if (candidate === null) {
    throw new BrainWriteError(`No write candidate ${id} in this tenant.`);
  }
  if (candidate.status !== 'AWAITING_RATIFICATION') {
    throw new BrainWriteError(
      `Candidate ${id} is ${candidate.status}, not AWAITING_RATIFICATION. Nothing to ratify.`,
    );
  }
  const updated = await tx.brainWriteCandidate.update({
    where: { id },
    data: { ratifiedBy, ratifiedAt, updatedAt: ratifiedAt },
  });
  return updated as BrainWriteCandidateRow;
}

// ---------------------------------------------------------------------------
// Contradiction detection — the current effective row for a natural key, if one exists.
// ---------------------------------------------------------------------------
//
// "Effective" means the head of the version/supersession chain: for L0/L3, the row with
// the highest version for that key; for L1, a row nothing else supersedes and that is not
// tombstoned. `L2_EPISODE` has no natural key at all — an episode is a new event by
// nature, and a correction to one is only ever explicit (the candidate declares which
// episode it supersedes), never inferred — so there is no lookup variant for it here.

export type BrainNaturalKey =
  | { readonly targetTier: 'L0_CONSTITUTION'; readonly key: string }
  | {
      readonly targetTier: 'L3_PROCEDURE';
      readonly kind: BrainProcedureKind;
      readonly ref: string;
    }
  | {
      readonly targetTier: 'L1_NODE';
      readonly entityType: BrainEntityType;
      readonly externalRef: string;
    }
  | {
      readonly targetTier: 'L1_EDGE';
      readonly sourceId: string;
      readonly targetId: string;
      readonly relation: string;
    };

export interface EffectiveBrainFact {
  readonly id: string;
  /** Null for L1 tiers, which have no version column. */
  readonly version: number | null;
}

export async function findEffectiveBrainFact(
  tx: TenantClient,
  key: BrainNaturalKey,
): Promise<EffectiveBrainFact | null> {
  switch (key.targetTier) {
    case 'L0_CONSTITUTION': {
      const row = await tx.brainConstitution.findFirst({
        where: { key: key.key },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      return row;
    }
    case 'L3_PROCEDURE': {
      const row = await tx.brainProcedure.findFirst({
        where: { kind: key.kind, ref: key.ref },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      return row;
    }
    case 'L1_NODE': {
      const row = await tx.brainNode.findFirst({
        where: {
          entityType: key.entityType,
          externalRef: key.externalRef,
          tombstonedAt: null,
          supersededByNodes: { none: {} },
        },
        select: { id: true },
      });
      return row === null ? null : { id: row.id, version: null };
    }
    case 'L1_EDGE': {
      const row = await tx.brainEdge.findFirst({
        where: {
          sourceId: key.sourceId,
          targetId: key.targetId,
          relation: key.relation,
          tombstonedAt: null,
          supersededByEdges: { none: {} },
        },
        select: { id: true },
      });
      return row === null ? null : { id: row.id, version: null };
    }
  }
}

// ---------------------------------------------------------------------------
// Committing — writing the actual row into one of the five target tables.
// ---------------------------------------------------------------------------

export type BrainFactToCommit =
  | {
      readonly targetTier: 'L0_CONSTITUTION';
      readonly key: string;
      readonly kind: BrainConstitutionKind;
      readonly content: unknown;
      readonly ratifiedBy: string;
      readonly ratifiedAt: Date;
      readonly createdBy: string | null;
    }
  | {
      readonly targetTier: 'L3_PROCEDURE';
      readonly kind: BrainProcedureKind;
      readonly ref: string;
      readonly content: unknown;
      readonly ratifiedBy: string;
      readonly ratifiedAt: Date;
      readonly createdBy: string | null;
    }
  | {
      readonly targetTier: 'L1_NODE';
      readonly entityType: BrainEntityType;
      readonly externalRef: string | null;
      readonly label: string;
      readonly attributes: unknown;
      readonly source: string;
      readonly confidence: number;
      readonly derivationRunId: string | null;
      readonly traceId: string | null;
      /** The row this candidate declared it corrects or replaces, if any. Never inferred. */
      readonly supersedes: string | null;
      readonly createdBy: string | null;
    }
  | {
      readonly targetTier: 'L1_EDGE';
      readonly sourceId: string;
      readonly targetId: string;
      readonly relation: string;
      readonly attributes: unknown;
      readonly source: string;
      readonly confidence: number;
      readonly derivationRunId: string | null;
      readonly traceId: string | null;
      readonly supersedes: string | null;
      readonly createdBy: string | null;
    }
  | {
      readonly targetTier: 'L2_EPISODE';
      readonly eventType: string;
      readonly subjectNodeId: string | null;
      readonly actorId: string | null;
      readonly occurredAt: Date;
      readonly summary: string;
      readonly detail: unknown;
      readonly outcome: string | null;
      readonly source: string;
      readonly confidence: number;
      readonly derivationRunId: string | null;
      readonly traceId: string | null;
      readonly supersedes: string | null;
      readonly createdBy: string | null;
    };

export interface CommittedBrainFact {
  readonly id: string;
  /** Null for tiers with no version column (everything but L0/L3). */
  readonly version: number | null;
}

/**
 * Writes `fact` into its target table. The one and only INSERT — L0/L3 read the current
 * version for their key first and increment it, wiring `supersedes` to whatever they just
 * read; a concurrent commit for the same key racing this one is caught by
 * `(tenant_id, key, version)`'s unique constraint (or the `(kind, ref, version)` one for
 * L3), which turns a lost update into a thrown error rather than a silently dropped
 * version — the same reasoning the rest of this schema gives the database for enforcing
 * invariants no application-level check alone can guarantee under concurrency.
 */
export async function commitBrainFact(
  tx: TenantClient,
  fact: BrainFactToCommit,
): Promise<CommittedBrainFact> {
  const tenantId = await currentTenantId(tx);
  switch (fact.targetTier) {
    case 'L0_CONSTITUTION': {
      const existing = await findEffectiveBrainFact(tx, {
        targetTier: 'L0_CONSTITUTION',
        key: fact.key,
      });
      const version = (existing?.version ?? 0) + 1;
      const created = await tx.brainConstitution.create({
        data: {
          tenantId,
          key: fact.key,
          kind: fact.kind,
          version,
          content: fact.content as Prisma.InputJsonValue,
          supersedes: existing?.id ?? null,
          ratifiedBy: fact.ratifiedBy,
          ratifiedAt: fact.ratifiedAt,
          createdBy: fact.createdBy,
        },
        select: { id: true, version: true },
      });
      return created;
    }
    case 'L3_PROCEDURE': {
      const existing = await findEffectiveBrainFact(tx, {
        targetTier: 'L3_PROCEDURE',
        kind: fact.kind,
        ref: fact.ref,
      });
      const version = (existing?.version ?? 0) + 1;
      const created = await tx.brainProcedure.create({
        data: {
          tenantId,
          kind: fact.kind,
          ref: fact.ref,
          version,
          content: fact.content as Prisma.InputJsonValue,
          supersedes: existing?.id ?? null,
          ratifiedBy: fact.ratifiedBy,
          ratifiedAt: fact.ratifiedAt,
          createdBy: fact.createdBy,
        },
        select: { id: true, version: true },
      });
      return created;
    }
    case 'L1_NODE': {
      const created = await tx.brainNode.create({
        data: {
          tenantId,
          entityType: fact.entityType,
          externalRef: fact.externalRef,
          label: fact.label,
          attributes: fact.attributes as Prisma.InputJsonValue,
          source: fact.source,
          confidence: fact.confidence,
          derivationRunId: fact.derivationRunId,
          traceId: fact.traceId,
          supersedes: fact.supersedes,
          createdBy: fact.createdBy,
        },
        select: { id: true },
      });
      return { id: created.id, version: null };
    }
    case 'L1_EDGE': {
      const created = await tx.brainEdge.create({
        data: {
          tenantId,
          sourceId: fact.sourceId,
          targetId: fact.targetId,
          relation: fact.relation,
          attributes: fact.attributes as Prisma.InputJsonValue,
          source: fact.source,
          confidence: fact.confidence,
          derivationRunId: fact.derivationRunId,
          traceId: fact.traceId,
          supersedes: fact.supersedes,
          createdBy: fact.createdBy,
        },
        select: { id: true },
      });
      return { id: created.id, version: null };
    }
    case 'L2_EPISODE': {
      const created = await tx.brainEpisode.create({
        data: {
          tenantId,
          eventType: fact.eventType,
          subjectNodeId: fact.subjectNodeId,
          actorId: fact.actorId,
          occurredAt: fact.occurredAt,
          summary: fact.summary,
          detail: fact.detail as Prisma.InputJsonValue,
          outcome: fact.outcome,
          source: fact.source,
          confidence: fact.confidence,
          derivationRunId: fact.derivationRunId,
          traceId: fact.traceId,
          supersedes: fact.supersedes,
          createdBy: fact.createdBy,
        },
        select: { id: true },
      });
      return { id: created.id, version: null };
    }
  }
}
