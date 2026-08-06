// CE-01 CAPS Mapper — Stage 08 step 2.
//
// Maps a grade's subject list to the full topic-and-skill GradeFramework, reading every
// value from ratified CAPS subject statements in L0. When a document is missing or
// unratified, returns FrameworkNeedsInput rather than a partial result.

import { CE01Input, FrameworkResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE01Contract = validateAgentContract({
  id: 'CE-01',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE01Input,
  outputSchema: FrameworkResult,
  promptRef: { agent: 'CE-01', version: '1.0.0' },
  /** curriculum.map: retrieval-heavy analysis against ratified CAPS source documents. */
  model: 'curriculum.map',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 6000, maxCostUsd: 0.08 },
  evalSetRef: 'CE-01',
  /** CE-01 produces intermediate curriculum structure for downstream agents (CE-02 →
   * CE-09). The result goes to L0 as a ratification candidate; human ratification happens
   * after, not as a gate on CE-01's own run. */
  requiresApproval: false,
  writesToBrain: true,
});
