// TB-05 Memo & Marking Guide Agent — Stage 11 step 2.
//
// Produces an answer key and marking criteria for a TB-04 assessment artefact.
// Runs an independent-verification pass: the author and verifier solve items
// separately; any disagreement blocks release and flags items for teacher
// adjudication. The marking memo is never seen by the teacher until all items agree.

import { TB05Input, TB05Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB05Contract = validateAgentContract({
  id: 'TB-05',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB05Input,
  outputSchema: TB05Result,
  promptRef: { agent: 'TB-05', version: '1.0.0' },
  /** plan.verify: two-pass verification of generated assessment answer keys. */
  model: 'plan.verify',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 3000, maxCostUsd: 0.015 },
  evalSetRef: 'TB-05',
  requiresApproval: true,
  writesToBrain: false,
});
