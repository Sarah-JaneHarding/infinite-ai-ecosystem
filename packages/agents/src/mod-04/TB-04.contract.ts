// TB-04 Item Writer — Stage 11 step 2.
//
// Writes cognitive-demand-tagged assessment items (multiple choice, short answer,
// extended response, true/false) at a specified readability band. Answer keys are
// not produced here — that is TB-05's domain.

import { TB04Input, TB04Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB04Contract = validateAgentContract({
  id: 'TB-04',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB04Input,
  outputSchema: TB04Result,
  promptRef: { agent: 'TB-04', version: '1.0.0' },
  /** plan.author: generative content authoring, grounded in source documents. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 3500, maxCostUsd: 0.018 },
  evalSetRef: 'TB-04',
  requiresApproval: false,
  writesToBrain: false,
});
