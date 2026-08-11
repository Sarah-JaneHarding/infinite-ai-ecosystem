// LE-04 Pattern Miner — Stage 13 step 3.

import { LE04Input, LE04Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE04Contract = validateAgentContract({
  id: 'LE-04',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE04Input,
  outputSchema: LE04Result,
  promptRef: { agent: 'LE-04', version: '1.0.0' },
  model: 'le.pattern',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.007 },
  evalSetRef: 'LE-04',
  requiresApproval: false,
  writesToBrain: true,
});
