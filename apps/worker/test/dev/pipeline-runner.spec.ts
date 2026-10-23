import {
  MOD01_CURRICULUM_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
} from '@infinite-ai/orchestrator';
import { describe, expect, it } from 'vitest';

import {
  PipelineRunnerError,
  bindingFor,
  pipelineInputTemplate,
  summariseRun,
  validatePipelineInput,
} from '../../src/dev/pipeline-runner.js';
import { PIPELINE_QUEUE_BINDINGS } from '../../src/pipeline-bindings.js';
import { buildAgentContractMap, buildPipelineMap } from '../../src/index.js';

const contracts = buildAgentContractMap();

describe('PIPELINE_QUEUE_BINDINGS', () => {
  it('binds every pipeline the worker knows, exactly once, on its own queue', () => {
    const ids = PIPELINE_QUEUE_BINDINGS.map((b) => b.pipeline.id).sort();
    expect(ids).toEqual([...buildPipelineMap().keys()].sort());
    expect(new Set(PIPELINE_QUEUE_BINDINGS.map((b) => b.queue)).size).toBe(ids.length);
  });
});

describe('bindingFor', () => {
  it('finds a pipeline by id', () => {
    expect(bindingFor(MOD01_CURRICULUM_PIPELINE.id).queue).toBe('mod-01');
  });

  it('refuses an unknown pipeline and lists the known ones', () => {
    expect(() => bindingFor('mod-99')).toThrow(PipelineRunnerError);
    expect(() => bindingFor('mod-99')).toThrow(/mod-01-curriculum/);
  });
});

describe('validatePipelineInput / pipelineInputTemplate', () => {
  it('reports problems for an empty input, naming the agent and field', () => {
    const issues = validatePipelineInput(MOD01_CURRICULUM_PIPELINE, contracts, {});
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join('\n')).toMatch(/CE-0\d/);
  });

  it('requires the collections the pipeline maps over to be arrays', () => {
    const issues = validatePipelineInput(MOD01_CURRICULUM_PIPELINE, contracts, {
      contentAreas: 'not-an-array',
    });
    expect(issues.join('\n')).toMatch(/"contentAreas" must be an array/);
  });

  it('builds a template that has the mapped collections as arrays', () => {
    const template = pipelineInputTemplate(MOD01_CURRICULUM_PIPELINE, contracts);
    expect(Array.isArray(template['contentAreas'])).toBe(true);
    expect(Array.isArray(template['units'])).toBe(true);
  });

  it('accepts any input for a pipeline whose steps call no agent directly', () => {
    expect(validatePipelineInput(MOD04_TOOLBOX_PIPELINE, contracts, { x: 1 })).toEqual(
      [],
    );
  });
});

describe('summariseRun', () => {
  it('prints one line per step attempt with its error trimmed', () => {
    const text = summariseRun({
      runId: 'r',
      pipelineId: 'p',
      pipelineVersion: '1.0.0',
      status: 'FAILED',
      traceId: 't',
      currentStepId: 'a',
      entryStepId: 'a',
      steps: [
        {
          stepId: 'a',
          kind: 'agent_call',
          attempt: 0,
          status: 'FAILED',
          input: {},
          output: null,
          error: 'x'.repeat(500),
          tokensUsed: null,
          costUsd: null,
          retrievedContext: null,
          guardrailVerdicts: null,
          latencyMs: 12,
          startedAt: null,
          completedAt: null,
        },
      ],
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 12,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    expect(text).toMatch(/status FAILED/);
    expect(text.split('\n')).toHaveLength(2);
    expect(text.split('\n')[1]?.length).toBeLessThan(260);
  });
});
