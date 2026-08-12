// PD-05 PD Gap Detector — Stage 12 step 2.
//
// Reads a PD need profile (from PD-04) and identifies priority gaps, ordered by
// urgency. Maps each gap to a suggested intervention type (micro_course,
// coaching_cycle, peer_observation, resource_provision). No ranking of teachers.

import { PD05Input, PD05Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD05Contract = validateAgentContract({
  id: 'PD-05',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD05Input,
  outputSchema: PD05Result,
  promptRef: { agent: 'PD-05', version: '1.0.0' },
  /** pd.detect: priority gap detection from an aggregated PD need profile. */
  model: 'pd.detect',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.006 },
  evalSetRef: 'PD-05',
  requiresApproval: false,
  writesToBrain: false,
});
