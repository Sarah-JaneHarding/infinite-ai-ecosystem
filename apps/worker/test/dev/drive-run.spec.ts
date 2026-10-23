import type { RunInspection } from '@infinite-ai/orchestrator';
import { describe, expect, it, vi } from 'vitest';

import { PipelineRunnerError, driveRun } from '../../src/dev/pipeline-runner.js';

const run = (status: string): RunInspection =>
  ({
    runId: 'r',
    pipelineId: 'p',
    pipelineVersion: '1',
    status,
    steps: [],
  }) as unknown as RunInspection;

const ports = (statuses: (string | null)[], advance = async () => 0) => {
  let i = 0;
  let clock = 0;
  return {
    advance: vi.fn(advance),
    read: vi.fn(async () => {
      const s = statuses[Math.min(i++, statuses.length - 1)];
      return s === null || s === undefined ? null : run(s);
    }),
    sleep: vi.fn(async (ms: number) => {
      clock += ms;
    }),
    now: () => clock,
  };
};

describe('driveRun', () => {
  it('returns as soon as the run is terminal, without sleeping', async () => {
    const p = ports(['SUCCEEDED']);
    const result = await driveRun(p, {
      timeoutMs: 10_000,
      pollMs: 1000,
      onUpdate: vi.fn(),
    });
    expect(result.status).toBe('SUCCEEDED');
    expect(p.sleep).not.toHaveBeenCalled();
  });

  it('keeps going through a human gate until a decision lets the run finish', async () => {
    const onUpdate = vi.fn();
    const p = ports([
      'RUNNING',
      'WAITING_FOR_APPROVAL',
      'WAITING_FOR_APPROVAL',
      'SUCCEEDED',
    ]);
    const result = await driveRun(p, { timeoutMs: 60_000, pollMs: 1000, onUpdate });
    expect(result.status).toBe('SUCCEEDED');
    expect(p.advance).toHaveBeenCalledTimes(4);
    expect(onUpdate).toHaveBeenCalledTimes(4);
  });

  it('stops at the timeout and reports the last state rather than hanging', async () => {
    const p = ports(['WAITING_FOR_APPROVAL']);
    const result = await driveRun(p, {
      timeoutMs: 3000,
      pollMs: 1000,
      onUpdate: vi.fn(),
    });
    expect(result.status).toBe('WAITING_FOR_APPROVAL');
  });

  it('counts the Learning-Engine jobs it did not enqueue', async () => {
    const onUpdate = vi.fn();
    const p = ports(['SUCCEEDED'], async () => 2);
    await driveRun(p, { timeoutMs: 1000, pollMs: 10, onUpdate });
    expect(onUpdate).toHaveBeenLastCalledWith(expect.anything(), 2);
  });

  it('fails loudly if the run vanishes', async () => {
    await expect(
      driveRun(ports([null]), { timeoutMs: 1000, pollMs: 10, onUpdate: vi.fn() }),
    ).rejects.toThrow(PipelineRunnerError);
  });
});
