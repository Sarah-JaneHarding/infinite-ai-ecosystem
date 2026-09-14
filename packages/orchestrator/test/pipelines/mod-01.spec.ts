// MOD-01 curriculum pipeline structural tests — Stage 08 step 4.
//
// These tests enforce four invariants that the pipeline declaration must satisfy:
// 1. Structural integrity (validatePipelineDag).
// 2. The irreversible publish step is gated — no path reaches it without HoD approval.
// 3. All nine CE agents are present in the pipeline.
// 4. The compensation step for publish uses an append-only tombstone, not a delete.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import { MOD01_CURRICULUM_PIPELINE } from '../../src/pipelines/mod-01.js';

const IRREVERSIBLE_TOOLS = new Set(['brain.publish_curriculum_version']);

describe('MOD01_CURRICULUM_PIPELINE', () => {
  it('is a structurally valid DAG — every reference resolves and there is no forward cycle', () => {
    expect(() => validatePipelineDag(MOD01_CURRICULUM_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — publish-to-brain is only reachable through the HoD gate', () => {
    expect(() =>
      validatePipelineGating(MOD01_CURRICULUM_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('entry point is the CAPS + ATP ingest step', () => {
    expect(MOD01_CURRICULUM_PIPELINE.entryStepId).toBe('ingest-caps-atp');
    expect(MOD01_CURRICULUM_PIPELINE.steps['ingest-caps-atp']).toBeDefined();
  });

  it('id and version are set', () => {
    expect(MOD01_CURRICULUM_PIPELINE.id).toBe('mod-01-curriculum');
    expect(MOD01_CURRICULUM_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('hod-approval is a human_gate step with requiredRole "hod"', () => {
    const gate = MOD01_CURRICULUM_PIPELINE.steps['hod-approval'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('hod');
    }
  });

  it('hod-approval step immediately precedes publish-to-brain', () => {
    const gate = MOD01_CURRICULUM_PIPELINE.steps['hod-approval'];
    if (gate?.kind === 'human_gate') {
      expect(gate.next).toBe('publish-to-brain');
    } else {
      expect.fail('hod-approval must be a human_gate step');
    }
  });

  it('publish-to-brain calls the brain.publish_curriculum_version tool', () => {
    const step = MOD01_CURRICULUM_PIPELINE.steps['publish-to-brain'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.publish_curriculum_version');
    }
  });

  it('publish-to-brain has a compensation step wired up', () => {
    const publishStep = MOD01_CURRICULUM_PIPELINE.steps['publish-to-brain'];
    expect(publishStep?.compensatesWith).toBe('compensate-publish');

    const compensation = MOD01_CURRICULUM_PIPELINE.steps['compensate-publish'];
    expect(compensation?.kind).toBe('compensation');
    if (compensation?.kind === 'compensation') {
      expect(compensation.compensatesStepId).toBe('publish-to-brain');
      // Brain is append-only — compensation creates a tombstone, never deletes
      expect(compensation.toolName).toBe('brain.tombstone_curriculum_version');
    }
  });

  it('all nine curriculum agents (CE-01 through CE-09) are referenced', () => {
    const agentIds = Object.values(MOD01_CURRICULUM_PIPELINE.steps)
      .filter((s) => s.kind === 'agent_call')
      .map((s) => (s.kind === 'agent_call' ? s.agentId : ''));

    for (const id of [
      'CE-01',
      'CE-02',
      'CE-03',
      'CE-04',
      'CE-05',
      'CE-06',
      'CE-07',
      'CE-08',
      'CE-09',
    ]) {
      expect(agentIds, `Expected CE agent "${id}" to be in pipeline`).toContain(id);
    }
  });

  it('audit-coverage (CE-09) is the final step — next is null', () => {
    const step = MOD01_CURRICULUM_PIPELINE.steps['audit-coverage'];
    expect(step?.kind).toBe('agent_call');
    if (step?.kind === 'agent_call') {
      expect(step.agentId).toBe('CE-09');
      expect(step.next).toBeNull();
    }
  });

  it('lesson-generating map steps target the correct agents', () => {
    const lessonItem = MOD01_CURRICULUM_PIPELINE.steps['generate-lesson-item'];
    expect(lessonItem?.kind === 'agent_call' && lessonItem.agentId).toBe('CE-05');

    const diffItem = MOD01_CURRICULUM_PIPELINE.steps['differentiate-lesson-item'];
    expect(diffItem?.kind === 'agent_call' && diffItem.agentId).toBe('CE-08');
  });

  it('assessment map steps target CE-06 and CE-07 respectively', () => {
    const assessItem = MOD01_CURRICULUM_PIPELINE.steps['design-assessment-item'];
    expect(assessItem?.kind === 'agent_call' && assessItem.agentId).toBe('CE-06');

    const rubricItem = MOD01_CURRICULUM_PIPELINE.steps['build-rubric-item'];
    expect(rubricItem?.kind === 'agent_call' && rubricItem.agentId).toBe('CE-07');
  });
});
