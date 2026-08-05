// The write path's own transition order — Stage 05 step 2.
//
// Pure and DB-free on purpose: this is the one place "what comes after what" is decided,
// so a reordered pipeline is a one-function unit test rather than something only an
// integration run against real Postgres could catch. `write-path.ts` is the imperative
// shell that calls this to decide what to persist next.

import type { BrainTargetTier } from './write-path-schemas.js';

export type BrainWriteStatus =
  | 'CANDIDATE'
  | 'EXTRACTED'
  | 'CONTRADICTION_CHECKED'
  | 'PROVENANCE_STAMPED'
  | 'AWAITING_RATIFICATION'
  | 'COMMITTED'
  | 'INDEXED'
  | 'RETENTION_SCHEDULED';

/** The manual's own transition list, in order. */
export const WRITE_PATH_ORDER: readonly BrainWriteStatus[] = [
  'CANDIDATE',
  'EXTRACTED',
  'CONTRADICTION_CHECKED',
  'PROVENANCE_STAMPED',
  'AWAITING_RATIFICATION',
  'COMMITTED',
  'INDEXED',
  'RETENTION_SCHEDULED',
];

/** L0 Constitution and L3 Procedural are human-ratified; nothing else is. */
export function requiresRatification(targetTier: BrainTargetTier): boolean {
  return targetTier === 'L0_CONSTITUTION' || targetTier === 'L3_PROCEDURE';
}

/**
 * The status after `current`, for `targetTier`. Null once `current` is already the
 * pipeline's terminal status.
 *
 * `AWAITING_RATIFICATION`'s successor is always `COMMITTED` here — whether a *specific*
 * candidate is actually allowed to make that move yet (has it been ratified?) is not an
 * ordering question, so it is not this function's job; `write-path.ts` checks it before
 * calling in, and `advanceBrainWrite` in `@infinite-ai/db` checks it again before
 * persisting.
 */
export function nextStatus(
  current: BrainWriteStatus,
  targetTier: BrainTargetTier,
): BrainWriteStatus | null {
  switch (current) {
    case 'CANDIDATE':
      return 'EXTRACTED';
    case 'EXTRACTED':
      return 'CONTRADICTION_CHECKED';
    case 'CONTRADICTION_CHECKED':
      return 'PROVENANCE_STAMPED';
    case 'PROVENANCE_STAMPED':
      return requiresRatification(targetTier) ? 'AWAITING_RATIFICATION' : 'COMMITTED';
    case 'AWAITING_RATIFICATION':
      return 'COMMITTED';
    case 'COMMITTED':
      return 'INDEXED';
    case 'INDEXED':
      return 'RETENTION_SCHEDULED';
    case 'RETENTION_SCHEDULED':
      return null;
  }
}

export interface ExistingEffectiveFact {
  readonly id: string;
}

export interface ContradictionDecision {
  readonly contradictionOf: string | null;
}

/**
 * Whether an already-committed effective fact conflicts with this candidate.
 *
 * There is no conflict when nothing effective exists yet, or when the candidate already
 * declared exactly that row as what it supersedes — an explicit correction is not a
 * contradiction, it is the mechanism corrections use. Anything else — an effective row the
 * candidate did not know to name — is flagged. What happens *about* a flagged conflict
 * (compare provenance strength and recency; never auto-resolve over a human-ratified fact)
 * is step 3's job; this function only detects.
 */
export function decideContradiction(
  declaredSupersedes: string | null,
  existing: ExistingEffectiveFact | null,
): ContradictionDecision {
  if (existing === null) return { contradictionOf: null };
  if (declaredSupersedes === existing.id) return { contradictionOf: null };
  return { contradictionOf: existing.id };
}

// ---------------------------------------------------------------------------
// Contradiction resolution — Stage 05 step 3
// ---------------------------------------------------------------------------

export interface Provenance {
  readonly confidence: number;
  readonly recency: Date;
}

export type ContradictionVerdict = 'AUTO_SUPERSEDE' | 'ENQUEUE_FOR_HUMAN';

/**
 * The manual's own mechanism for a flagged conflict: "compare provenance strength and
 * recency." `AUTO_SUPERSEDE` only when the candidate's confidence is strictly higher than
 * the existing fact's, or tied and strictly more recent — anything less clear-cut is not
 * the new fact's to decide, so it is left for a human rather than guessed at.
 *
 * Never called for `L0_CONSTITUTION`/`L3_PROCEDURE`: those tiers never produce a
 * `contradictionOf` in the first place (`decideContradiction` is not consulted for them
 * either — see `write-path.ts`'s `checkContradiction`), because the manual's carve-out for
 * a human-ratified fact is already satisfied by the ratification gate every new version of
 * one already passes through.
 */
export function resolveContradiction(
  candidate: Provenance,
  existing: Provenance,
): ContradictionVerdict {
  if (candidate.confidence > existing.confidence) return 'AUTO_SUPERSEDE';
  if (
    candidate.confidence === existing.confidence &&
    candidate.recency.getTime() > existing.recency.getTime()
  ) {
    return 'AUTO_SUPERSEDE';
  }
  return 'ENQUEUE_FOR_HUMAN';
}
