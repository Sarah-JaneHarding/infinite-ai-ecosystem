// DW-07 Insight Synthesiser — Stage 09 step 2.
//
// Generates a narrative insight at learner, class, grade, or school level by
// reasoning over de-identified domain events. Every claim must cite a source
// event ID. Returns needs_input when no domain events exist for the scope.

import { DW07Input, DW07Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW07Contract = validateAgentContract({
  id: 'DW-07',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW07Input,
  outputSchema: DW07Result,
  promptRef: { agent: 'DW-07', version: '1.0.0' },
  /** data.insight: generative narrative synthesis over de-identified event data. */
  model: 'data.insight',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 5000, maxCostUsd: 0.06 },
  evalSetRef: 'DW-07',
  requiresApproval: false,
  writesToBrain: true,
});
