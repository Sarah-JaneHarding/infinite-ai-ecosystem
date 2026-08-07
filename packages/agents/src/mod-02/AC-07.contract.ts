// AC-07 Fidelity Checker — Stage 10 step 3.
//
// Compares planned intervention sessions against delivered sessions and produces a
// fidelity rate. Adequate (≥ 80%) vs inadequate (< 80%) informs the SBST whether the
// intervention has had a fair opportunity to work before a monitoring decision is made.

import { AC07Input, AC07Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC07Contract = validateAgentContract({
  id: 'AC-07',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC07Input,
  outputSchema: AC07Result,
  promptRef: { agent: 'AC-07', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 800, maxCostUsd: 0.002 },
  evalSetRef: 'AC-07',
  requiresApproval: false,
  writesToBrain: false,
});
