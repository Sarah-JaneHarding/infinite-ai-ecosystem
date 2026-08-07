// AC-09 SIAS Compiler — Stage 10 step 4.
//
// Compiles the formal support-needs documentation pack for a learner whose SIAS case
// has reached REFERRAL_PENDING with a stored SBST ratification. Enforces the state
// machine: any status other than REFERRAL_PENDING returns state_machine_blocked rather
// than producing a pack. The compiled pack always requires sign-off before submission.

import { AC09Input, AC09Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC09Contract = validateAgentContract({
  id: 'AC-09',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC09Input,
  outputSchema: AC09Result,
  promptRef: { agent: 'AC-09', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  budget: { maxTokens: 2500, maxCostUsd: 0.008 },
  evalSetRef: 'AC-09',
  requiresApproval: true,
  writesToBrain: true,
});
