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

export const PACKAGE_NAME = '@infinite-ai/learning' as const;
