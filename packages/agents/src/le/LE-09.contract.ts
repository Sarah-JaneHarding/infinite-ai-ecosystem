// LE-09 Decay & Revalidation Agent — Stage 13 step 8.
// TTL and revalidation, triggered also by any L0 curriculum version change.

import { LE09Input, LE09Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE09Contract = validateAgentContract({
  id: 'LE-09',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE09Input,
  outputSchema: LE09Result,
  promptRef: { agent: 'LE-09', version: '1.0.0' },
  model: 'le.decay',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1000, maxCostUsd: 0.003 },
  evalSetRef: 'LE-09',
  requiresApproval: false,
  writesToBrain: true,
});
