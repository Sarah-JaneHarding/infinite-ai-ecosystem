// @infinite-ai/brain — Infinite Brain memory service: L0-L4, retrieval path, write path.
//
// L0-L3's tables live in packages/db (Stage 05 step 1), the same way every other
// tenant-owned table does — this package builds the typed API and pipeline logic on top
// of them. Step 1 built L4's Redis-shaped working memory, since it has no table of its
// own to add there. Step 2 builds the write path: extraction/typing
// (write-path-schemas.ts), the pure transition order and contradiction decision
// (write-path-state-machine.ts), and the orchestrator that persists each transition
// through @infinite-ai/db (write-path.ts).

export {
  InMemoryWorkingMemoryStore,
  promote,
  type WorkingMemoryStore,
  type WorkingMemorySummary,
} from './working-memory.js';

export {
  BrainExtractionError,
  L0ConstitutionPayload,
  L1EdgePayload,
  L1NodePayload,
  L2EpisodePayload,
  L3ProcedurePayload,
  extractTyped,
  type BrainTargetTier,
  type ExtractedPayload,
} from './write-path-schemas.js';

export {
  WRITE_PATH_ORDER,
  decideContradiction,
  nextStatus,
  requiresRatification,
  type BrainWriteStatus,
  type ContradictionDecision,
  type ExistingEffectiveFact,
} from './write-path-state-machine.js';

export {
  BrainWritePathError,
  advanceOnce,
  listOpenWrites,
  openWrite,
  ratify,
  run,
} from './write-path.js';

export const PACKAGE_NAME = '@infinite-ai/brain' as const;
