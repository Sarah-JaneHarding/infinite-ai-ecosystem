// LE-02 Correction Differ — Stage 13 step 1.

import { LE02Input, LE02Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE02Contract = validateAgentContract({
  id: 'LE-02',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE02Input,
  outputSchema: LE02Result,
  promptRef: { agent: 'LE-02', version: '1.0.0' },
  model: 'le.correction',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1200, maxCostUsd: 0.004 },
  evalSetRef: 'LE-02',
  requiresApproval: false,
  writesToBrain: true,
});
