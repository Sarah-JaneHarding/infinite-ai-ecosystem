// @infinite-ai/brain — Infinite Brain memory service: L0-L4, retrieval path, write path.
//
// L0-L3's tables live in packages/db (Stage 05 step 1), the same way every other
// tenant-owned table does — this package builds the typed API and pipeline logic on top
// of them. Step 1 built L4's Redis-shaped working memory, since it has no table of its
// own to add there. Step 2 builds the write path: extraction/typing
// (write-path-schemas.ts), the pure transition order and contradiction decision
// (write-path-state-machine.ts), and the orchestrator that persists each transition
// through @infinite-ai/db (write-path.ts). Step 3 adds contradiction *resolution* to the
// same two files: `resolveContradiction`'s provenance comparison, and the orchestrator
// wiring an unresolved conflict to @infinite-ai/db's conflict queue. Step 4 builds the
// retrieval path: the intent router and policy gate (both pure), rerank and the minimal
// token-budgeted assembly (both pure), and the orchestrator (retrieval-path.ts) that
// threads a TenantClient and an optional @infinite-ai/telemetry Tracer through all of it,
// in the manual's own fixed order. Step 5 replaces that assembly with the real packer:
// three fixed priority tiers (L0 constitution, then reranked L1/L2, then L3 exemplars),
// fed by two new retrieval-path stages that fetch L0 and L3 candidates step 4 never
// needed to. Step 8 (forgetting.ts) adds the pure retention decision and the thin
// orchestrator that tombstones what it decides has expired, reusing the same
// @infinite-ai/db tombstone primitive a consent withdrawal would use. Step 9 (api.ts)
// adds the Brain API itself: `remember`, `recall`, `ratify`, `supersede`, `forget`,
// `explain` — six typed functions composing everything steps 1-8 already built, the one
// surface a caller outside this package is meant to use.

export {
  InMemoryWorkingMemoryStore,
  promote,
  type WorkingMemoryStore,
  type WorkingMemorySummary,
} from './working-memory.js';

export {
  BrainConstitutionKind,
  BrainEntityType,
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
  resolveContradiction,
  type BrainWriteStatus,
  type ContradictionDecision,
  type ContradictionVerdict,
  type ExistingEffectiveFact,
  type Provenance,
} from './write-path-state-machine.js';

export {
  BrainWritePathError,
  advanceOnce,
  listOpenWrites,
  openWrite,
  resolveConflict,
  run,
} from './write-path.js';

export { routeIntent, type RetrievalPlan } from './retrieval-intent-router.js';

export { gateRetrieval, type RetrievalPolicyDecision } from './retrieval-policy-gate.js';

export { rerank, type ScoredCandidate } from './retrieval-rerank.js';

export {
  BrainAssemblyError,
  assembleContext,
  type AssembledCandidate,
  type AssembledContext,
} from './retrieval-assembly.js';

export {
  RETRIEVAL_PATH_ORDER,
  RetrievalPathError,
  retrieve,
  type RetrievalResult,
  type RetrievalStage,
} from './retrieval-path.js';

export type {
  ConstitutionRetrievalCandidate,
  EpisodeRetrievalCandidate,
  ExemplarRetrievalCandidate,
  NodeRetrievalCandidate,
  RankableCandidate,
  RetrievalCandidate,
  RetrievalCandidateSource,
  RetrievalQuery,
  RetrievalSubject,
} from './retrieval-types.js';

export {
  decideBrainRetention,
  sweepBrainRetention,
  type RetainableBrainFact,
  type RetentionSweepDecision,
  type RetentionSweepResult,
} from './forgetting.js';

export {
  BrainApiError,
  explain,
  forget,
  ratify,
  recall,
  remember,
  supersede,
} from './api.js';

export const PACKAGE_NAME = '@infinite-ai/brain' as const;
