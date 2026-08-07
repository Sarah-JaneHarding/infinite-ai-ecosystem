// DW-03 Consent Ledger Agent — Stage 09 step 2.
//
// Verifies that a learner's data in a given domain can be processed under a
// declared purpose. Checks the consent_record table and the purpose allow-list.
// Blocks downstream processing when consent or lawful basis is absent.

import { DW03Input, DW03Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW03Contract = validateAgentContract({
  id: 'DW-03',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW03Input,
  outputSchema: DW03Result,
  promptRef: { agent: 'DW-03', version: '1.0.0' },
  /** data.consent: policy lookup, no generative content. */
  model: 'data.consent',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1000, maxCostUsd: 0.005 },
  evalSetRef: 'DW-03',
  requiresApproval: false,
  writesToBrain: false,
});
