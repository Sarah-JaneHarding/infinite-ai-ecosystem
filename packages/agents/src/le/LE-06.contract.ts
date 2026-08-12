// LE-06 Prompt Evolver — Stage 13 step 4.
// Produces challenger prompt candidates only. Nothing goes live without LE-07 + ratification.

import { LE06Input, LE06Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE06Contract = validateAgentContract({
  id: 'LE-06',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE06Input,
  outputSchema: LE06Result,
  promptRef: { agent: 'LE-06', version: '1.0.0' },
  model: 'le.evolver',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 3000, maxCostUsd: 0.01 },
  evalSetRef: 'LE-06',
  requiresApproval: true,
  writesToBrain: false,
});
