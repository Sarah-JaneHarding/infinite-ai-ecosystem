// LE-01 Signal Collector — Stage 13 step 1.

import { LE01Input, LE01Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE01Contract = validateAgentContract({
  id: 'LE-01',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE01Input,
  outputSchema: LE01Result,
  promptRef: { agent: 'LE-01', version: '1.0.0' },
  model: 'le.signal',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1000, maxCostUsd: 0.003 },
  evalSetRef: 'LE-01',
  requiresApproval: false,
  writesToBrain: true,
});
