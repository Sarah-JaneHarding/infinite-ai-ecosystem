// @infinite-ai/evals — Golden sets, scorers, promptfoo configs, champion/challenger runner.
//
// Stage 07 step 1: the eval case format. Later steps (scorers, the runner, champion/
// challenger, CI wiring, the golden-set growth loop, the safety set, the dashboard) build
// on top of it.

export {
  EvalCaseError,
  EvalCaseSource,
  Expectation,
  MUST_NOT_REGRESS_TAG,
  SAFETY_TAGS,
  validateEvalCase,
  type EvalCase,
  type SafetyTag,
} from './case.js';

export {
  scoreCitationPresence,
  scoreExactMatch,
  scoreExpectation,
  scoreJsonSchema,
  scoreLlmJudge,
  scoreNumericTolerance,
  scoreReadabilityBand,
  scoreRefusalCorrectness,
  scoreSetOverlap,
  scoreTemplateFidelity,
  type LlmJudge,
  type ScoreOptions,
  type ScoreResult,
  type TemplateFidelityCheckers,
} from './scorers.js';

export {
  EvalRunnerError,
  diffAgainstChampion,
  runEvalSet,
  type AgentExecutor,
  type CaseDiff,
  type CaseResult,
  type EvalRunResult,
  type RunDiff,
  type RunEvalSetOptions,
  type RunMetrics,
} from './runner.js';

export {
  decidePromotion,
  type PromotionOptions,
  type PromotionReasonCode,
  type PromotionRefusal,
  type PromotionReview,
  type PromotionVerdict,
} from './promotion.js';

export {
  EvalDiscoveryError,
  loadAllEvalSets,
  loadEvalCasesFromDir,
} from './discovery.js';

export { affectedAgentIds, classifyChange, type ChangeImpact } from './affected.js';

export {
  evaluateGate,
  type GateReasonCode,
  type GateRefusal,
  type GateVerdict,
  type RegressionTolerance,
} from './gate.js';

export {
  AgentExecutorRegistryError,
  getAgentExecutor,
  registerAgentExecutor,
  registeredAgentIds,
} from './agent-executors.js';

export {
  buildSafetyCase,
  isSafetyCase,
  selectCasesToRun,
  selectSafetyCases,
  type SafetyCaseInput,
} from './safety-set.js';

export {
  acceptCorrectionCandidate,
  buildCorrectionCandidate,
  type CorrectionCandidate,
  type CorrectionCandidateInput,
  type HumanGateOutcome,
} from './growth-loop.js';

export { loadChampionResult, saveChampionResult } from './champion-store.js';

export {
  buildAgentDashboard,
  type AgentDashboard,
  type ChampionHistoryEntry,
  type CostPoint,
  type RunHistoryEntry,
  type ScorePoint,
} from './dashboard.js';

export const PACKAGE_NAME = '@infinite-ai/evals' as const;
