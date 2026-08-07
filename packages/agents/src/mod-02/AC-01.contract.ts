// AC-01 Universal Screener — Stage 10 step 2.
//
// Runs a termly universal screen across the five SIAS domains (literacy, numeracy,
// attendance, behaviour, wellbeing). For each domain it checks data sufficiency against
// the minimums in @infinite-ai/analytics before assigning a tier. A safeguarding
// disclosure anywhere in the input escalates immediately; the output is never summarised.
//
// AC-02 must run after AC-01: core health determines whether individual tier
// recommendations may proceed to AC-03.

import { AC01Input, AC01Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC01Contract = validateAgentContract({
  id: 'AC-01',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC01Input,
  outputSchema: AC01Result,
  promptRef: { agent: 'AC-01', version: '1.0.0' },
  /** support.screen: pure analytical screening — no generative prose. */
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'AC-01',
  requiresApproval: false,
  writesToBrain: true,
});
