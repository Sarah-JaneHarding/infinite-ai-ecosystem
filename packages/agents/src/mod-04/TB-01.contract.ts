// TB-01 Worksheet Builder — Stage 11 step 2.
//
// Generates a differentiated worksheet grounded in cited source documents.
// The content must be grounded in at least one cited document; the agent
// refuses when no source documents are supplied (no_source_document output).

import { TB01Input, TB01Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB01Contract = validateAgentContract({
  id: 'TB-01',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB01Input,
  outputSchema: TB01Result,
  promptRef: { agent: 'TB-01', version: '1.0.0' },
  /** plan.author: generative content authoring, grounded in source documents. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-01',
  requiresApproval: false,
  writesToBrain: false,
});
