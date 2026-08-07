// DW-02 Schema Mapper — Stage 09 step 2.
//
// Maps messy source fields to the canonical learner-event model using learned
// mappings from source_field_mapping. Raises a human gate when a new source
// shape is seen for the first time (unmapped fields).

import { DW02Input, DW02Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW02Contract = validateAgentContract({
  id: 'DW-02',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW02Input,
  outputSchema: DW02Result,
  promptRef: { agent: 'DW-02', version: '1.0.0' },
  /** data.map: schema inference and field mapping, not free-form generation. */
  model: 'data.map',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 3000, maxCostUsd: 0.03 },
  evalSetRef: 'DW-02',
  requiresApproval: true,
  writesToBrain: false,
});
