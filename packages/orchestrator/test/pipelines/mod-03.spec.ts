// MOD-03 Data Collection & Warehouse pipeline structural tests — Stage 49.
//
// Invariants enforced:
// 1. Structural integrity (validatePipelineDag).
// 2. Irreversible tools (warehouse.update_feature_store, brain.record_learner_insight)
//    are only reachable through the data-manager-confirmation human gate.
// 3. The pipeline is ordered correctly: ingest → validate → conform → gate → consent →
//    de-identify → Learner-360 → feature store → insights → next steps → Brain.
// 4. All eight DW agents appear in the pipeline.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import { MOD03_WAREHOUSE_PIPELINE } from '../../src/pipelines/mod-03.js';

const IRREVERSIBLE_TOOLS = new Set([
  'warehouse.update_feature_store',
  'brain.record_learner_insight',
]);

describe('MOD03_WAREHOUSE_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(MOD03_WAREHOUSE_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — irreversible writes only reachable through data-manager gate', () => {
    expect(() =>
      validatePipelineGating(MOD03_WAREHOUSE_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD03_WAREHOUSE_PIPELINE.id).toBe('mod-03-warehouse');
    expect(MOD03_WAREHOUSE_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is ingest-data', () => {
    expect(MOD03_WAREHOUSE_PIPELINE.entryStepId).toBe('ingest-data');
    expect(MOD03_WAREHOUSE_PIPELINE.steps['ingest-data']).toBeDefined();
  });

  it('ingest-data runs DW-01 and leads to validate-raw-data', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['ingest-data'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-01');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('validate-raw-data');
    }
  });

  it('validate-raw-data runs DW-05 and leads to map-schema', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['validate-raw-data'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-05');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('map-schema');
    }
  });

  it('map-schema runs DW-02 and leads to data-manager-confirmation', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['map-schema'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-02');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('data-manager-confirmation');
    }
  });

  it('data-manager-confirmation is a human_gate with requiredRole "data_manager"', () => {
    const gate = MOD03_WAREHOUSE_PIPELINE.steps['data-manager-confirmation'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('data_manager');
      expect(gate.next).toBe('check-consent');
    }
  });

  it('check-consent runs DW-03 and leads to deidentify', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['check-consent'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-03');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('deidentify');
    }
  });

  it('deidentify runs DW-04 and leads to build-learner360', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['deidentify'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-04');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('build-learner360');
    }
  });

  it('build-learner360 runs DW-06 and leads to update-feature-store', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['build-learner360'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-06');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('update-feature-store');
    }
  });

  it('update-feature-store calls warehouse.update_feature_store and leads to synthesise-insights', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['update-feature-store'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('warehouse.update_feature_store');
      expect(step.next).toBe('synthesise-insights');
    }
  });

  it('synthesise-insights runs DW-07 and leads to recommend-next-steps', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['synthesise-insights'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-07');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('recommend-next-steps');
    }
  });

  it('recommend-next-steps runs DW-08 and leads to record-to-brain', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['recommend-next-steps'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('DW-08');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('record-to-brain');
    }
  });

  it('record-to-brain calls brain.record_learner_insight and is terminal (next: null)', () => {
    const step = MOD03_WAREHOUSE_PIPELINE.steps['record-to-brain'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.record_learner_insight');
      expect(step.next).toBeNull();
    }
  });

  it('all eight DW agents (DW-01 through DW-08) appear in the pipeline', () => {
    const agentIds = Object.values(MOD03_WAREHOUSE_PIPELINE.steps)
      .filter((s) => s.kind === 'agent_call')
      .map((s) => (s.kind === 'agent_call' ? s.agentId : ''));

    for (const id of [
      'DW-01',
      'DW-02',
      'DW-03',
      'DW-04',
      'DW-05',
      'DW-06',
      'DW-07',
      'DW-08',
    ]) {
      expect(
        agentIds,
        `Expected DW agent "${id}" to appear in MOD-03 pipeline`,
      ).toContain(id);
    }
  });
});
