// The write path's orchestrator — Stage 05 step 2.
//
// `candidate → extracted+typed → contradiction-checked → provenance-stamped →
// (ratify if L0/L3) → committed+versioned → indexed → retention-scheduled`. This module
// decides what each transition actually does; `@infinite-ai/db`'s `brain-write-path.ts` is
// the imperative shell that persists the result, and `write-path-state-machine.ts` is the
// pure ordering both of them defer to.
//
// `advanceOnce` is the unit of resumable work: it reads a candidate's current status,
// performs exactly the one transition that status implies, and persists it before
// returning. A process that dies between two calls leaves the candidate at whatever
// `advanceOnce` last persisted — resuming means calling `advanceOnce` (or `run`) again with
// the same `candidateId`, not restarting from `openWrite`.
//
// Step 7's "append-only event log for all Brain writes": `brain_write_candidate` is
// deliberately mutable — each transition overwrites `status` in place, so a failed run can
// resume rather than restart (see this module's own header above, and the schema's
// comment on that table). That means the row itself, once a later transition has moved
// past an earlier one, no longer shows what it went through to get there. Every
// `advanceBrainWrite` call in this file is now paired with an `appendAuditEvent` call
// (`auditedAdvance`, below) onto the same tenant-scoped, hash-chained ledger step 6's
// `getFactProvenance` and Stage 02's ledger already share — an append-only record of the
// journey the mutable candidate row itself does not preserve.

import {
  advanceBrainWrite,
  appendAuditEvent,
  commitBrainFact,
  enqueueBrainConflict,
  findEffectiveBrainFact,
  getBrainWriteCandidate,
  listOpenBrainWrites,
  openBrainWrite,
  ratifyBrainWrite,
  resolveBrainConflict,
  type BrainConflictResolution,
  type BrainConflictRow,
  type BrainFactToCommit,
  type BrainWriteCandidateInput,
  type BrainWriteCandidateRow,
  type BrainWriteTransition,
  type TenantClient,
} from '@infinite-ai/db';

import { extractTyped, type ExtractedPayload } from './write-path-schemas.js';
import {
  decideContradiction,
  requiresRatification,
  resolveContradiction,
  type Provenance,
} from './write-path-state-machine.js';

export class BrainWritePathError extends Error {
  public override readonly name = 'BrainWritePathError';
  constructor(message: string) {
    super(message);
  }
}

/** Opens a new candidate. The only way a fact starts its journey through the Brain. */
export async function openWrite(
  tx: TenantClient,
  input: BrainWriteCandidateInput,
): Promise<BrainWriteCandidateRow> {
  return openBrainWrite(tx, input);
}

/** Every candidate still mid-pipeline, oldest first — what a resuming worker polls. */
export async function listOpenWrites(
  tx: TenantClient,
): Promise<readonly BrainWriteCandidateRow[]> {
  return listOpenBrainWrites(tx);
}

/** Records who ratified an `L0_CONSTITUTION`/`L3_PROCEDURE` candidate, and when. */
export async function ratify(
  tx: TenantClient,
  candidateId: string,
  ratifiedBy: string,
  ratifiedAt: Date,
): Promise<BrainWriteCandidateRow> {
  const updated = await ratifyBrainWrite(tx, candidateId, ratifiedBy, ratifiedAt);
  await appendAuditEvent(tx, {
    actorId: ratifiedBy,
    action: 'brain_write_ratified',
    resourceType: updated.targetTier,
    resourceId: candidateId,
    purpose: null,
    traceId: updated.traceId,
    diff: { ratifiedBy, ratifiedAt: ratifiedAt.toISOString() },
    at: ratifiedAt,
    createdBy: updated.createdBy,
  });
  return updated;
}

/**
 * `advanceBrainWrite`, paired with an `appendAuditEvent` call onto the same ledger — see
 * this module's own header for why. `diff` never includes a candidate's actual payload
 * content (rule 4's boundary, restated the same way `erasure.ts`'s own audit write already
 * holds itself to): only the transition's own structural fields.
 */
async function auditedAdvance(
  tx: TenantClient,
  candidate: BrainWriteCandidateRow,
  transition: BrainWriteTransition,
  now: Date,
): Promise<BrainWriteCandidateRow> {
  const updated = await advanceBrainWrite(tx, candidate.id, transition, now);
  await appendAuditEvent(tx, {
    actorId: candidate.createdBy,
    action: `brain_write_${transition.toStatus.toLowerCase()}`,
    resourceType: candidate.targetTier,
    resourceId: candidate.id,
    purpose: null,
    traceId: candidate.traceId,
    diff: transitionDiff(transition),
    at: now,
    createdBy: candidate.createdBy,
  });
  return updated;
}

