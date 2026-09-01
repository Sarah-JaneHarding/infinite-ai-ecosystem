// AC-05 Intervention Planner — Stage 10 step 3.
//
// Produces a structured intervention plan for a TIER_2 or TIER_3 learner after the SBST
// has ratified the tier. The plan includes a measurable goal, evidence-based strategy,
// dosage (sessions/week and minutes/session), duration, and responsible role.

import { AC05Input, AC05Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC05Contract = validateAgentContract({
  id: 'AC-05',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC05Input,
  outputSchema: AC05Result,
  promptRef: { agent: 'AC-05', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  /** 'planned'.goal and 'planned'.strategy — the only free prose in AC05Result — plus
   * 'needs_input'.detail. */
  freeTextOutputFields: ['goal', 'strategy', 'detail'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'AC-05',
  requiresApproval: false,
  writesToBrain: true,
});
