// PD-01 Coverage vs Pacing Analyst — Stage 12 step 2.
//
// Deterministic analysis of topic coverage against the ATP pacing plan.
// Identifies topics that are behind, ahead, or on track, and computes mean
// weeks drift. No model call for the computation itself — the agent reads
// CoverageSignals and returns a structured pacing report.
//
// No ranking language in output; no teacher-level comparison fields exist.

import { PD01Input, PD01Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD01Contract = validateAgentContract({
  id: 'PD-01',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD01Input,
  outputSchema: PD01Result,
  promptRef: { agent: 'PD-01', version: '1.0.0' },
  /** pd.coverage: pacing-gap analysis over CoverageSignal data. */
  model: 'pd.coverage',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'PD-01',
  requiresApproval: false,
  writesToBrain: false,
});
