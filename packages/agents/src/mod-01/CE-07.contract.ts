// CE-07 Rubric Builder — Stage 08 step 3.
//
// Takes an AssessmentTaskDesign (CE-06) and produces a rubric with four-level descriptors
// and a marking memo. The rubric flows with its approved assessment task — the HoD gate
// is on CE-06, so the rubric itself does not need a separate approval record.

import { CE07Input, RubricResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE07Contract = validateAgentContract({
  id: 'CE-07',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE07Input,
  outputSchema: RubricResult,
  promptRef: { agent: 'CE-07', version: '1.0.0' },
  /** curriculum.rubric: four-level descriptor generation tied to the task's CAPS codes. */
  model: 'curriculum.rubric',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 8000, maxCostUsd: 0.1 },
  evalSetRef: 'CE-07',
  requiresApproval: false,
  writesToBrain: true,
});
