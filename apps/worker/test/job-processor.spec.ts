import {
  MOD01_CURRICULUM_PIPELINE,
  MOD02_RTI_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
} from '@infinite-ai/orchestrator';
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

import { AgeCheckUnavailableError } from '../src/age-check-policy.js';
import { processPipelineJob } from '../src/job-processor.js';

const baseDeps = {
  agentContracts: new Map(),
  promptsRoot: '/prompts',
  gatewayBaseUrl: 'http://gateway.test',
};
// MOD-01 and MOD-04 are age-checked and now refuse to run without a checker (audit R05).
// These tests are about the transaction and hooks, so they supply one explicitly.
const deps = {
  ...baseDeps,
  ageAppropriatenessChecker: () => ({ passed: true as const }),
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

describe('processPipelineJob — age check fails closed (audit R05 / T09)', () => {
  const factory = vi.fn(() => () => ({ passed: true as const }));
  const factoryDeps = { ...baseDeps, ageAppropriatenessCheckerFactory: factory };

  beforeEach(() => {
    factory.mockClear();
  });

  for (const pipeline of [MOD01_CURRICULUM_PIPELINE, MOD04_TOOLBOX_PIPELINE]) {
    it(`${pipeline.id}: refuses a job with no gradePhase, before any transaction`, async () => {
      await expect(processPipelineJob(factoryDeps, pipeline, job)).rejects.toMatchObject({
        name: 'AgeCheckUnavailableError',
        reason: 'missing_grade_phase',
      });
      expect(withTenant).not.toHaveBeenCalled();
      expect(runToCompletion).not.toHaveBeenCalled();
    });

    it(`${pipeline.id}: refuses when the worker has no checker configured at all`, async () => {
      await expect(
        processPipelineJob(baseDeps, pipeline, { ...job, gradePhase: 'FOUNDATION' }),
      ).rejects.toMatchObject({ reason: 'no_checker_configured' });
      expect(withTenant).not.toHaveBeenCalled();
      expect(runToCompletion).not.toHaveBeenCalled();
    });

    it(`${pipeline.id}: runs with a phase and a factory, building the checker for that phase`, async () => {
      await processPipelineJob(factoryDeps, pipeline, { ...job, gradePhase: 'SENIOR' });
      expect(factory).toHaveBeenCalledWith(fakeTx, 'tenant-1', 'SENIOR');
      expect(runToCompletion).toHaveBeenCalledOnce();
    });
  }

  it('refuses an unknown phase value rather than guessing one', async () => {
    await expect(
      processPipelineJob(factoryDeps, MOD01_CURRICULUM_PIPELINE, {
        ...job,
        gradePhase: 'PRESCHOOL',
      }),
    ).rejects.toThrow();
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('does not touch pipelines outside the age-checked list', async () => {
    await expect(processPipelineJob(baseDeps, MOD02_RTI_PIPELINE, job)).resolves.toEqual(
      [],
    );
    expect(runToCompletion).toHaveBeenCalledOnce();
  });

  it('the error names the pipeline and says what is missing', () => {
    const err = new AgeCheckUnavailableError('p', 'missing_grade_phase');
    expect(err.message).toContain('"p"');
    expect(err.message).toContain('gradePhase');
  });
});
