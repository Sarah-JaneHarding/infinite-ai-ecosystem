// AC-02 Core-Health Analyst — Stage 10 step 2.
//
// Receives every AC-01 screen result for a class and determines whether Tier 1 is
// sufficient for at least 80% of learners. If the class core health passes, AC-03 (Tier
// Recommender) is permitted to run for individual learners. If it fails, individual tier
// recommendations are suppressed and a Tier 1 improvement task is raised instead.
//
// This is the mandatory AC-02-gates-AC-03 invariant from the build manual — it must be
// proven in tests before AC-03 is built.

import { AC02Input, AC02Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC02Contract = validateAgentContract({
  id: 'AC-02',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC02Input,
  outputSchema: AC02Result,
  promptRef: { agent: 'AC-02', version: '1.0.0' },
  /** support.health: class-level aggregation; no generation, no PII. */
  model: 'support.health',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 800, maxCostUsd: 0.002 },
  evalSetRef: 'AC-02',
  requiresApproval: false,
  writesToBrain: false,
});
