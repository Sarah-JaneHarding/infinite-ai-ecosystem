// DW-08 Next-Step Recommender — Stage 09 step 2.
//
// Derives one concrete next action from a synthesised insight: what should
// happen, who owns it, and by when. References the insight that grounded it.
// Returns needs_input when no insight is available for the scope.

import { DW08Input, DW08Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW08Contract = validateAgentContract({
  id: 'DW-08',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW08Input,
  outputSchema: DW08Result,
  promptRef: { agent: 'DW-08', version: '1.0.0' },
  /** data.nextstep: one concrete action derived from a grounded insight. */
  model: 'data.nextstep',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 3000, maxCostUsd: 0.03 },
  evalSetRef: 'DW-08',
  requiresApproval: true,
  writesToBrain: true,
});
