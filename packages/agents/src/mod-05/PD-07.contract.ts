// PD-07 Coaching Plan Agent — Stage 12 step 2.
//
// Produces a structured coaching conversation plan for a human coach to use with
// a teacher. The plan is developmental (not evaluative): session focus, opening
// prompts, evidence points, and optional observation follow-up. No teacher scoring.

import { PD07Input, PD07Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD07Contract = validateAgentContract({
  id: 'PD-07',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD07Input,
  outputSchema: PD07Result,
  promptRef: { agent: 'PD-07', version: '1.0.0' },
  /** pd.coach: coaching conversation plan grounded in gap evidence and source docs. */
  model: 'pd.coach',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 2500, maxCostUsd: 0.012 },
  evalSetRef: 'PD-07',
  requiresApproval: false,
  writesToBrain: false,
});
