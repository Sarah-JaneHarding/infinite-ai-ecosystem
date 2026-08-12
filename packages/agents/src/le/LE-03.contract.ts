// LE-03 Outcome Attributor — Stage 13 step 2.

import { LE03Input, LE03Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE03Contract = validateAgentContract({
  id: 'LE-03',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE03Input,
  outputSchema: LE03Result,
  promptRef: { agent: 'LE-03', version: '1.0.0' },
  model: 'le.attribution',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'LE-03',
  requiresApproval: false,
  writesToBrain: true,
});