function transitionDiff(transition: BrainWriteTransition): Record<string, unknown> {
  switch (transition.toStatus) {
    case 'CONTRADICTION_CHECKED':
      return {
        toStatus: transition.toStatus,
        contradictionOf: transition.contradictionOf,
        contradictionResolution: transition.contradictionResolution,
      };
    case 'COMMITTED':
      return {
        toStatus: transition.toStatus,
        committedRowId: transition.committedRowId,
        committedVersion: transition.committedVersion,
      };
    case 'RETENTION_SCHEDULED':
      return {
        toStatus: transition.toStatus,
        retentionCategory: transition.retentionCategory,
        retentionRuleId: transition.retentionRuleId,
      };
    case 'EXTRACTED':
    case 'PROVENANCE_STAMPED':
    case 'AWAITING_RATIFICATION':
    case 'INDEXED':
      return { toStatus: transition.toStatus };
  }
}

/**
 * Performs exactly the one transition implied by a candidate's current status, and
 * persists it. Returns the candidate unchanged if it is already `RETENTION_SCHEDULED`
 * (finished) or `AWAITING_RATIFICATION` with nobody having ratified it yet (a human's
 * job, not this function's).
 */
export async function advanceOnce(
  tx: TenantClient,
  candidateId: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const candidate = await getBrainWriteCandidate(tx, candidateId);
  if (candidate === null) {
    throw new BrainWritePathError(`No write candidate ${candidateId} in this tenant.`);
  }

  switch (candidate.status) {
    case 'CANDIDATE': {
      const extracted = extractTyped(candidate.targetTier, candidate.rawPayload);
      return auditedAdvance(
        tx,
        candidate,
        { toStatus: 'EXTRACTED', typedPayload: extracted.payload },
        now,
      );
    }
    case 'EXTRACTED': {
      const check = await checkContradiction(tx, candidate);
      const updated = await auditedAdvance(
        tx,
        candidate,
        {
          toStatus: 'CONTRADICTION_CHECKED',
          contradictionOf: check.contradictionOf,
          contradictionResolution: check.contradictionResolution,
        },
        now,
      );
      // A conflict provenance comparison could not resolve automatically is enqueued for
      // a human in the same breath it is detected — never as a separate step a caller
      // could skip.
      if (check.contradictionOf !== null && check.contradictionResolution === null) {
        await enqueueBrainConflict(tx, {
          writeCandidateId: candidateId,
          targetTier: candidate.targetTier,
          contradictionOf: check.contradictionOf,
          newConfidence: check.conflict!.newConfidence,
          existingConfidence: check.conflict!.existingConfidence,
          newRecency: check.conflict!.newRecency,
          existingRecency: check.conflict!.existingRecency,
          createdBy: candidate.createdBy,
        });
      }
      return updated;
    }
    case 'CONTRADICTION_CHECKED': {
      if (
        candidate.contradictionOf !== null &&
        candidate.contradictionResolution === null
      ) {
        throw new BrainWritePathError(
          `Candidate ${candidateId} conflicts with an existing fact ` +
            `(${candidate.contradictionOf}) that provenance comparison did not clearly ` +
            `resolve in its favour. Enqueued for a human; refusing to commit over it silently.`,
        );
      }
      if (candidate.contradictionResolution === 'KEEP_EXISTING') {
        throw new BrainWritePathError(
          `Candidate ${candidateId}'s conflict was resolved against it. It stops here.`,
        );
      }
      validateProvenance(candidate);
      return auditedAdvance(tx, candidate, { toStatus: 'PROVENANCE_STAMPED' }, now);
    }
    case 'PROVENANCE_STAMPED': {
      if (requiresRatification(candidate.targetTier)) {
        return auditedAdvance(tx, candidate, { toStatus: 'AWAITING_RATIFICATION' }, now);
      }
      return commitAndAdvance(tx, candidate, now);
    }
    case 'AWAITING_RATIFICATION': {
      if (candidate.ratifiedBy === null || candidate.ratifiedAt === null) {
        return candidate;
      }
      return commitAndAdvance(tx, candidate, now);
    }
    case 'COMMITTED':
      return auditedAdvance(tx, candidate, { toStatus: 'INDEXED' }, now);
    case 'INDEXED': {
      // Deliberately not invented here. Assigning a fact a personal-information category
      // and matching it to a ratified `RetentionRule` is step 8's "forgetting by design" —
      // this transition still runs and is still persisted, the same way step 1 shipped
      // `brain_embedding` with no fixed dimension rather than inventing one. See
      // docs/STAGE_LOG.md.
      return auditedAdvance(
        tx,
        candidate,
        {
          toStatus: 'RETENTION_SCHEDULED',
          retentionCategory: null,
          retentionRuleId: null,
        },
        now,
      );
    }
    case 'RETENTION_SCHEDULED':
      return candidate;
  }
}

