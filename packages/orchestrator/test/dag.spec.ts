import { describe, expect, it } from 'vitest';

import {
  PipelineDagError,
  PipelineStep,
  validatePipelineDag,
  validatePipelineGating,
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

describe('validatePipelineGating', () => {
  const IRREVERSIBLE = new Set(['delete_record']);
  const isIrreversibleTool = (name: string): boolean => IRREVERSIBLE.has(name);

  it('accepts an irreversible tool call preceded by a human_gate', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: 'del',
        },
        del: {
          ...COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };
    expect(() => validatePipelineGating(pipeline, isIrreversibleTool)).not.toThrow();
  });

  it('accepts a non-irreversible tool call with no gate at all', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'publish',
      steps: {
        publish: {
          ...COMMON,
          id: 'publish',
          kind: 'tool_call',
          toolName: 'publish_pack',
          next: null,
        },
      },
    };
    expect(() => validatePipelineGating(pipeline, isIrreversibleTool)).not.toThrow();
  });

  it('throws when an irreversible tool call has no preceding gate at all', () => {
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'del',
      steps: {
        del: {
          ...COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };
    expect(() => validatePipelineGating(pipeline, isIrreversibleTool)).toThrow(
      PipelineDagError,
    );
  });

  it('throws when only some paths to the irreversible tool call are gated', () => {
    // A branch where onTrue passes through a gate and onFalse does not, both converging on
    // the same irreversible tool call — one ungated path is enough to fail.
    const pipeline: PipelineDefinition = {
      id: 'p',
      version: '1.0.0',
      entryStepId: 'decide',
      steps: {
        decide: {
          ...COMMON,
          id: 'decide',
          kind: 'branch',
          condition: 'needs_review',
          onTrue: 'gate',
          onFalse: 'del',
        },
        gate: {
          ...COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: 'del',
        },
        del: {
          ...COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };
    expect(() => validatePipelineGating(pipeline, isIrreversibleTool)).toThrow(
      PipelineDagError,
    );
  });

  it('does not require a gate in front of a compensation step’s own tool call', () => {
    // Compensation is invoked directly by the runner on rollback, never reached by walking
    // `next` — out of scope for this structural check (see dag.ts's own comment).
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
          next: null,
        },
        'undo-book': {
          ...COMMON,
          id: 'undo-book',
          kind: 'compensation',
          compensatesStepId: 'book',
          agentId: null,
          toolName: 'delete_record',
        },
      },
    };
    expect(() => validatePipelineGating(pipeline, isIrreversibleTool)).not.toThrow();
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
