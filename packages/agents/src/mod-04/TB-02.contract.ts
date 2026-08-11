import { TB02Input, TB02Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB02Contract = validateAgentContract({
  id: 'TB-02',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB02Input,
  outputSchema: TB02Result,
  promptRef: { agent: 'TB-02', version: '1.0.0' },
  /** plan.author: generative content authoring for presentation decks. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-02',
  requiresApproval: false,
  writesToBrain: false,
});