/**
 * Drives a candidate through every transition it can currently make, stopping only where
 * `advanceOnce` itself would stop: `RETENTION_SCHEDULED` (finished) or
 * `AWAITING_RATIFICATION` with no ratification recorded yet.
 */
export async function run(
  tx: TenantClient,
  candidateId: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  for (;;) {
    const before = await getBrainWriteCandidate(tx, candidateId);
    if (before === null) {
      throw new BrainWritePathError(`No write candidate ${candidateId} in this tenant.`);
    }
    if (before.status === 'RETENTION_SCHEDULED') return before;
    if (before.status === 'AWAITING_RATIFICATION' && before.ratifiedBy === null)
      return before;
    await advanceOnce(tx, candidateId, now);
  }
}

function validateProvenance(candidate: BrainWriteCandidateRow): void {
  if (candidate.confidence < 0 || candidate.confidence > 1) {
    throw new BrainWritePathError(
      `Candidate ${candidate.id} has an out-of-range confidence (${candidate.confidence}); ` +
        'provenance must be a genuine confidence in [0, 1].',
    );
  }
}

interface ContradictionCheck {
  readonly contradictionOf: string | null;
  /** Null while unresolved — either no conflict was found, or one still awaits a human. */
  readonly contradictionResolution: BrainConflictResolution | null;
  /** Set only alongside a non-null `contradictionOf`, for the conflict queue entry. */
  readonly conflict: {
    readonly newConfidence: number;
    readonly existingConfidence: number;
    readonly newRecency: Date;
    readonly existingRecency: Date;
  } | null;
}

const NO_CONTRADICTION: ContradictionCheck = {
  contradictionOf: null,
  contradictionResolution: null,
  conflict: null,
};

async function checkContradiction(
  tx: TenantClient,
  candidate: BrainWriteCandidateRow,
): Promise<ContradictionCheck> {
  const extracted = extractTyped(candidate.targetTier, candidate.typedPayload);
  switch (extracted.targetTier) {
    // Versioned canon always supersedes its previous version automatically — that is what
    // versioning *is* — and episodes have no natural key to conflict against. See
    // write-path-state-machine.ts's own comment on `decideContradiction`.
    case 'L0_CONSTITUTION':
    case 'L3_PROCEDURE':
    case 'L2_EPISODE':
      return NO_CONTRADICTION;
    case 'L1_NODE': {
      if (extracted.payload.externalRef === null) return NO_CONTRADICTION;
      const existing = await findEffectiveBrainFact(tx, {
        targetTier: 'L1_NODE',
        entityType: extracted.payload.entityType,
        externalRef: extracted.payload.externalRef,
      });
      return resolveIfContradiction(candidate, extracted.payload.supersedes, existing);
    }
    case 'L1_EDGE': {
      const existing = await findEffectiveBrainFact(tx, {
        targetTier: 'L1_EDGE',
        sourceId: extracted.payload.sourceId,
        targetId: extracted.payload.targetId,
        relation: extracted.payload.relation,
      });
      return resolveIfContradiction(candidate, extracted.payload.supersedes, existing);
    }
  }
}

/**
 * The full step 3 sequence for one natural-key lookup: detect, and if a conflict is
 * found, immediately try to resolve it by provenance comparison. `existing.provenance` is
 * always present here — it is only absent on the `L0_CONSTITUTION`/`L3_PROCEDURE` branches
 * of `findEffectiveBrainFact`, neither of which calls this function.
 */
function resolveIfContradiction(
  candidate: BrainWriteCandidateRow,
  declaredSupersedes: string | null,
  existing: { readonly id: string; readonly provenance?: Provenance } | null,
): ContradictionCheck {
  const decision = decideContradiction(declaredSupersedes, existing);
  if (decision.contradictionOf === null || existing?.provenance === undefined) {
    return NO_CONTRADICTION;
  }

  const candidateProvenance: Provenance = {
    confidence: candidate.confidence,
    recency: candidate.createdAt,
  };
  const verdict = resolveContradiction(candidateProvenance, existing.provenance);
  return {
    contradictionOf: decision.contradictionOf,
    contradictionResolution: verdict === 'AUTO_SUPERSEDE' ? 'ACCEPT_NEW' : null,
    conflict: {
      newConfidence: candidateProvenance.confidence,
      existingConfidence: existing.provenance.confidence,
      newRecency: candidateProvenance.recency,
      existingRecency: existing.provenance.recency,
    },
  };
}

async function commitAndAdvance(
  tx: TenantClient,
  candidate: BrainWriteCandidateRow,
  now: Date,
): Promise<BrainWriteCandidateRow> {
  const fact = buildFactToCommit(candidate);
  const committed = await commitBrainFact(tx, fact);
  return auditedAdvance(
    tx,
    candidate,
    {
      toStatus: 'COMMITTED',
      committedRowId: committed.id,
      committedVersion: committed.version,
    },
    now,
  );
}

