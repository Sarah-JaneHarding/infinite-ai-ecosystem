// AC-11 Analytics Data Screener — Stage 10 step 6.
//
// Pre-flight check for the analytics.report pipeline: receives a class, grade,
// or school rollup snapshot and determines whether the data is ready for the full
// reporting pass. All decisions are deterministic (cohort suppression rules,
// staleness threshold, domain coverage count) — no generative prose, no free text
// in the output. Backed by analytics.screen (Gemini Flash primary).
//
// Runs before every analytics.report call; a 'suppressed' result stops the report
// from running and surfaces the suppression reason to the scheduler instead.

import { AC11Input, AC11Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC11Contract = validateAgentContract({
  id: 'AC-11',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'reporting_district',
  inputSchema: AC11Input,
  outputSchema: AC11Result,
  promptRef: { agent: 'AC-11', version: '1.0.0' },
  /** analytics.screen: Flash-primary; deterministic cohort checks, no reasoning prose. */
  model: 'analytics.screen',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 600, maxCostUsd: 0.001 },
  evalSetRef: 'AC-11',
  requiresApproval: false,
  writesToBrain: false,
});
