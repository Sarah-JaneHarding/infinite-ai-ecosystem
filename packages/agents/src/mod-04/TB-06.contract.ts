// TB-06 Home-Language Adapter — Stage 11 step 3.
//
// Adapts a source artefact to any of the eleven official South African languages.
// LoLT-aware: the adaptation is informed by the school's declared Language of Learning
// and Teaching. Languages below the shipping quality threshold are flagged as
// requiresHumanReview rather than shipped with poor output.

import { TB06Input, TB06Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB06Contract = validateAgentContract({
  id: 'TB-06',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB06Input,
  outputSchema: TB06Result,
  promptRef: { agent: 'TB-06', version: '1.0.0' },
  /** plan.author: generative content authoring, adapted across languages. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 4000, maxCostUsd: 0.02 },
  evalSetRef: 'TB-06',
  requiresApproval: false,
  writesToBrain: false,
});
