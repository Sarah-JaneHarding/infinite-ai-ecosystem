// TB-11 Visual Brief Writer — Stage 11 step 8.
//
// Writes a text-only brief describing an image a teacher should commission from a
// real artist or photographer. The system never fabricates imagery presented as real;
// TB-11 outputs text descriptions only — no image bytes, no generative image calls.

import { TB11Input, TB11Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB11Contract = validateAgentContract({
  id: 'TB-11',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB11Input,
  outputSchema: TB11Result,
  promptRef: { agent: 'TB-11', version: '1.0.0' },
  /** plan.author: generative content authoring, grounded in source documents. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.01 },
  evalSetRef: 'TB-11',
  requiresApproval: false,
  writesToBrain: false,
});
