// Provenance — Stage 05 step 6.
//
// Every fact table has stored its provenance columns since step 1 — source, confidence,
// derivation, trace ID, actor, timestamp — and the write path has stamped every one of
// them on every commit since step 2 (`buildFactToCommit`'s `provenance` object for L1/L2,
// `requireRatification` for L0/L3). What none of the five tables' shapes had until now is
// a single normalized *read*: five different column sets, one per tier, with no common
// shape a caller could ask "what is this fact's provenance?" against without already
// knowing which table it lives in and which columns that table happens to have.
// `getFactProvenance` is that normalization — the primitive step 9's `explain()` will walk
// `supersedes` with, not a chain-walker itself. Walking the supersession chain to build a
// full explanation is that later step's job; this one guarantees a single fact's own
// provenance is always readable in one shape, regardless of tier.
//
// Ratified tiers (L0/L3) have no `source`/`confidence`/`derivationRunId`/`traceId`: a
// ratified fact is canon, not a probabilistic extraction — the same reasoning
// `retrieval-assembly.ts`'s own header gives for why those tiers skip rerank's score
// entirely. `actorId` is populated only for L2, the one tier that distinguishes "who the
// event happened to/by" from "who or what wrote this row" (`createdBy`).

import type { TenantClient } from './client.js';
import type { BrainTargetTier } from './brain-write-path.js';

export interface FactProvenance {
  readonly id: string;
  readonly targetTier: BrainTargetTier;
  /** Null for `L0_CONSTITUTION`/`L3_PROCEDURE` — see the module header. */
  readonly source: string | null;
  readonly confidence: number | null;
  readonly derivationRunId: string | null;
  readonly traceId: string | null;
  /** Populated only for `L2_EPISODE`. */
  readonly actorId: string | null;
  readonly createdBy: string | null;
  /** The row's own creation timestamp — `recordedAt` for `L2_EPISODE`, `createdAt`
   * everywhere else, normalized to one field name here. */
  readonly createdAt: Date;
  /** Populated only for `L0_CONSTITUTION`/`L3_PROCEDURE`. */
  readonly ratifiedBy: string | null;
  readonly ratifiedAt: Date | null;
  /** Populated only for `L0_CONSTITUTION`/`L3_PROCEDURE`, which alone have a version
   * column — L1/L2 supersession has no version number, only a chain. */
  readonly version: number | null;
  readonly supersedes: string | null;
}

/**
 * The full provenance record for one committed fact, normalized across all five target
 * tiers. Null when `id` does not exist under `targetTier` in this tenant — including when
 * it exists under a *different* tier, which is deliberate: a caller that got the tier
 * wrong gets nothing, not another tier's row that happens to share a uuid.
 */
export async function getFactProvenance(
  tx: TenantClient,
  targetTier: BrainTargetTier,
  id: string,
): Promise<FactProvenance | null> {
  switch (targetTier) {
    case 'L0_CONSTITUTION': {
      const row = await tx.brainConstitution.findFirst({ where: { id } });
      if (row === null) return null;
      return {
        id: row.id,
        targetTier,
        source: null,
        confidence: null,
        derivationRunId: null,
        traceId: null,
        actorId: null,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        ratifiedBy: row.ratifiedBy,
        ratifiedAt: row.ratifiedAt,
        version: row.version,
        supersedes: row.supersedes,
      };
    }
    case 'L3_PROCEDURE': {
      const row = await tx.brainProcedure.findFirst({ where: { id } });
      if (row === null) return null;
      return {
        id: row.id,
        targetTier,
        source: null,
        confidence: null,
        derivationRunId: null,
        traceId: null,
        actorId: null,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        ratifiedBy: row.ratifiedBy,
        ratifiedAt: row.ratifiedAt,
        version: row.version,
        supersedes: row.supersedes,
      };
    }
    case 'L1_NODE': {
      const row = await tx.brainNode.findFirst({ where: { id } });
      if (row === null) return null;
      return {
        id: row.id,
        targetTier,
        source: row.source,
        confidence: row.confidence,
        derivationRunId: row.derivationRunId,
        traceId: row.traceId,
        actorId: null,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        ratifiedBy: null,
        ratifiedAt: null,
        version: null,
        supersedes: row.supersedes,
      };
    }
    case 'L1_EDGE': {
      const row = await tx.brainEdge.findFirst({ where: { id } });
      if (row === null) return null;
      return {
        id: row.id,
        targetTier,
        source: row.source,
        confidence: row.confidence,
        derivationRunId: row.derivationRunId,
        traceId: row.traceId,
        actorId: null,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        ratifiedBy: null,
        ratifiedAt: null,
        version: null,
        supersedes: row.supersedes,
      };
    }
    case 'L2_EPISODE': {
      const row = await tx.brainEpisode.findFirst({ where: { id } });
      if (row === null) return null;
      return {
        id: row.id,
        targetTier,
        source: row.source,
        confidence: row.confidence,
        derivationRunId: row.derivationRunId,
        traceId: row.traceId,
        actorId: row.actorId,
        createdBy: row.createdBy,
        createdAt: row.recordedAt,
        ratifiedBy: null,
        ratifiedAt: null,
        version: null,
        supersedes: row.supersedes,
      };
    }
  }
}
