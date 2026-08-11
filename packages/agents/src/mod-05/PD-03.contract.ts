// PD-03 Observation Analyst — Stage 12 step 2.
//
// Synthesises anonymised WalkthroughNotes into cross-cutting themes, supporting
// evidence, and priority areas for PD support. All teacher references in the input
// must be de-identified before this agent is invoked; the agent never sees names.

import { PD03Input, PD03Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD03Contract = validateAgentContract({
  id: 'PD-03',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD03Input,
  outputSchema: PD03Result,
  promptRef: { agent: 'PD-03', version: '1.0.0' },
  /** pd.observe: thematic synthesis over anonymised walkthrough observation notes. */
  model: 'pd.observe',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.01 },
  evalSetRef: 'PD-03',
  requiresApproval: false,
  writesToBrain: false,
});
