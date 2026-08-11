// PD-02 Assessment Quality Analyst — Stage 12 step 2.
//
// Computes psychometric indicators (difficulty, discrimination, marking consistency)
// from AssessmentSignal data. Identifies flagged items and generates a developmental
// summary. No teacher ranking; output is about assessment quality, not teacher quality.

import { PD02Input, PD02Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const PD02Contract = validateAgentContract({
  id: 'PD-02',
  version: '1.0.0',
  module: 'MOD-05',
  purpose: 'pd_analytics',
  inputSchema: PD02Input,
  outputSchema: PD02Result,
  promptRef: { agent: 'PD-02', version: '1.0.0' },
  /** pd.assess: psychometric quality analysis over assessment item data. */
  model: 'pd.assess',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 1500, maxCostUsd: 0.005 },
  evalSetRef: 'PD-02',
  requiresApproval: false,
  writesToBrain: false,
});
