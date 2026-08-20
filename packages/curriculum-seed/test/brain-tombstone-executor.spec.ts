import { describe, expect, it, vi } from 'vitest';

import type { TenantClient, TombstonedBrainFact } from '@infinite-ai/db';

import type { CurriculumTombstoneResult } from '@infinite-ai/contracts';

import {
  makeTombstoneCurriculumVersionExecutor,
  type ForgetFn,
  type WithTombstoneTenantFn,
} from '../src/brain-tombstone-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const BRAIN_FACT_ID = '30000000-0000-4000-8000-000000000003';
const TOMBSTONE_ID = '40000000-0000-4000-8000-000000000004';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-tombstone-1',
    stepId: 'compensate-publish',
    attempt: 1,
    input: {
      tenantId: TENANT_ID,
      brainFactId: BRAIN_FACT_ID,
      reason: 'pipeline_compensation',
    },
    ...overrides,
  };
}

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<CurriculumTombstoneResult>,
  ) => Promise<CurriculumTombstoneResult>,
): WithTombstoneTenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeTombstoneCurriculumVersionExecutor', () => {
  it('returns tombstoneId and supersedes from forgetFn result', async () => {
    const tombstonedFact: TombstonedBrainFact = {
      id: TOMBSTONE_ID,
      supersedes: BRAIN_FACT_ID,
    };
    const forgetFn: ForgetFn = vi.fn().mockResolvedValue(tombstonedFact);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);
    const result = await executor(makeContext());

    expect(result).toEqual({ tombstoneId: TOMBSTONE_ID, supersedes: BRAIN_FACT_ID });
  });

  it('throws CurriculumSeedError for invalid input', async () => {
    const forgetFn: ForgetFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithTombstoneTenantFn;

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);
    const badContext = makeContext({ input: { tenantId: TENANT_ID } }); // missing required fields

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when reason is not pipeline_compensation', async () => {
    const forgetFn: ForgetFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithTombstoneTenantFn;

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);
    const badContext = makeContext({
      input: {
        tenantId: TENANT_ID,
        brainFactId: BRAIN_FACT_ID,
        reason: 'retention_expired',
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors thrown by forgetFn', async () => {
    const forgetFn: ForgetFn = vi.fn().mockRejectedValue(new Error('already tombstoned'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);

    await expect(executor(makeContext())).rejects.toThrow('already tombstoned');
  });

  it('passes tenantId from input to withTenant', async () => {
    const tombstonedFact: TombstonedBrainFact = {
      id: TOMBSTONE_ID,
      supersedes: BRAIN_FACT_ID,
    };
    const forgetFn: ForgetFn = vi.fn().mockResolvedValue(tombstonedFact);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithTombstoneTenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes brainFactId to forgetFn', async () => {
    const tombstonedFact: TombstonedBrainFact = {
      id: TOMBSTONE_ID,
      supersedes: BRAIN_FACT_ID,
    };
    const forgetFn: ForgetFn = vi.fn().mockResolvedValue(tombstonedFact);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeTombstoneCurriculumVersionExecutor(withTenant, forgetFn);
    await executor(makeContext());

    expect(forgetFn).toHaveBeenCalledWith(expect.anything(), BRAIN_FACT_ID);
  });
});
