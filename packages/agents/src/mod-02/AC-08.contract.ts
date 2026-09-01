// AC-08 SBST Meeting Scribe — Stage 10 step 4.
//
// Takes a structured meeting agenda and produces minutes, per-learner decisions, and
// next steps. Every ratified decision generates an sbstRatificationId that downstream
// agents (AC-05, AC-09, AC-10) require as proof of the human gate. The chair must
// confirm the minutes before they enter the Brain record.

import { AC08Input, AC08Result } from '@infinite-ai/analytics';

import { validateAgentContract } from '../contract.js';

export const AC08Contract = validateAgentContract({
  id: 'AC-08',
  version: '1.0.0',
  module: 'MOD-02',
  purpose: 'intervention',
  inputSchema: AC08Input,
  outputSchema: AC08Result,
  promptRef: { agent: 'AC-08', version: '1.0.0' },
  model: 'support.screen',
  tools: [],
  guardrails: ['pii_guard', 'diagnosis_guard'],
  /** 'scribed'.actionItems (meeting-level text), each decision's own nextSteps (an array
   * nested inside the decisions array), and 'needs_input'.detail. */
  freeTextOutputFields: ['actionItems', 'decisions.nextSteps', 'detail'],
  budget: { maxTokens: 2000, maxCostUsd: 0.006 },
  evalSetRef: 'AC-08',
  requiresApproval: true,
  writesToBrain: true,
});
