// CE-04 Unit Architect — Stage 08 step 3.
//
// Produces a backward-design unit blueprint for one content area in one term: big ideas
// (sourced from the GradeFramework), success criteria mapped to Bloom's cognitive levels,
// and the formal and informal evidence types that will demonstrate mastery. Depends on
// the GradeFramework (CE-01) and TermPlan (CE-03) stored in L0.

import { CE04Input, UnitBlueprintResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE04Contract = validateAgentContract({
  id: 'CE-04',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE04Input,
  outputSchema: UnitBlueprintResult,
  promptRef: { agent: 'CE-04', version: '1.0.0' },
  /** curriculum.design: backward-design reasoning from outcomes to learning experiences. */
  model: 'curriculum.design',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 10000, maxCostUsd: 0.12 },
  evalSetRef: 'CE-04',
  requiresApproval: false,
  writesToBrain: true,
});
