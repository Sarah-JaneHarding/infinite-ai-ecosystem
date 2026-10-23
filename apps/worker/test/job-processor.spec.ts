import { MOD04_TOOLBOX_PIPELINE } from '@infinite-ai/orchestrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeTx = { marker: 'tx' };
const runToCompletion = vi.fn(async () => undefined);

vi.mock('@infinite-ai/db', () => ({
  withTenant: vi.fn(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(fakeTx),
  ),
}));
vi.mock('@infinite-ai/orchestrator', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runToCompletion: (...args: unknown[]) =>
    (runToCompletion as (...a: unknown[]) => unknown)(...args),
}));

import { withTenant } from '@infinite-ai/db';

import { processPipelineJob } from '../src/job-processor.js';

const deps = {
  agentContracts: new Map(),
  promptsRoot: '/prompts',
  gatewayBaseUrl: 'http://gateway.test',
};
const job = { runId: 'run-1', tenantId: 'tenant-1', actorId: 'actor-1' };

beforeEach(() => {
  runToCompletion.mockClear();
  vi.mocked(withTenant).mockClear();
});

describe('processPipelineJob', () => {
  it('opens one tenant-scoped transaction and runs the pipeline inside it', async () => {
    const pending = await processPipelineJob(deps, MOD04_TOOLBOX_PIPELINE, job);
    expect(pending).toEqual([]);
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', actorId: 'actor-1' },
      expect.any(Function),
    );
    expect(runToCompletion).toHaveBeenCalledOnce();
    expect(runToCompletion.mock.calls[0]?.slice(0, 3)).toEqual([
      fakeTx,
      MOD04_TOOLBOX_PIPELINE,
      'run-1',
    ]);
  });

  it('asks the payload hook for a builder inside the transaction, with the run id', async () => {
    const payloadBuilder = vi.fn(() => async () => ({ userContent: {} }));
    await processPipelineJob(deps, MOD04_TOOLBOX_PIPELINE, job, { payloadBuilder });
    expect(payloadBuilder).toHaveBeenCalledWith(fakeTx, 'run-1');
  });

  it('works with no hooks at all, as production does', async () => {
    await expect(processPipelineJob(deps, MOD04_TOOLBOX_PIPELINE, job)).resolves.toEqual(
      [],
    );
  });

  it('rejects job data that is missing a tenant, before touching the database', async () => {
    await expect(
      processPipelineJob(deps, MOD04_TOOLBOX_PIPELINE, { runId: 'r', actorId: 'a' }),
    ).rejects.toThrow();
    expect(withTenant).not.toHaveBeenCalled();
  });
});
