// DW-01 Ingestion Agent — Stage 09 step 2.
//
// Pulls raw records from a configured source connector and lands them in the
// raw_ingest_record table. Deterministic orchestration — no model call, no LLM.
// Returns needs_input when the source has no active connector configured.

import { DW01Input, DW01Result } from '@infinite-ai/warehouse';

import { validateAgentContract } from '../contract.js';

export const DW01Contract = validateAgentContract({
  id: 'DW-01',
  version: '1.0.0',
  module: 'MOD-03',
  purpose: 'intervention',
  inputSchema: DW01Input,
  outputSchema: DW01Result,
  promptRef: { agent: 'DW-01', version: '1.0.0' },
  /** data.ingest: structured pull from a source connector, no generative content. */
  model: 'data.ingest',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 2000, maxCostUsd: 0.01 },
  evalSetRef: 'DW-01',
  requiresApproval: false,
  writesToBrain: false,
});
