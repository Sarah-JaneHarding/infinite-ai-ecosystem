// AC-10 Parent Report Writer — Stage 10 step 4.
//
// Generates a plain-language progress letter in the guardian's home language, at the
// stated Flesch-Kincaid grade level, verified by the readability guardrail. No
// diagnostic, clinical or disability language is permitted. A human must review the
// letter before it reaches a guardian — requiresApproval is true. The report is a
// deliverable, not a versioned fact, so it does not write to the Brain.

import { AC10Input, AC10Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC10Contract = validateAgentContract({
  id: 'AC-10',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC10Input,
  outputSchema: AC10Result,
  promptRef: { agent: 'AC-10', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard', 'readability_guard'],
  /** 'written'.reportText — the actual guardian-facing letter — and 'needs_input'.detail. */
  freeTextOutputFields: ['reportText', 'detail'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'AC-10',
  requiresApproval: true,
  writesToBrain: false,
});
