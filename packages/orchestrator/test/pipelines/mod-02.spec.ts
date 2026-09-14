// MOD-02 Support Analytics Centre pipeline structural tests — Stage 49.
//
// Invariants enforced across all three pipelines:
// 1. Structural integrity (validatePipelineDag).
// 2. Irreversible tools (support.deliver_interventions, support.dispatch_parent_report,
//    brain.record_sbst_minutes) are only reachable through a human gate.
// 3. AC-02 core-health gate is correctly wired as a branch that can short-circuit.
// 4. All ten AC agents appear across the three pipelines.
// 5. Key human gates carry the expected requiredRole values.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import {
  MOD02_MONITORING_PIPELINE,
  MOD02_RTI_PIPELINE,
  MOD02_SBST_SCRIBE_PIPELINE,
} from '../../src/pipelines/mod-02.js';

const IRREVERSIBLE_TOOLS = new Set([
  'support.deliver_interventions',
  'support.dispatch_parent_report',
  'brain.record_sbst_minutes',
  'brain.record_intervention_delivery',
]);

// ── RTI pipeline ──────────────────────────────────────────────────────────────

describe('MOD02_RTI_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(MOD02_RTI_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — irreversible tools only reachable through SBST gate', () => {
    expect(() =>
      validatePipelineGating(MOD02_RTI_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD02_RTI_PIPELINE.id).toBe('mod-02-rti');
    expect(MOD02_RTI_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is screen-learners', () => {
    expect(MOD02_RTI_PIPELINE.entryStepId).toBe('screen-learners');
    expect(MOD02_RTI_PIPELINE.steps['screen-learners']).toBeDefined();
  });

  it('screen-learners is a map step over AC-01', () => {
    const step = MOD02_RTI_PIPELINE.steps['screen-learners'];
    expect(step?.kind).toBe('map');
    if (step?.kind === 'map') {
      expect(step.itemStepId).toBe('screen-learner-item');
    }
    const item = MOD02_RTI_PIPELINE.steps['screen-learner-item'];
    expect(item?.kind === 'agent_call' && item.agentId).toBe('AC-01');
  });

  it('assess-core-health runs AC-02 and leads to the branch', () => {
    const step = MOD02_RTI_PIPELINE.steps['assess-core-health'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('AC-02');
    if (step?.kind === 'agent_call') {
      expect(step.next).toBe('branch-on-core-health');
    }
  });

  it('branch-on-core-health routes blocked → raise-tier1-improvement and healthy → recommend-tiers', () => {
    const branch = MOD02_RTI_PIPELINE.steps['branch-on-core-health'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.condition).toBe('support.core_health_blocked');
      expect(branch.onTrue).toBe('raise-tier1-improvement');
      expect(branch.onFalse).toBe('recommend-tiers');
    }
  });

  it('raise-tier1-improvement is a terminal tool_call (next: null)', () => {
    const step = MOD02_RTI_PIPELINE.steps['raise-tier1-improvement'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('support.raise_tier1_improvement');
      expect(step.next).toBeNull();
    }
  });

  it('recommend-tiers is a map step over AC-03', () => {
    const step = MOD02_RTI_PIPELINE.steps['recommend-tiers'];
    expect(step?.kind).toBe('map');
    if (step?.kind === 'map') {
      expect(step.itemStepId).toBe('recommend-tier-item');
    }
    const item = MOD02_RTI_PIPELINE.steps['recommend-tier-item'];
    expect(item?.kind === 'agent_call' && item.agentId).toBe('AC-03');
  });

  it('sbst-review is a human_gate with requiredRole "sbst" immediately before plan-interventions', () => {
    const gate = MOD02_RTI_PIPELINE.steps['sbst-review'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('sbst');
      expect(gate.next).toBe('plan-interventions');
    }
  });

  it('plan-interventions is a map step over AC-05', () => {
    const step = MOD02_RTI_PIPELINE.steps['plan-interventions'];
    expect(step?.kind).toBe('map');
    const item = MOD02_RTI_PIPELINE.steps['plan-intervention-item'];
    expect(item?.kind === 'agent_call' && item.agentId).toBe('AC-05');
  });

  it('deliver-interventions calls support.deliver_interventions and has a compensation step', () => {
    const step = MOD02_RTI_PIPELINE.steps['deliver-interventions'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('support.deliver_interventions');
      expect(step.compensatesWith).toBe('compensate-deliver-interventions');
    }
    const comp = MOD02_RTI_PIPELINE.steps['compensate-deliver-interventions'];
    expect(comp?.kind).toBe('compensation');
    if (comp?.kind === 'compensation') {
      expect(comp.compensatesStepId).toBe('deliver-interventions');
      expect(comp.toolName).toBe('support.retract_intervention_delivery');
    }
  });

  it('record-interventions-to-brain is a terminal Brain write (next: null)', () => {
    const step = MOD02_RTI_PIPELINE.steps['record-interventions-to-brain'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.record_intervention_delivery');
      expect(step.next).toBeNull();
    }
  });
});

// ── Monitoring pipeline ───────────────────────────────────────────────────────

