// @infinite-ai/db — the tenant-scoped database client.
//
// Rule 5: this package exports `withTenant` and types. It does not export the raw Prisma
// client, and there is no import path to one from outside this package. A test asserts
// this export surface, because the guarantee is only worth what it is checked by.

export {
  InvalidTenantContextError,
  disconnect,
  withTenant,
  type TenantClient,
  type TenantContext,
} from './client.js';

export {
  AuditError,
  appendAuditEvent,
  type AppendAuditEventInput,
  type AppendedAuditEvent,
} from './audit.js';

export {
  DecryptionError,
  EncryptionKey,
  EncryptionKeyError,
  decrypt,
  encrypt,
  lookupHash,
  type EncryptedValue,
} from './encryption.js';

export {
  ConsentLedgerError,
  appendConsentEntry,
  readLedger,
  readTenantLedger,
  type ConsentAppend,
  type ConsentRow,
} from './consent.js';

export {
  ErasureError,
  eraseSubject,
  type ErasureOutcome,
  type ErasureRequest,
  type ErasureTrigger,
  type SubjectKind,
} from './erasure.js';

export {
  APPEND_ONLY_TABLES,
  NON_TENANT_TABLES,
  SELF_KEYED_TENANT_TABLES,
  TENANT_OWNED_TABLES,
  type AppendOnlyTable,
  type TenantOwnedTable,
} from './tables.js';

export { readTenantLexicon } from './lexicon.js';

export {
  BrainWriteError,
  advanceBrainWrite,
  commitBrainFact,
  findEffectiveBrainFact,
  getBrainWriteCandidate,
  listOpenBrainWrites,
  openBrainWrite,
  ratifyBrainWrite,
  recordContradictionResolution,
  type BrainConflictResolution,
  type BrainFactToCommit,
  type BrainNaturalKey,
  type BrainTargetTier,
  type BrainWriteCandidateInput,
  type BrainWriteCandidateRow,
  type BrainWriteStatus,
  type BrainWriteTransition,
  type CommittedBrainFact,
  type EffectiveBrainFact,
} from './brain-write-path.js';

export {
  BrainConflictError,
  enqueueBrainConflict,
  getBrainConflict,
  listOpenBrainConflicts,
  resolveBrainConflict,
  type BrainConflictInput,
  type BrainConflictRow,
} from './brain-conflict-queue.js';

export {
  BrainRetrievalError,
  expandGraph,
  filterEpisodesByWindow,
  listEffectiveConstitution,
  listEffectiveExemplars,
  vectorTopK,
  type ConstitutionRow,
  type EdgeRow,
  type EpisodeCandidateRow,
  type EpisodicWindow,
  type ExemplarRow,
  type ExpandedNode,
  type GraphExpansionResult,
  type NodeCandidateRow,
  type VectorTopKMatch,
  type VectorTopKQuery,
} from './brain-retrieval.js';

export { getFactProvenance, type FactProvenance } from './brain-provenance.js';

export {
  getRetentionRule,
  upsertRetentionRule,
  RetentionError,
  type RetentionRuleInput,
  type RetentionRuleRow,
} from './retention.js';

export {
  BrainForgettingError,
  tombstoneBrainFact,
  type TombstoneInput,
  type TombstoneReason,
  type TombstoneTargetTier,
  type TombstonedBrainFact,
} from './brain-forgetting.js';

export {
  OrchestratorPersistenceError,
  cancelRun,
  finishStepRun,
  getRun,
  listStepRuns,
  openRun,
  startStepRun,
  updateRunStatus,
  type OpenRunInput,
  type OrchestratorRunRow,
  type OrchestratorRunStatus,
  type OrchestratorStepRunRow,
  type OrchestratorStepRunStatus,
  type RunStatusUpdate,
  type StepRunOutcome,
} from './orchestrator.js';

export {
  ApprovalPersistenceError,
  decideApprovalTask,
  getApprovalTask,
  getApprovalTaskForStep,
  openApprovalTask,
  type ApprovalDecisionOutcome,
  type ApprovalTaskRow,
  type DecideApprovalTaskInput,
  type OpenApprovalTaskInput,
} from './approval.js';

export { hasActiveRoleAssignment } from './roles.js';

export const PACKAGE_NAME = '@infinite-ai/db' as const;
