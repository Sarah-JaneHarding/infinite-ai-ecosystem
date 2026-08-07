// CE-05 Lesson Plan Generator — Stage 08 step 3.
//
// Generates a full week's daily lesson plans by filling the school's approved template
// from the unit blueprint CE-04 produced. Output goes directly into teacher hands so it
// requires explicit HoD approval before it is published or distributed. Depends on the
// GradeFramework (CE-01), UnitBlueprint (CE-04), and a ratified TemplateDefinition.

import { CE05Input, LessonPlanResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE05Contract = validateAgentContract({
  id: 'CE-05',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE05Input,
  outputSchema: LessonPlanResult,
  promptRef: { agent: 'CE-05', version: '1.0.0' },
  /** curriculum.lessons: daily plan generation against a validated template. */
  model: 'curriculum.lessons',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check', 'template_fidelity'],
  budget: { maxTokens: 12000, maxCostUsd: 0.15 },
  evalSetRef: 'CE-05',
  /** Lesson plans go directly to teachers and may reach learners. The HoD gate in
   * the pipeline is before publish; requiresApproval signals that this agent's output
   * must not be published without a human approval record. */
  requiresApproval: true,
  writesToBrain: true,
});
