import { TB10Input, TB10Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB10Contract = validateAgentContract({
  id: 'TB-10',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB10Input,
  outputSchema: TB10Result,
  promptRef: { agent: 'TB-10', version: '1.0.0' },
  /** plan.author: generative content authoring for resource-light classroom activities. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-10',
  requiresApproval: false,
  writesToBrain: false,
});
