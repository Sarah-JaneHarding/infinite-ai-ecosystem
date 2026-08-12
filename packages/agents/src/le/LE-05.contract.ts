// LE-05 Exemplar Curator — Stage 13 step 4.
// Produces candidates only. Nothing enters L3 without human ratification (step 6).

import { LE05Input, LE05Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const LE05Contract = validateAgentContract({
  id: 'LE-05',
  version: '1.0.0',
  module: 'LE',
  purpose: 'learning_engine',
  inputSchema: LE05Input,
  outputSchema: LE05Result,
  promptRef: { agent: 'LE-05', version: '1.0.0' },
  model: 'le.exemplar',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'LE-05',
  requiresApproval: true,
  writesToBrain: false,
});
