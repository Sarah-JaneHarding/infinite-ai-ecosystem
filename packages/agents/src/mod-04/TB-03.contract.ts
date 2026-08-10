// TB-03 Reading Passage Generator — Stage 11 step 2.
//
// Generates a reading passage at a specified readability band, grounded in
// cited source documents. Optionally produces decodable passages for the
// Foundation Phase. Returns readability_out_of_band if the measured grade
// falls outside the target band after generation.

import { TB03Input, TB03Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB03Contract = validateAgentContract({
  id: 'TB-03',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB03Input,
  outputSchema: TB03Result,
  promptRef: { agent: 'TB-03', version: '1.0.0' },
  /** plan.author: generative content authoring, grounded in source documents. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard', 'readability_guard'],
  budget: { maxTokens: 3000, maxCostUsd: 0.015 },
  evalSetRef: 'TB-03',
  requiresApproval: false,
  writesToBrain: false,
});
