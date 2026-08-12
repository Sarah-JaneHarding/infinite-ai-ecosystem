import { TB09Input, TB09Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB09Contract = validateAgentContract({
  id: 'TB-09',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB09Input,
  outputSchema: TB09Result,
  promptRef: { agent: 'TB-09', version: '1.0.0' },
  /** plan.author: generative content authoring for enrichment extension packs. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-09',
  requiresApproval: false,
  writesToBrain: false,
});
