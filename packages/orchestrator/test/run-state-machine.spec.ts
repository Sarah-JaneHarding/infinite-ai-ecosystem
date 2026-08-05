import { describe, expect, it } from 'vitest';

import type { PipelineDefinition } from '../src/dag.js';
import {
  OrchestratorError,
  compensationChain,
  computeRetryDelayMs,
  hasTimedOut,
  nextStepAfterSuccess,
  shouldRetry,
} from '../src/run-state-machine.js';

const COMMON = { timeoutMs: 1000, maxRetries: 2, compensatesWith: null };

describe('computeRetryDelayMs', () => {
  it('returns 0 when random() returns 0', () => {
    expect(computeRetryDelayMs(0, 100, 10_000, () => 0)).toBe(0);
  });

  it('returns exactly the ceiling when random() returns 1', () => {
    expect(computeRetryDelayMs(0, 100, 10_000, () => 1)).toBe(100);
    expect(computeRetryDelayMs(3, 100, 10_000, () => 1)).toBe(800); // 100 * 2^3
  });

  it('caps the ceiling at maxMs once the exponential exceeds it', () => {
    expect(computeRetryDelayMs(10, 100, 5_000, () => 1)).toBe(5_000);
  });

  it('throws for a negative attempt', () => {
    expect(() => computeRetryDelayMs(-1, 100, 10_000)).toThrow(OrchestratorError);
  });
});

describe('shouldRetry', () => {
  it('allows a retry while attempt is below maxRetries', () => {
    expect(shouldRetry(0, 2)).toBe(true);
    expect(shouldRetry(1, 2)).toBe(true);
  });

  it('refuses once attempt has reached maxRetries', () => {
    expect(shouldRetry(2, 2)).toBe(false);
  });

  it('refuses immediately when maxRetries is 0', () => {
    expect(shouldRetry(0, 0)).toBe(false);
  });
});

describe('hasTimedOut', () => {
  const startedAt = new Date('2026-08-05T00:00:00.000Z');

  it('is false before the timeout elapses', () => {
    const now = new Date('2026-08-05T00:00:09.999Z');
    expect(hasTimedOut(startedAt, 10_000, now)).toBe(false);
  });

  it('is true exactly at the timeout boundary', () => {
    const now = new Date('2026-08-05T00:00:10.000Z');
    expect(hasTimedOut(startedAt, 10_000, now)).toBe(true);
  });

  it('is true well past the timeout', () => {
    const now = new Date('2026-08-05T00:01:00.000Z');
    expect(hasTimedOut(startedAt, 10_000, now)).toBe(true);
  });
});

describe('nextStepAfterSuccess', () => {
  it('returns next for an agent_call step', () => {
    expect(
      nextStepAfterSuccess({
        ...COMMON,
        id: 'a',
        kind: 'agent_call',
        agentId: 'X',
        next: 'b',
      }),
    ).toBe('b');
  });

  it('returns null for a terminal step', () => {
    expect(
      nextStepAfterSuccess({
        ...COMMON,
        id: 'a',
        kind: 'tool_call',
        toolName: 'X',
        next: null,
      }),
    ).toBeNull();
  });

  it('returns onTrue or onFalse for a branch, per the evaluated condition', () => {
    const branch = {
      ...COMMON,
      id: 'gate',
      kind: 'branch' as const,
      condition: 'x',
      onTrue: 'yes',
      onFalse: 'no',
    };
    expect(nextStepAfterSuccess(branch, true)).toBe('yes');
    expect(nextStepAfterSuccess(branch, false)).toBe('no');
  });

  it('throws for a branch with no evaluated result supplied', () => {
    const branch = {
      ...COMMON,
      id: 'gate',
      kind: 'branch' as const,
      condition: 'x',
      onTrue: 'yes',
      onFalse: 'no',
    };
    expect(() => nextStepAfterSuccess(branch)).toThrow(OrchestratorError);
  });

  it('returns null for a compensation step', () => {
    expect(
      nextStepAfterSuccess({
        ...COMMON,
        id: 'undo',
        kind: 'compensation',
        compensatesStepId: 'a',
        agentId: null,
        toolName: 'undo_it',
      }),
    ).toBeNull();
  });
});

describe('compensationChain', () => {
  const pipeline: PipelineDefinition = {
    id: 'p',
    version: '1.0.0',
    entryStepId: 'a',
    steps: {
      a: {
        ...COMMON,
        id: 'a',
        compensatesWith: 'undo-a',
        kind: 'tool_call',
        toolName: 't',
        next: 'b',
      },
      b: { ...COMMON, id: 'b', kind: 'tool_call', toolName: 't', next: 'c' },
      c: {
        ...COMMON,
        id: 'c',
        compensatesWith: 'undo-c',
        kind: 'tool_call',
        toolName: 't',
        next: null,
      },
      'undo-a': {
        ...COMMON,
        id: 'undo-a',
        kind: 'compensation',
        compensatesStepId: 'a',
        agentId: null,
        toolName: 'undo',
      },
      'undo-c': {
        ...COMMON,
        id: 'undo-c',
        kind: 'compensation',
        compensatesStepId: 'c',
        agentId: null,
        toolName: 'undo',
      },
    },
  };

  it('returns compensations in reverse order of success, skipping steps with none', () => {
    expect(compensationChain(pipeline, ['a', 'b', 'c'])).toEqual(['undo-c', 'undo-a']);
  });

  it('returns an empty chain when nothing has succeeded yet', () => {
    expect(compensationChain(pipeline, [])).toEqual([]);
  });

  it('returns an empty chain when no succeeded step has a compensation', () => {
    expect(compensationChain(pipeline, ['b'])).toEqual([]);
  });
});
