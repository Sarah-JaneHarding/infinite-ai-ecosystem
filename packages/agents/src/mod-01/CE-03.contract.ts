// CE-03 Term Planner — Stage 08 step 3.
//
// Translates an ATPSchedule into a per-term plan for each subject: which content areas
// run in which teaching weeks, and when assessment tasks are scheduled. Depends on the
// GradeFramework (CE-01) and ATPSchedule (CE-02) stored in L0; returns needs_input when
// either is absent or unratified.

import { CE03Input, TermPlanResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE03Contract = validateAgentContract({
  id: 'CE-03',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE03Input,
  outputSchema: TermPlanResult,
  promptRef: { agent: 'CE-03', version: '1.0.0' },
  /** curriculum.plan: term-level allocation of content areas and assessment tasks. */
  model: 'curriculum.plan',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 8000, maxCostUsd: 0.1 },
  evalSetRef: 'CE-03',
  /** Term plans are ratified at the unit-blueprint level (CE-04). Human ratification
   * is a separate step on the Brain artefact, not an inline approval gate here. */
  requiresApproval: false,
  writesToBrain: true,
});