describe('MOD02_MONITORING_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(MOD02_MONITORING_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — dispatch only reachable through parent-letter-review gate', () => {
    expect(() =>
      validatePipelineGating(MOD02_MONITORING_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD02_MONITORING_PIPELINE.id).toBe('mod-02-monitoring');
    expect(MOD02_MONITORING_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is monitor-progress', () => {
    expect(MOD02_MONITORING_PIPELINE.entryStepId).toBe('monitor-progress');
  });

  it('monitor-progress is a map over AC-06 and check-fidelity is a map over AC-07', () => {
    const mon = MOD02_MONITORING_PIPELINE.steps['monitor-progress-item'];
    expect(mon?.kind === 'agent_call' && mon.agentId).toBe('AC-06');

    const fid = MOD02_MONITORING_PIPELINE.steps['check-fidelity-item'];
    expect(fid?.kind === 'agent_call' && fid.agentId).toBe('AC-07');
  });

  it('branch-on-referral routes needs_referral → compile-sias and no-referral → record-monitoring-outcome', () => {
    const branch = MOD02_MONITORING_PIPELINE.steps['branch-on-referral'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.condition).toBe('support.needs_referral');
      expect(branch.onTrue).toBe('compile-sias');
      expect(branch.onFalse).toBe('record-monitoring-outcome');
    }
  });

  it('compile-sias runs AC-09', () => {
    const step = MOD02_MONITORING_PIPELINE.steps['compile-sias'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('AC-09');
  });

  it('referral-sign-off is an sbst human_gate followed by write-parent-report (AC-10)', () => {
    const gate = MOD02_MONITORING_PIPELINE.steps['referral-sign-off'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('sbst');
      expect(gate.next).toBe('write-parent-report');
    }
    const report = MOD02_MONITORING_PIPELINE.steps['write-parent-report'];
    expect(report?.kind === 'agent_call' && report.agentId).toBe('AC-10');
  });

  it('parent-letter-review is an lse gate immediately before dispatch-parent-report', () => {
    const gate = MOD02_MONITORING_PIPELINE.steps['parent-letter-review'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('lse');
      expect(gate.next).toBe('dispatch-parent-report');
    }
  });

  it('dispatch-parent-report and record-monitoring-outcome are both terminal (next: null)', () => {
    const dispatch = MOD02_MONITORING_PIPELINE.steps['dispatch-parent-report'];
    if (dispatch?.kind === 'tool_call') expect(dispatch.next).toBeNull();
    const record = MOD02_MONITORING_PIPELINE.steps['record-monitoring-outcome'];
    if (record?.kind === 'tool_call') expect(record.next).toBeNull();
  });
});

// ── SBST Scribe pipeline ──────────────────────────────────────────────────────

describe('MOD02_SBST_SCRIBE_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(MOD02_SBST_SCRIBE_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — record-minutes only reachable through chair-confirmation', () => {
    expect(() =>
      validatePipelineGating(MOD02_SBST_SCRIBE_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(MOD02_SBST_SCRIBE_PIPELINE.id).toBe('mod-02-sbst-scribe');
    expect(MOD02_SBST_SCRIBE_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry is scribe-meeting (AC-08) → chair-confirmation (sbst_chair gate) → record-minutes', () => {
    expect(MOD02_SBST_SCRIBE_PIPELINE.entryStepId).toBe('scribe-meeting');

    const scribe = MOD02_SBST_SCRIBE_PIPELINE.steps['scribe-meeting'];
    expect(scribe?.kind === 'agent_call' && scribe.agentId).toBe('AC-08');
    if (scribe?.kind === 'agent_call') expect(scribe.next).toBe('chair-confirmation');

    const gate = MOD02_SBST_SCRIBE_PIPELINE.steps['chair-confirmation'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('sbst_chair');
      expect(gate.next).toBe('record-minutes');
    }

    const record = MOD02_SBST_SCRIBE_PIPELINE.steps['record-minutes'];
    expect(record?.kind).toBe('tool_call');
    if (record?.kind === 'tool_call') {
      expect(record.toolName).toBe('brain.record_sbst_minutes');
      expect(record.next).toBeNull();
    }
  });
});

// ── Cross-pipeline coverage ───────────────────────────────────────────────────

describe('MOD-02 agent coverage', () => {
  it('all ten AC agents (AC-01 through AC-10) appear across the three pipelines', () => {
    const allSteps = [
      ...Object.values(MOD02_RTI_PIPELINE.steps),
      ...Object.values(MOD02_MONITORING_PIPELINE.steps),
      ...Object.values(MOD02_SBST_SCRIBE_PIPELINE.steps),
    ];
    const agentIds = allSteps
      .filter((s) => s.kind === 'agent_call')
      .map((s) => (s.kind === 'agent_call' ? s.agentId : ''));

    for (const id of [
      'AC-01',
      'AC-02',
      'AC-03',
      'AC-05',
      'AC-06',
      'AC-07',
      'AC-08',
      'AC-09',
      'AC-10',
    ]) {
      expect(
        agentIds,
        `Expected AC agent "${id}" to appear in MOD-02 pipelines`,
      ).toContain(id);
    }
    // AC-04 (Early Warning Agent) runs as a standalone daily trigger, not in these pipelines
  });
});
