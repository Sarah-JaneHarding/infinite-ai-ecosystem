// CE-08 Differentiation Agent — Stage 08 step 3.
//
// Takes a lesson plan (CE-05) and produces tier-aware variants: support (additional
// scaffolding), on-level (same as the base lesson), and extension (greater challenge).
// Every modification must be grounded in the GradeFramework — the agent may not invent
// new learning outcomes, only adjust how existing ones are scaffolded or extended.

import { CE08Input, DifferentiationResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE08Contract = validateAgentContract({
  id: 'CE-08',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE08Input,
  outputSchema: DifferentiationResult,
  promptRef: { agent: 'CE-08', version: '1.0.0' },
  /** curriculum.differentiate: tier-aware lesson variant generation. */
  model: 'curriculum.differentiate',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 10000, maxCostUsd: 0.12 },
  evalSetRef: 'CE-08',
  requiresApproval: false,
  writesToBrain: true,
});
