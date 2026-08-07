// CE-09 Coverage Auditor — Stage 08 step 5.
//
// Compares the ratified term plan (CE-03 output) against L2 episode records and
// assessment records, producing a drift report that surfaces gaps and unplanned
// deviations for HoD review. Has no learner-data access — output is curriculum
// diagnostics only.

import { CE09Input, CoverageAuditResult } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE09Contract = validateAgentContract({
  id: 'CE-09',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE09Input,
  outputSchema: CoverageAuditResult,
  promptRef: { agent: 'CE-09', version: '1.0.0' },
  /** curriculum.audit: coverage drift detection against ratified term plans. */
  model: 'curriculum.audit',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 8000, maxCostUsd: 0.1 },
  evalSetRef: 'CE-09',
  requiresApproval: false,
  writesToBrain: true,
});
