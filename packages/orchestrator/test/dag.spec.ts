import { describe, expect, it } from 'vitest';

import {
  PipelineDagError,
  PipelineStep,
  validatePipelineDag,
  type PipelineDefinition,
} from '../src/dag.js';

const COMMON = { timeoutMs: 30_000, maxRetries: 2, compensatesWith: null };

function linearPipeline(): PipelineDefinition {
  return {
    id: 'ref-pipeline',
    version: '1.0.0',
    entryStepId: 'step-1',
    steps: {
      'step-1': {
        ...COMMON,
        id: 'step-1',
        kind: 'agent_call',
        agentId: 'CE-01',
        next: 'step-2',
      },
      'step-2': {
        ...COMMON,
        id: 'step-2',
        kind: 'agent_call',
        agentId: 'CE-02',
        next: 'step-3',
      },
      'step-3': {
        ...COMMON,
        id: 'step-3',
        kind: 'agent_call',
        agentId: 'CE-03',
        next: null,
      },
    },
  };
}

describe('validatePipelineDag', () => {
  it('accepts a valid linear pipeline', () => {
    expect(() => validatePipelineDag(linearPipeline())).not.toThrow();
  });

  it('accepts a pipeline with a branch step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...COMMON,
          id: 'gate',
          kind: 'branch',
          condition: 'coverage_ok',
          onTrue: 'publish',
          onFalse: 'flag',
        },
        publish: {
          ...COMMON,
          id: 'publish',
          kind: 'tool_call',
          toolName: 'publish_pack',
          next: null,
        },
        flag: {
          ...COMMON,
          id: 'flag',
          kind: 'tool_call',
          toolName: 'flag_for_review',
          next: null,
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).not.toThrow();
  });

  it('accepts a pipeline with a map step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'map-step',
      steps: {
        'map-step': {
          ...COMMON,
          id: 'map-step',
          kind: 'map',
          itemStepId: 'per-item',
          collectionField: 'learners',
          next: 'done',
        },
        'per-item': {
          ...COMMON,
          id: 'per-item',
          kind: 'agent_call',
          agentId: 'AC-01',
          next: null,
        },
        done: {
          ...COMMON,
          id: 'done',
          kind: 'tool_call',
          toolName: 'notify',
          next: null,
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).not.toThrow();
  });

  it('accepts a pipeline where a forward step declares a compensation', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'book',
      steps: {
        book: {
          ...COMMON,
          id: 'book',
          compensatesWith: 'undo-book',
          kind: 'tool_call',
          toolName: 'book_resource',
          next: 'confirm',
        },
        confirm: {
          ...COMMON,
          id: 'confirm',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: null,
        },
        'undo-book': {
          ...COMMON,
          id: 'undo-book',
          kind: 'compensation',
          compensatesStepId: 'book',
          agentId: null,
          toolName: 'release_resource',
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).not.toThrow();
  });

  it('throws when entryStepId is not a declared step', () => {
    const pipeline = linearPipeline();
    expect(() =>
      validatePipelineDag({ ...pipeline, entryStepId: 'does-not-exist' }),
    ).toThrow(PipelineDagError);
  });

  it('throws when a step’s next references an unknown step', () => {
    const pipeline = linearPipeline();
    pipeline.steps['step-3'] = {
      ...COMMON,
      id: 'step-3',
      kind: 'agent_call',
      agentId: 'CE-03',
      next: 'ghost',
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });

  it('throws when a branch references an unknown onFalse step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...COMMON,
          id: 'gate',
          kind: 'branch',
          condition: 'x',
          onTrue: 'ok',
          onFalse: 'ghost',
        },
        ok: { ...COMMON, id: 'ok', kind: 'tool_call', toolName: 't', next: null },
      },
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });

  it('throws when a map step’s itemStepId references an unknown step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'm',
      steps: {
        m: {
          ...COMMON,
          id: 'm',
          kind: 'map',
          itemStepId: 'ghost',
          collectionField: 'items',
          next: null,
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });

  it('throws when a compensation step’s compensatesStepId references an unknown step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'c',
      steps: {
        c: {
          ...COMMON,
          id: 'c',
          kind: 'compensation',
          compensatesStepId: 'ghost',
          agentId: null,
          toolName: 'undo',
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });

  it('throws when a step’s compensatesWith references an unknown step', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'a',
      steps: {
        a: {
          ...COMMON,
          id: 'a',
          compensatesWith: 'ghost',
          kind: 'tool_call',
          toolName: 't',
          next: null,
        },
      },
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });

  it('throws when the forward graph contains a cycle', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'a',
      steps: {
        a: { ...COMMON, id: 'a', kind: 'tool_call', toolName: 't', next: 'b' },
        b: { ...COMMON, id: 'b', kind: 'tool_call', toolName: 't', next: 'a' },
      },
    };
    expect(() => validatePipelineDag(pipeline)).toThrow(PipelineDagError);
  });
});

describe('PipelineStep schema', () => {
  it('parses each of the six step kinds', () => {
    const cases: unknown[] = [
      { ...COMMON, id: 'a', kind: 'agent_call', agentId: 'X', next: null },
      { ...COMMON, id: 'a', kind: 'tool_call', toolName: 'X', next: null },
      { ...COMMON, id: 'a', kind: 'human_gate', requiredRole: 'hod', next: null },
      { ...COMMON, id: 'a', kind: 'branch', condition: 'x', onTrue: 'b', onFalse: 'c' },
      {
        ...COMMON,
        id: 'a',
        kind: 'map',
        itemStepId: 'b',
        collectionField: 'x',
        next: null,
      },
      {
        ...COMMON,
        id: 'a',
        kind: 'compensation',
        compensatesStepId: 'b',
        agentId: null,
        toolName: 'undo',
      },
    ];
    for (const candidate of cases) {
      expect(PipelineStep.safeParse(candidate).success).toBe(true);
    }
  });

  it('rejects an unrecognised step kind', () => {
    expect(
      PipelineStep.safeParse({ ...COMMON, id: 'a', kind: 'delete_everything' }).success,
    ).toBe(false);
  });
});
