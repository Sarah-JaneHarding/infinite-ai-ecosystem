// DW-04 De-identification Agent — Stage 09 step 2.
//
// Tokenises a conformed event payload before any model call downstream.
// Replaces the learnerId with the learner's token, removes direct identifiers,
// and stamps `deidentified: true` so the PII guard can verify provenance.

import { DW04Input, DW04Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW04Contract = validateAgentContract({
  id: 'DW-04',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW04Input,
  outputSchema: DW04Result,
  promptRef: { agent: 'DW-04', version: '1.0.0' },
  /** data.deident: deterministic tokenisation, no generative content. */
  model: 'data.deident',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1000, maxCostUsd: 0.005 },
  evalSetRef: 'DW-04',
  requiresApproval: false,
  writesToBrain: false,
});
