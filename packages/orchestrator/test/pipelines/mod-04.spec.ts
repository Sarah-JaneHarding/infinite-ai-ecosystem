// MOD-04 Teaching & Learning Toolbox pipeline structural tests — Stage 11 step 7.
//
// These tests enforce four invariants the pipeline declaration must satisfy:
// 1. Structural integrity (validatePipelineDag).
// 2. The irreversible deliver step is gated — no path reaches it without teacher approval.
// 3. The teacher-approval human gate is correctly wired with the right role and window.
// 4. Compensation steps are present and use append-only or soft-delete semantics.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import { MOD04_TOOLBOX_PIPELINE } from '../../src/pipelines/mod-04.js';

const IRREVERSIBLE_TOOLS = new Set([
  'toolbox.deliver_artefact',
  'toolbox.capture_edit_signal',
]);

describe('MOD04_TOOLBOX_PIPELINE', () => {
  it('is a structurally valid DAG — every reference resolves and there is no forward cycle', () => {
    expect(() => validatePipelineDag(MOD04_TOOLBOX_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — deliver-artefact is only reachable through the teacher gate', () => {
    expect(() =>
      validatePipelineGating(MOD04_TOOLBOX_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('entry point is the draft-artefact step', () => {
    expect(MOD04_TOOLBOX_PIPELINE.entryStepId).toBe('draft-artefact');
    expect(MOD04_TOOLBOX_PIPELINE.steps['draft-artefact']).toBeDefined();
  });

  it('id and version are set', () => {
    expect(MOD04_TOOLBOX_PIPELINE.id).toBe('mod-04-toolbox');
    expect(MOD04_TOOLBOX_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('teacher-approval is a human_gate step with requiredRole "teacher"', () => {
    const gate = MOD04_TOOLBOX_PIPELINE.steps['teacher-approval'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('teacher');
    }
  });

  it('teacher-approval has a 7-day timeout window', () => {
    const gate = MOD04_TOOLBOX_PIPELINE.steps['teacher-approval'];
    if (gate?.kind === 'human_gate') {
      expect(gate.timeoutMs).toBe(604_800_000);
    } else {
      expect.fail('teacher-approval must be a human_gate step');
    }
  });

  it('teacher-approval step immediately precedes deliver-artefact', () => {
    const gate = MOD04_TOOLBOX_PIPELINE.steps['teacher-approval'];
    if (gate?.kind === 'human_gate') {
      expect(gate.next).toBe('deliver-artefact');
    } else {
      expect.fail('teacher-approval must be a human_gate step');
    }
  });

  it('deliver-artefact calls toolbox.deliver_artefact', () => {
    const step = MOD04_TOOLBOX_PIPELINE.steps['deliver-artefact'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('toolbox.deliver_artefact');
    }
  });

  it('deliver-artefact has a compensation step wired up', () => {
    const deliverStep = MOD04_TOOLBOX_PIPELINE.steps['deliver-artefact'];
    expect(deliverStep?.compensatesWith).toBe('compensate-deliver');

    const compensation = MOD04_TOOLBOX_PIPELINE.steps['compensate-deliver'];
    expect(compensation?.kind).toBe('compensation');
    if (compensation?.kind === 'compensation') {
      expect(compensation.compensatesStepId).toBe('deliver-artefact');
      expect(compensation.toolName).toBe('toolbox.void_delivery');
    }
  });

  it('capture-edit-signal calls toolbox.capture_edit_signal and is the final step', () => {
    const step = MOD04_TOOLBOX_PIPELINE.steps['capture-edit-signal'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('toolbox.capture_edit_signal');
      expect(step.next).toBeNull();
    }
  });

  it('draft-artefact has a compensation step wired up', () => {
    const draftStep = MOD04_TOOLBOX_PIPELINE.steps['draft-artefact'];
    expect(draftStep?.compensatesWith).toBe('compensate-draft');

    const compensation = MOD04_TOOLBOX_PIPELINE.steps['compensate-draft'];
    expect(compensation?.kind).toBe('compensation');
    if (compensation?.kind === 'compensation') {
      expect(compensation.compensatesStepId).toBe('draft-artefact');
      expect(compensation.toolName).toBe('toolbox.void_draft');
    }
  });

  it('draft-artefact dispatches via toolbox.draft_artefact (generic across all TB agents)', () => {
    const step = MOD04_TOOLBOX_PIPELINE.steps['draft-artefact'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('toolbox.draft_artefact');
    }
  });
});