function buildFactToCommit(candidate: BrainWriteCandidateRow): BrainFactToCommit {
  const extracted: ExtractedPayload = extractTyped(
    candidate.targetTier,
    candidate.typedPayload,
  );
  const provenance = {
    source: candidate.source,
    confidence: candidate.confidence,
    derivationRunId: candidate.derivationRunId,
    traceId: candidate.traceId,
    createdBy: candidate.createdBy,
  };

  switch (extracted.targetTier) {
    case 'L0_CONSTITUTION': {
      const ratification = requireRatification(candidate);
      return {
        targetTier: 'L0_CONSTITUTION',
        key: extracted.payload.key,
        kind: extracted.payload.kind,
        content: extracted.payload.content,
        ...ratification,
        createdBy: candidate.createdBy,
      };
    }
    case 'L3_PROCEDURE': {
      const ratification = requireRatification(candidate);
      return {
        targetTier: 'L3_PROCEDURE',
        kind: extracted.payload.kind,
        ref: extracted.payload.ref,
        content: extracted.payload.content,
        ...ratification,
        createdBy: candidate.createdBy,
      };
    }
    case 'L1_NODE':
      return {
        targetTier: 'L1_NODE',
        entityType: extracted.payload.entityType,
        externalRef: extracted.payload.externalRef,
        label: extracted.payload.label,
        attributes: extracted.payload.attributes,
        supersedes: resolvedSupersedes(candidate, extracted.payload.supersedes),
        ...provenance,
      };
    case 'L1_EDGE':
      return {
        targetTier: 'L1_EDGE',
        sourceId: extracted.payload.sourceId,
        targetId: extracted.payload.targetId,
        relation: extracted.payload.relation,
        attributes: extracted.payload.attributes,
        supersedes: resolvedSupersedes(candidate, extracted.payload.supersedes),
        ...provenance,
      };
    case 'L2_EPISODE':
      return {
        targetTier: 'L2_EPISODE',
        eventType: extracted.payload.eventType,
        subjectNodeId: extracted.payload.subjectNodeId,
        actorId: extracted.payload.actorId,
        occurredAt: extracted.payload.occurredAt,
        summary: extracted.payload.summary,
        detail: extracted.payload.detail,
        outcome: extracted.payload.outcome,
        supersedes: extracted.payload.supersedes,
        ...provenance,
      };
  }
}

function requireRatification(candidate: BrainWriteCandidateRow): {
  readonly ratifiedBy: string;
  readonly ratifiedAt: Date;
} {
  if (candidate.ratifiedBy === null || candidate.ratifiedAt === null) {
    // Defence in depth only: `advanceBrainWrite` already refuses to move a ratified tier
    // to COMMITTED without both fields set, so this should be unreachable.
    throw new BrainWritePathError(
      `Candidate ${candidate.id} reached commit with no ratification recorded.`,
    );
  }
  return { ratifiedBy: candidate.ratifiedBy, ratifiedAt: candidate.ratifiedAt };
}

/**
 * What this candidate's commit should set `supersedes` to: its own declaration if it made
 * one, or the conflict it was resolved to accept over, or null when neither applies. Only
 * ever reached once `advanceOnce`'s own guards have already refused to let an unresolved
 * or rejected conflict get this far.
 */
function resolvedSupersedes(
  candidate: BrainWriteCandidateRow,
  declaredSupersedes: string | null,
): string | null {
  return declaredSupersedes ?? candidate.contradictionOf;
}

/**
 * Records a human's decision on a queued conflict — the counterpart to the automatic
 * resolution `advanceOnce` already tries first. Resolving `ACCEPT_NEW` unblocks the write
 * candidate that raised it; the next `run()`/`advanceOnce()` on it proceeds normally.
 * `KEEP_EXISTING` stops that candidate permanently.
 */
export async function resolveConflict(
  tx: TenantClient,
  conflictId: string,
  resolution: BrainConflictResolution,
  resolvedBy: string,
  resolvedAt: Date,
  resolutionNote: string | null = null,
): Promise<BrainConflictRow> {
  const resolved = await resolveBrainConflict(
    tx,
    conflictId,
    resolution,
    resolvedBy,
    resolvedAt,
    resolutionNote,
  );
  await appendAuditEvent(tx, {
    actorId: resolvedBy,
    action: 'brain_conflict_resolved',
    resourceType: resolved.targetTier,
    resourceId: resolved.writeCandidateId,
    purpose: null,
    traceId: null,
    diff: {
      conflictId,
      resolution,
      contradictionOf: resolved.contradictionOf,
      resolutionNote,
    },
    at: resolvedAt,
    createdBy: resolved.createdBy,
  });
  return resolved;
}
