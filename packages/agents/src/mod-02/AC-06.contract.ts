// AC-06 Progress Monitor — Stage 10 step 3.
//
// Analyses a series of progress measurements against the goal line set in the
// intervention plan and recommends continue, intensify, or exit. The recommendation
// is input to the SBST's next review cycle; it does not change the learner's tier
// automatically.

import { AC06Input, AC06Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC06Contract = validateAgentContract({
  id: 'AC-06',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC06Input,
  outputSchema: AC06Result,
  promptRef: { agent: 'AC-06', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  /** 'monitored'.detail and 'needs_input'.detail — the only free text AC06Result carries. */
  freeTextOutputFields: ['detail'],
  budget: { maxTokens: 1000, maxCostUsd: 0.003 },
  evalSetRef: 'AC-06',
  requiresApproval: false,
  writesToBrain: false,
});
