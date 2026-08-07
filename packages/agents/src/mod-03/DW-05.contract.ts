// DW-05 Data Quality Sentinel — Stage 09 step 2.
//
// Checks completeness, duplicate detection, impossible values, and distribution
// drift for a sample of records from an ingest run. Sets blockedDownstream when
// the quality score falls below threshold.

import { DW05Input, DW05Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW05Contract = validateAgentContract({
  id: 'DW-05',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW05Input,
  outputSchema: DW05Result,
  promptRef: { agent: 'DW-05', version: '1.0.0' },
  /** data.quality: statistical analysis and rule checks, no learner PII in prompt. */
  model: 'data.quality',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 4000, maxCostUsd: 0.04 },
  evalSetRef: 'DW-05',
  requiresApproval: false,
  writesToBrain: false,
});
