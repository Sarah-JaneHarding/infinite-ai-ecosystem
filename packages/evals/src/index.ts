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

export const PACKAGE_NAME = '@infinite-ai/evals' as const;
