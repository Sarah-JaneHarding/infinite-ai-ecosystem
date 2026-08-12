// LE-07 Eval Gatekeeper — Stage 13 step 5.
// It must be impossible to promote without passing this gate.

import { LE07Input, LE07Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE07Contract = validateAgentContract({
  id: 'LE-07',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE07Input,
  outputSchema: LE07Result,
  promptRef: { agent: 'LE-07', version: '1.0.0' },
  model: 'le.gatekeeper',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'LE-07',
  requiresApproval: true,
  writesToBrain: false,
});
