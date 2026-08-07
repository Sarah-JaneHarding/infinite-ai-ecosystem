// CE-06 Assessment Designer — Stage 08 step 3.
//
// Designs a formal or informal assessment task with a controlled spread across Bloom's
// cognitive levels. Mark allocations come exclusively from the assessment policy in L0 —
// this agent may not compute or invent them. Requires HoD approval because assessments
// are consequential: they determine a learner's progress record.

import { AssessmentTaskDesignResult, CE06Input } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE06Contract = validateAgentContract({
  id: 'CE-06',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE06Input,
  outputSchema: AssessmentTaskDesignResult,
  promptRef: { agent: 'CE-06', version: '1.0.0' },
  /** curriculum.assess: task design with explicit cognitive-demand control. */
  model: 'curriculum.assess',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 10000, maxCostUsd: 0.12 },
  evalSetRef: 'CE-06',
  /** Formal assessment tasks affect learner records. requiresApproval ensures a human
   * reviews the task before it is administered. */
  requiresApproval: true,
  writesToBrain: true,
});
