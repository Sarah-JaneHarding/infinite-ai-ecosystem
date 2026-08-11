// PD-04 Practice Signal Aggregator — Stage 12 step 2.
//
// Aggregates all four signal types (coverage, assessment, walkthrough, artefact_edit)
// into a unified PD need profile. Enforces the cohort suppression rule: when
// cohortSize < MINIMUM_COHORT_SIZE the output must be CohortSuppressionResult.

import { PD04Input, PD04Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD04Contract = validateAgentContract({
  id: 'PD-04',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD04Input,
  outputSchema: PD04Result,
  promptRef: { agent: 'PD-04', version: '1.0.0' },
  /** pd.aggregate: multi-signal aggregation into a structured PD need profile. */
  model: 'pd.aggregate',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.008 },
  evalSetRef: 'PD-04',
  requiresApproval: false,
  writesToBrain: false,
});
