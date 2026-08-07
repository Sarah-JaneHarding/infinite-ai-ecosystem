// DW-06 Learner-360 Builder — Stage 09 step 2.
//
// Deterministic materialisation of a learner's 360-degree profile from domain
// events in the event log. No model call — every value is derived by
// aggregation from conformed events. Returns needs_input when no events exist.

import { DW06Input, DW06Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW06Contract = validateAgentContract({
  id: 'DW-06',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW06Input,
  outputSchema: DW06Result,
  promptRef: { agent: 'DW-06', version: '1.0.0' },
  /** data.materialise: deterministic aggregation — no generative content. */
  model: 'data.materialise',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.01 },
  evalSetRef: 'DW-06',
  requiresApproval: false,
  writesToBrain: true,
});
