// AC-04 Early Warning Agent — Stage 10 step 3.
//
// Daily risk-signal detector. Runs on recent domain readings between full termly
// screens and surfaces deterioration early. Does not recommend tier changes; only
// signals that a full screen may be warranted.

import { AC04Input, AC04Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC04Contract = validateAgentContract({
  id: 'AC-04',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC04Input,
  outputSchema: AC04Result,
  promptRef: { agent: 'AC-04', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  /** 'needs_input'.detail — 'signals_found'/'no_signals' are entirely structured. */
  freeTextOutputFields: ['detail'],
  budget: { maxTokens: 800, maxCostUsd: 0.002 },
  evalSetRef: 'AC-04',
  requiresApproval: false,
  writesToBrain: false,
});
