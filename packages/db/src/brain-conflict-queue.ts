// The conflict queue — Stage 05 step 3.
//
// "If the new fact would supersede a human-ratified fact, do not auto-resolve — enqueue a
// conflict for a human and keep both versions." A queue row is the record of that
// decision: which candidate conflicted with which existing fact, what the provenance
// comparison found, and — once a human has looked at it — what they decided.
//
// Resolving a queue entry is the only way `BrainWriteCandidate.contradictionResolution`
// gets set for a conflict that was not auto-resolved: `resolveBrainConflict` marks the
// queue entry resolved and calls straight through to `recordContradictionResolution`, so
// the two rows cannot drift out of step with each other — a resolved queue entry whose
// candidate never heard about it would be a decision nobody could act on.

import type { BrainConflictResolution, BrainTargetTier } from './brain-write-path.js';
import { recordContradictionResolution } from './brain-write-path.js';
import type { TenantClient } from './client.js';

export class BrainConflictError extends Error {
  public override readonly name = 'BrainConflictError';
  constructor(message: string) {
    super(message);
  }
}

export interface BrainConflictRow {
  readonly id: string;
  readonly tenantId: string;
  readonly writeCandidateId: string;
  readonly targetTier: BrainTargetTier;
  readonly contradictionOf: string;
  readonly newConfidence: number;
  readonly existingConfidence: number;
  readonly newRecency: Date;
  readonly existingRecency: Date;
  readonly status: 'OPEN' | 'RESOLVED';
  readonly resolution: BrainConflictResolution | null;
  readonly resolvedBy: string | null;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface BrainConflictInput {
  readonly writeCandidateId: string;
  readonly targetTier: BrainTargetTier;
  readonly contradictionOf: string;
  readonly newConfidence: number;
  readonly existingConfidence: number;
  readonly newRecency: Date;
  readonly existingRecency: Date;
  readonly createdBy?: string | null;
}

/**
 * Opens a conflict queue entry. Called once, from the write path's own
 * `CONTRADICTION_CHECKED` transition, exactly when provenance comparison could not
 * resolve the conflict automatically — never by a caller deciding a conflict is
 * interesting after the fact, since by then the candidate itself is already the record of
 * what conflicted with what.
 */
export async function enqueueBrainConflict(
  tx: TenantClient,
  input: BrainConflictInput,
): Promise<BrainConflictRow> {
  const tenantId = await currentTenantId(tx);
  const created = await tx.brainConflictQueue.create({
    data: {
      tenantId,
      writeCandidateId: input.writeCandidateId,
      targetTier: input.targetTier,
      contradictionOf: input.contradictionOf,
      newConfidence: input.newConfidence,
      existingConfidence: input.existingConfidence,
      newRecency: input.newRecency,
      existingRecency: input.existingRecency,
      createdBy: input.createdBy ?? null,
    },
  });
  return created as BrainConflictRow;
}

export async function getBrainConflict(
  tx: TenantClient,
  id: string,
): Promise<BrainConflictRow | null> {
  const found = await tx.brainConflictQueue.findFirst({ where: { id } });
  return found as BrainConflictRow | null;
}

/** Every conflict still awaiting a human's decision. */
export async function listOpenBrainConflicts(
  tx: TenantClient,
): Promise<readonly BrainConflictRow[]> {
  const rows = await tx.brainConflictQueue.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'asc' },
  });
  return rows as BrainConflictRow[];
}

/**
 * Records a human's decision on an open conflict, and unblocks (or permanently stops) the
 * write candidate that raised it in the same call — see the module header for why these
 * two writes are never split across two calls a caller could make out of order.
 */
export async function resolveBrainConflict(
  tx: TenantClient,
  id: string,
  resolution: BrainConflictResolution,
  resolvedBy: string,
  resolvedAt: Date,
  resolutionNote: string | null = null,
): Promise<BrainConflictRow> {
  const conflict = await getBrainConflict(tx, id);
  if (conflict === null) {
    throw new BrainConflictError(`No conflict ${id} in this tenant.`);
  }
  if (conflict.status !== 'OPEN') {
    throw new BrainConflictError(`Conflict ${id} is already ${conflict.status}.`);
  }

  const updated = await tx.brainConflictQueue.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolution,
      resolvedBy,
      resolvedAt,
      resolutionNote,
      updatedAt: resolvedAt,
    },
  });
  await recordContradictionResolution(
    tx,
    conflict.writeCandidateId,
    resolution,
    resolvedAt,
  );
  return updated as BrainConflictRow;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new BrainConflictError(
      'No tenant context on this transaction. Use withTenant.',
    );
  }
  return tenantId;
}
