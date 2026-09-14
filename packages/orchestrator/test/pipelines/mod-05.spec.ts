// MOD-05 Teaching Analytics & PD Studio pipeline structural tests — Stage 12 step 5.
//
// Invariants enforced across both pipelines:
// 1. Structural integrity (validatePipelineDag) — every reference resolves, no cycle.
// 2. deliver-pd-intervention is gated — no path reaches it without HoD approval.
// 3. The hod-approval gate is wired with the right role and 7-day timeout.
// 4. The suppression branch short-circuits before any need profile is produced.
// 5. Both intervention branches (micro-course, coaching) converge at hod-approval.
// 6. No ranking fields — nothing in the pipeline introduces rank/percentile/ordinal.
// 7. CPTD pipeline: PD-08 runs first, then Brain write; no human gate needed.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import {
  MOD05_CPTD_PIPELINE,
  MOD05_PD_ANALYSIS_PIPELINE,
} from '../../src/pipelines/mod-05.js';

const IRREVERSIBLE_TOOLS = new Set(['pd.deliver_pd_intervention']);

// ─────────────────────────────────────────────────────────────────────────────
// MOD05_PD_ANALYSIS_PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

describe('MOD05_PD_ANALYSIS_PIPELINE', () => {
  it('is a structurally valid DAG — every reference resolves and there is no forward cycle', () => {
    expect(() => validatePipelineDag(MOD05_PD_ANALYSIS_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — deliver-pd-intervention only reachable through HoD gate', () => {
    expect(() =>
      validatePipelineGating(MOD05_PD_ANALYSIS_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD05_PD_ANALYSIS_PIPELINE.id).toBe('mod-05-pd-analysis');
    expect(MOD05_PD_ANALYSIS_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is aggregate-signals (PD-04)', () => {
    expect(MOD05_PD_ANALYSIS_PIPELINE.entryStepId).toBe('aggregate-signals');
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['aggregate-signals'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('PD-04');
    }
  });

  it('aggregate-signals leads to branch-on-suppression', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['aggregate-signals'];
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('branch-on-suppression');
    } else {
      expect.fail('aggregate-signals must be an agent_call step');
    }
  });

  it('branch-on-suppression onTrue goes to record-suppression (short-circuit)', () => {
    const branch = MOD05_PD_ANALYSIS_PIPELINE.steps['branch-on-suppression'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.onTrue).toBe('record-suppression');
    }
  });

  it('branch-on-suppression onFalse leads to detect-gaps (PD-05)', () => {
    const branch = MOD05_PD_ANALYSIS_PIPELINE.steps['branch-on-suppression'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.onFalse).toBe('detect-gaps');
    }
  });

  it('record-suppression is a tool_call that terminates (next: null)', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['record-suppression'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('pd.record_suppression');
      expect(step.next).toBeNull();
    }
  });

  it('detect-gaps calls PD-05 and leads to branch-on-intervention', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['detect-gaps'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('PD-05');
      expect(step.next).toBe('branch-on-intervention');
    }
  });

  it('branch-on-intervention onTrue goes to compose-micro-courses (PD-06 map)', () => {
    const branch = MOD05_PD_ANALYSIS_PIPELINE.steps['branch-on-intervention'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.onTrue).toBe('compose-micro-courses');
    }
  });

  it('branch-on-intervention onFalse goes to compose-coaching-plan (PD-07)', () => {
    const branch = MOD05_PD_ANALYSIS_PIPELINE.steps['branch-on-intervention'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.onFalse).toBe('compose-coaching-plan');
    }
  });

  it('compose-micro-courses is a map step over the gaps collection', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['compose-micro-courses'];
    expect(step?.kind).toBe('map');
    if (step?.kind === 'map') {
      expect(step.collectionField).toBe('gaps');
      expect(step.itemStepId).toBe('compose-micro-course-item');
      expect(step.next).toBe('hod-approval');
    }
  });

  it('compose-micro-course-item calls PD-06', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['compose-micro-course-item'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('PD-06');
      expect(step.next).toBeNull();
    }
  });

  it('compose-coaching-plan calls PD-07 and converges at hod-approval', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['compose-coaching-plan'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('PD-07');
      expect(step.next).toBe('hod-approval');
    }
  });

  it('hod-approval is a human_gate with requiredRole "hod"', () => {
    const gate = MOD05_PD_ANALYSIS_PIPELINE.steps['hod-approval'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('hod');
    }
  });

  it('hod-approval has a 7-day timeout window', () => {
    const gate = MOD05_PD_ANALYSIS_PIPELINE.steps['hod-approval'];
    if (gate?.kind === 'human_gate') {
      expect(gate.timeoutMs).toBe(604_800_000);
    } else {
      expect.fail('hod-approval must be a human_gate step');
    }
  });

  it('hod-approval immediately precedes deliver-pd-intervention', () => {
    const gate = MOD05_PD_ANALYSIS_PIPELINE.steps['hod-approval'];
    if (gate?.kind === 'human_gate') {
      expect(gate.next).toBe('deliver-pd-intervention');
    } else {
      expect.fail('hod-approval must be a human_gate step');
    }
  });

  it('deliver-pd-intervention calls pd.deliver_pd_intervention', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['deliver-pd-intervention'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('pd.deliver_pd_intervention');
    }
  });

  it('deliver-pd-intervention has a compensation step wired up', () => {
    const deliverStep = MOD05_PD_ANALYSIS_PIPELINE.steps['deliver-pd-intervention'];
    expect(deliverStep?.compensatesWith).toBe('compensate-deliver');

    const compensation = MOD05_PD_ANALYSIS_PIPELINE.steps['compensate-deliver'];
    expect(compensation?.kind).toBe('compensation');
    if (compensation?.kind === 'compensation') {
      expect(compensation.compensatesStepId).toBe('deliver-pd-intervention');
      expect(compensation.toolName).toBe('pd.retract_pd_intervention');
    }
  });

  it('record-to-brain writes to brain.record_pd_intervention and is the final forward step', () => {
    const step = MOD05_PD_ANALYSIS_PIPELINE.steps['record-to-brain'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.record_pd_intervention');
      expect(step.next).toBeNull();
    }
  });

  it('no step carries a rank, percentile or ordinal field', () => {
    for (const step of Object.values(MOD05_PD_ANALYSIS_PIPELINE.steps)) {
      const stepStr = JSON.stringify(step);
      expect(stepStr).not.toContain('"rank"');
      expect(stepStr).not.toContain('"percentile"');
      expect(stepStr).not.toContain('"ordinal"');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MOD05_CPTD_PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

describe('MOD05_CPTD_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(MOD05_CPTD_PIPELINE)).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD05_CPTD_PIPELINE.id).toBe('mod-05-cptd');
    expect(MOD05_CPTD_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is compute-cptd (PD-08)', () => {
    expect(MOD05_CPTD_PIPELINE.entryStepId).toBe('compute-cptd');
    const step = MOD05_CPTD_PIPELINE.steps['compute-cptd'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('PD-08');
    }
  });

  it('compute-cptd leads to record-cptd', () => {
    const step = MOD05_CPTD_PIPELINE.steps['compute-cptd'];
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('record-cptd');
    } else {
      expect.fail('compute-cptd must be an agent_call step');
    }
  });

  it('record-cptd writes to brain.record_cptd_activity and terminates', () => {
    const step = MOD05_CPTD_PIPELINE.steps['record-cptd'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.record_cptd_activity');
      expect(step.next).toBeNull();
    }
  });

  it('CPTD pipeline has no human gate — CPTD recording requires no approval', () => {
    const hasHumanGate = Object.values(MOD05_CPTD_PIPELINE.steps).some(
      (s) => s.kind === 'human_gate',
    );
    expect(hasHumanGate).toBe(false);
  });
});
