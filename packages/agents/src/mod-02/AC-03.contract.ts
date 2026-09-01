// AC-03 Tier Recommender — Stage 10 step 3.
//
// Receives an AC-01 screen result after the AC-02 core-health gate has passed (gatesAc03
// must be true). Produces a formal tier recommendation with evidence linkage for SBST
// review. Every recommendation goes to the SBST; none is applied automatically.

import { AC03Input, AC03Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC03Contract = validateAgentContract({
  id: 'AC-03',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC03Input,
  outputSchema: AC03Result,
  promptRef: { agent: 'AC-03', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  /** 'recommended'.rationale (the SBST-facing text) and 'needs_input'.detail. */
  freeTextOutputFields: ['rationale', 'detail'],
  budget: { maxTokens: 1200, maxCostUsd: 0.004 },
  evalSetRef: 'AC-03',
  requiresApproval: false,
  writesToBrain: true,
});
