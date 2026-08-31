// @infinite-ai/guardrails — input/output validators, refusal policy, PII egress guard.

export {
  PiiEgressError,
  assertEgressAllowed,
  inspectEgress,
  type DeidentificationProvenance,
  type EgressPayload,
  type EgressRefusal,
  type EgressVerdict,
} from './pii-guard.js';

export {
  PASSED,
  Refusal,
  RefusalReasonCode,
  EscalationRoute,
  refuse,
  type GuardrailVerdict,
} from './refusal.js';

export { checkPromptInjection } from './prompt-injection.js';

export { scoreReadability, type ReadabilityResult } from './readability.js';

export {
  checkInputSchema,
  checkPii,
  checkPurposeAndConsent,
  checkTokenBudget,
  type TokenBudget,
} from './input-checks.js';

export {
  DIAGNOSTIC_TERMS,
  checkAgeAppropriateness,
  checkCost,
  checkDiagnosticLanguage,
  checkGrounding,
  checkOutputSchema,
  checkReadability,
  checkRefusalPolicy,
  checkTemplateFidelity,
  type AgeAppropriatenessChecker,
  type CostBudget,
  type ReadabilityRange,
  type TemplateFidelityChecker,
} from './output-checks.js';

export { buildTemplateFidelityChecker } from './template-fidelity.js';

export {
  createBrainAgeAppropriatenessChecker,
  type AgeAppropriatenessJudge,
} from './brain-age-appropriateness.js';

export {
  GuardrailEscalationError,
  defaultEscalationNotifier,
  runInputGuardrails,
  runOutputGuardrails,
  type EscalationNotifier,
  type GuardrailRunOptions,
  type InputGuardrailInput,
  type OutputGuardrailInput,
} from './engine.js';

export const PACKAGE_NAME = '@infinite-ai/guardrails' as const;
