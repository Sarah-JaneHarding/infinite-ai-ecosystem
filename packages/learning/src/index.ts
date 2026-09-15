// @infinite-ai/learning — LE Learning Engine.
//
// Tenant-local learning from teacher corrections, versioned exemplar and prompt promotion,
// k-anonymity commons publication, TTL-based decay and revalidation, and maturity reporting.
// Stage 13.

export {
  applyPromotionGate,
  type EvalSummary,
  type GateInput,
  type GateResult,
} from './promotion-gate.js';

export { decideCommonPublication, type PublishDecision } from './commons-publisher.js';

export {
  assessPatternDecay,
  type DecayDecision,
  type DecayInput,
} from './decay-agent.js';

export { PromotionLog, type PromotionRecord } from './promotion-log.js';

export { assignMaturityLevel, type MaturityMetrics } from './maturity-report.js';

export {
  attributeOutcomes,
  OUTCOME_MIN_COHORT_SIZE,
  type AttributionDecision,
  type AttributionInput,
  type OutcomeSignal,
} from './outcome-attributor.js';

export {
  minePatterns,
  type MinedPatternResult,
  type PatternMinerAttribution,
  type PatternMinerDecision,
  type PatternMinerInput,
} from './pattern-miner.js';

export {
  curateExemplars,
  EXEMPLAR_MIN_COMPOSITE_SCORE,
  type ExemplarCuratorCandidateInput,
  type ExemplarCuratorDecision,
  type ExemplarCuratorInput,
} from './exemplar-curator.js';

export {
  evolvePrompt,
  EVOLVER_MIN_CORRECTION_FREQUENCY,
  type CorrectionPattern,
  type PromptEvolverDecision,
  type PromptEvolverInput,
} from './prompt-evolver.js';

export {
  gateChallenger,
  type EvalGatekeeperDecision,
  type EvalGatekeeperInput,
} from './eval-gatekeeper.js';

export const PACKAGE_NAME = '@infinite-ai/learning' as const;
