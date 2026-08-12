// PD-06 Micro-Course Composer — Stage 12 step 2.
//
// Composes a structured 20–40 minute professional development micro-course grounded
// in L3 exemplars and school evidence. Output is a JSON learning object (exportable:
// true), never a binary or PDF. All content grounded in sourceDocumentIds.

import { PD06Input, PD06Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD06Contract = validateAgentContract({
  id: 'PD-06',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD06Input,
  outputSchema: PD06Result,
  promptRef: { agent: 'PD-06', version: '1.0.0' },
  /** pd.compose: structured micro-course composition grounded in source documents. */
  model: 'pd.compose',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 3000, maxCostUsd: 0.015 },
  evalSetRef: 'PD-06',
  requiresApproval: false,
  writesToBrain: false,
});
