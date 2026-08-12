import { TB08Input, TB08Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB08Contract = validateAgentContract({
  id: 'TB-08',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB08Input,
  outputSchema: TB08Result,
  promptRef: { agent: 'TB-08', version: '1.0.0' },
  /** plan.author: generative content authoring for remediation material. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-08',
  requiresApproval: false,
  writesToBrain: false,
});
