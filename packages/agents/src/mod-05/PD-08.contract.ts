// PD-08 CPTD Tracker — Stage 12 step 2.
//
// Logs CPTD points for a completed professional development activity. Points are
// read exclusively from the school's L0 policy documents (policyDocumentIds) —
// the model never computes CPTD values. citedPolicyDocumentId is required on every
// ok result. If no policy clause matches the activity, returns no_policy_match.

import { PD08Input, PD08Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD08Contract = validateAgentContract({
  id: 'PD-08',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD08Input,
  outputSchema: PD08Result,
  promptRef: { agent: 'PD-08', version: '1.0.0' },
  /** pd.cptd: CPTD point lookup from L0 policy; never a computed value. */
  model: 'pd.cptd',
  tools: [],
  guardrails: ['pii_guard', 'source_grounding_guard'],
  budget: { maxTokens: 1000, maxCostUsd: 0.004 },
  evalSetRef: 'PD-08',
  requiresApproval: false,
  writesToBrain: false,
});
