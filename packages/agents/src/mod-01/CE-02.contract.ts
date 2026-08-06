// CE-02 ATP Sequencer — Stage 08 step 2.
//
// Lays the topics from a ratified GradeFramework (CE-01's output, in L0) onto the DBE's
// week-by-week Annual Teaching Plan calendar, respecting holidays, exam weeks, and any
// school-specific calendar overrides. When the ATP document or the GradeFramework is
// missing or unratified, returns ATPNeedsInput rather than a partial schedule.

import { ATPResult, CE02Input } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const CE02Contract = validateAgentContract({
  id: 'CE-02',
  version: '1.0.0',
  module: 'MOD-01',
  purpose: 'planning',
  inputSchema: CE02Input,
  outputSchema: ATPResult,
  promptRef: { agent: 'CE-02', version: '1.0.0' },
  /** curriculum.sequence: calendar-layout reasoning against ratified ATP source documents. */
  model: 'curriculum.sequence',
  tools: [],
  guardrails: ['pii_guard', 'grounding_check'],
  budget: { maxTokens: 8000, maxCostUsd: 0.1 },
  evalSetRef: 'CE-02',
  /** ATP schedules are intermediate artefacts used by CE-03 Term Planner. Human
   * ratification occurs at the term plan level, not the raw ATP level. */
  requiresApproval: false,
  writesToBrain: true,
});
