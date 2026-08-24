// MOD-03 Data Collection & Warehouse pipeline — Stage 09.
//
// MOD03_WAREHOUSE_PIPELINE — full ingest-to-insight flow:
//
//   ingest data (DW-01) → validate raw quality (DW-05) → map schema (DW-02) →
//   ◆ data-manager confirmation → check consent (DW-03) → de-identify (DW-04) →
//   build Learner-360 (DW-06) → update feature store → synthesise insights (DW-07) →
//   recommend next steps (DW-08) → record to Brain
//
// DW-02 (Schema Mapper) raises a human gate the first time a new source shape is
// seen; the data_manager confirms the mapping before the data flows further.
// The consent check (DW-03) records the lawful basis per field under POPIA; data
// that has no recorded basis does not flow to the de-identification step.
// DW-04 (De-identification Agent) is the last step before any model call that
// touches learner data — DW-07 and DW-08 only ever see tokenised records.
// DW-06 is deterministic (no model call); it materialises the Learner-360 view
// from the conformed, de-identified warehouse tables.
//
// `warehouse.update_feature_store` is an append-only write; Brain writes are also
// append-only. Both are reached only through the data_manager human gate.
//
// Structural integrity: validatePipelineDag runs at module load.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

const warehouseDefinition = {
  id: 'mod-03-warehouse',
  version: '1.0.0',
  entryStepId: 'ingest-data',
  steps: {
    // ── Stage 1: ingest ───────────────────────────────────────────────────────
    // DW-01 pulls raw records from the configured source connector and lands them
    // in the raw_ingest_record table. Deterministic — no model call involved.
    'ingest-data': {
      id: 'ingest-data',
      kind: 'agent_call' as const,
      agentId: 'DW-01',
      timeoutMs: 300_000,
      maxRetries: 3,
      compensatesWith: null,
      next: 'validate-raw-data',
    },
    // ── Stage 2: validate raw quality ─────────────────────────────────────────
    // DW-05 checks completeness, duplicates, impossible values and distribution
    // drift against the previous ingest. A quality score below the threshold
    // blocks the run rather than allowing bad data to flow downstream.
    'validate-raw-data': {
      id: 'validate-raw-data',
      kind: 'agent_call' as const,
      agentId: 'DW-05',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'map-schema',
    },
    // ── Stage 3: schema mapping ────────────────────────────────────────────────
    // DW-02 maps raw source fields to the canonical learner-event model using
    // stored mappings from source_field_mapping. When unmapped fields are seen for
    // the first time, the agent flags them for the data-manager-confirmation gate.
    'map-schema': {
      id: 'map-schema',
      kind: 'agent_call' as const,
      agentId: 'DW-02',
      timeoutMs: 180_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'data-manager-confirmation',
    },
    // ── Stage 4: data-manager human gate ──────────────────────────────────────
    // 7-day window for the data manager to confirm the schema mapping before data
    // flows further. In practice, known-shape ingests are approved quickly; new
    // source shapes require the data manager to review the field-level mapping.
    // This gate is the ◆ in the pipeline description.
    'data-manager-confirmation': {
      id: 'data-manager-confirmation',
      kind: 'human_gate' as const,
      requiredRole: 'data_manager',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'check-consent',
    },
    // ── Stage 5: consent check ─────────────────────────────────────────────────
    // DW-03 records the POPIA lawful basis and declared purpose for each field
    // that will flow downstream. Fields without a recorded basis are excluded;
    // the agent never infers or fabricates a lawful basis.
    'check-consent': {
      id: 'check-consent',
      kind: 'agent_call' as const,
      agentId: 'DW-03',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'deidentify',
    },
    // ── Stage 6: de-identification ────────────────────────────────────────────
    // DW-04 tokenises every direct identifier before any downstream model call.
    // Learner names, ID numbers and contact details never reach DW-07 or DW-08.
    deidentify: {
      id: 'deidentify',
      kind: 'agent_call' as const,
      agentId: 'DW-04',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'build-learner360',
    },
    // ── Stage 7: Learner-360 ──────────────────────────────────────────────────
    // DW-06 materialises one reconciled learner profile from the conformed,
    // de-identified warehouse tables. Deterministic — no model call involved.
    'build-learner360': {
      id: 'build-learner360',
      kind: 'agent_call' as const,
      agentId: 'DW-06',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'update-feature-store',
    },
    // ── Stage 8: feature store ────────────────────────────────────────────────
    // Writes the screening features derived from the Learner-360 into the feature
    // store so that AC-01 (Universal Screener) can read them at screen time.
    // Append-only write — reachable only through data-manager-confirmation.
    'update-feature-store': {
      id: 'update-feature-store',
      kind: 'tool_call' as const,
      toolName: 'warehouse.update_feature_store',
      timeoutMs: 60_000,
      maxRetries: 3,
      compensatesWith: null,
      next: 'synthesise-insights',
    },
    // ── Stage 9: insights ─────────────────────────────────────────────────────
    // DW-07 produces narrative insights at learner, class, grade and school level.
    // Every insight carries provenance, confidence and the source data it used;
    // an insight without a complete provenance chain fails the guardrail.
    'synthesise-insights': {
      id: 'synthesise-insights',
      kind: 'agent_call' as const,
      agentId: 'DW-07',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'recommend-next-steps',
    },
    // ── Stage 10: next steps ──────────────────────────────────────────────────
    // DW-08 translates the insights into one concrete action per learner with an
    // owner role and a due date. The next step always cites the insight it came from.
    'recommend-next-steps': {
      id: 'recommend-next-steps',
      kind: 'agent_call' as const,
      agentId: 'DW-08',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'record-to-brain',
    },
    // ── Stage 11: Brain record ────────────────────────────────────────────────
    // Append-only Brain write — the learner insight record is the final versioned
    // fact produced by this pipeline. Reachable only through data-manager-confirmation.
    // Terminal step — nothing follows it, so no compensation is needed.
    'record-to-brain': {
      id: 'record-to-brain',
      kind: 'tool_call' as const,
      toolName: 'brain.record_learner_insight',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const MOD03_WAREHOUSE_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(warehouseDefinition);

validatePipelineDag(MOD03_WAREHOUSE_PIPELINE);
