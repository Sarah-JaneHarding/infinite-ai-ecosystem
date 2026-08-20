import { describe, expect, it, vi } from 'vitest';

import type {
  BrainWriteCandidateInput,
  BrainWriteCandidateRow,
  TenantClient,
} from '@infinite-ai/db';

import type { CurriculumPublishResult } from '@infinite-ai/contracts';

import {
  makePublishCurriculumVersionExecutor,
  type RememberFn,
  type WithPublishTenantFn,
} from '../src/brain-publish-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const HOD_APPROVAL_ID = '20000000-0000-4000-8000-000000000002';
const BRAIN_FACT_ID = '30000000-0000-4000-8000-000000000003';
const RUN_ID = 'run-publish-1';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: RUN_ID,
    stepId: 'publish-to-brain',
    attempt: 1,
    input: {
      tenantId: TENANT_ID,
      grade: '7',
      subjects: ['Mathematics'],
      termNumber: 2,
      academicYear: 2026,
      hodApprovalId: HOD_APPROVAL_ID,
      content: { chapters: [] },
    },
    ...overrides,
  };
}

function makeCandidate(committedRowId: string | null): BrainWriteCandidateRow {
  return {
    id: 'cand-1',
    tenantId: TENANT_ID,
    targetTier: 'L1_NODE',
    status: committedRowId !== null ? 'RETENTION_SCHEDULED' : 'EXTRACTED',
    rawPayload: {},
    typedPayload: null,
    source: 'brain.publish_curriculum_version',
    confidence: 1,
    derivationRunId: RUN_ID,
    traceId: null,
    contradictionOf: null,
    contradictionResolution: null,
    ratifiedBy: null,
    ratifiedAt: null,
    committedRowId,
    committedVersion: committedRowId !== null ? 1 : null,
    retentionCategory: null,
    retentionRuleId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdBy: null,
  };
}

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<CurriculumPublishResult>,
  ) => Promise<CurriculumPublishResult>,
): WithPublishTenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makePublishCurriculumVersionExecutor', () => {
  it('returns brainFactId from committedRowId when remember succeeds', async () => {
    const candidate = makeCandidate(BRAIN_FACT_ID);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);
    const result = await executor(makeContext());

    expect(result).toEqual({ brainFactId: BRAIN_FACT_ID });
  });

  it('throws CurriculumSeedError for invalid input', async () => {
    const rememberFn: RememberFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithPublishTenantFn;

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);
    const badContext = makeContext({ input: { tenantId: TENANT_ID } }); // missing required fields

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when committedRowId is null', async () => {
    const candidate = makeCandidate(null);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('CurriculumSeedError message mentions status when committedRowId is null', async () => {
    const candidate = makeCandidate(null);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);

    await expect(executor(makeContext())).rejects.toThrow('EXTRACTED');
  });

  it('propagates errors thrown by rememberFn', async () => {
    const rememberFn: RememberFn = vi
      .fn()
      .mockRejectedValue(new Error('brain write failed'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);

    await expect(executor(makeContext())).rejects.toThrow('brain write failed');
  });

  it('passes tenantId from input to withTenant', async () => {
    const candidate = makeCandidate(BRAIN_FACT_ID);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithPublishTenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makePublishCurriculumVersionExecutor(withTenant, rememberFn);
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes hodApprovalId in the source field to rememberFn', async () => {
    const candidate = makeCandidate(BRAIN_FACT_ID);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const capturedInputs: BrainWriteCandidateInput[] = [];
    const capturingRemember: RememberFn = async (tx, input) => {
      capturedInputs.push(input);
      return (rememberFn as ReturnType<typeof vi.fn>)(tx, input);
    };

    const executor = makePublishCurriculumVersionExecutor(withTenant, capturingRemember);
    await executor(makeContext());

    expect(capturedInputs[0]?.source).toContain(HOD_APPROVAL_ID);
  });

  it('passes runId as derivationRunId to rememberFn', async () => {
    const candidate = makeCandidate(BRAIN_FACT_ID);
    const rememberFn: RememberFn = vi.fn().mockResolvedValue(candidate);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const capturedInputs: BrainWriteCandidateInput[] = [];
    const capturingRemember: RememberFn = async (tx, input) => {
      capturedInputs.push(input);
      return (rememberFn as ReturnType<typeof vi.fn>)(tx, input);
    };

    const executor = makePublishCurriculumVersionExecutor(withTenant, capturingRemember);
    await executor(makeContext());

    expect(capturedInputs[0]?.derivationRunId).toBe(RUN_ID);
  });
});
