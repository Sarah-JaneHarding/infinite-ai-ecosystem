import { describe, expect, it, vi } from 'vitest';

import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  L0NotReadyError,
  makeL0GateExecutor,
  type L0GateResult,
  type ListConstitutionFn,
  type StepExecutionContext,
  type WithTenantFn,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000001';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-1',
    stepId: 'ingest-caps-atp',
    attempt: 1,
    input: { grade: '4', subjects: ['Mathematics'], tenantId: TENANT_ID },
    ...overrides,
  };
}

function makeRow(kind: ConstitutionRow['kind'], id: string): ConstitutionRow {
  return {
    id,
    key: `${kind}:${id}`,
    kind,
    version: 1,
    content: {},
    ratifiedAt: new Date('2026-01-01'),
  };
}

function makeWithTenant(
  stub: (fn: (tx: TenantClient) => Promise<L0GateResult>) => Promise<L0GateResult>,
): WithTenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeL0GateExecutor', () => {
  it('returns capsCount and atpCount when both kinds are present', async () => {
    const rows: ConstitutionRow[] = [
      makeRow('CAPS_CANON', 'c1'),
      makeRow('CAPS_CANON', 'c2'),
      makeRow('ATP_CALENDAR', 'a1'),
    ];
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue(rows);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    const result = await executor(makeContext());

    expect(result).toEqual({ capsCount: 2, atpCount: 1 });
  });

  it('counts only CAPS_CANON when no ATP rows exist', async () => {
    const rows: ConstitutionRow[] = [makeRow('CAPS_CANON', 'c1')];
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue(rows);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    const result = await executor(makeContext());

    expect(result).toEqual({ capsCount: 1, atpCount: 0 });
  });

  it('counts only ATP_CALENDAR when no CAPS rows exist', async () => {
    const rows: ConstitutionRow[] = [makeRow('ATP_CALENDAR', 'a1')];
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue(rows);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    const result = await executor(makeContext());

    expect(result).toEqual({ capsCount: 0, atpCount: 1 });
  });

  it('throws L0NotReadyError when constitution is empty', async () => {
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);

    await expect(executor(makeContext())).rejects.toThrow(L0NotReadyError);
  });

  it('L0NotReadyError message includes the tenantId', async () => {
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);

    await expect(executor(makeContext())).rejects.toThrow(TENANT_ID);
  });

  it('throws CurriculumSeedError for invalid input', async () => {
    const listConstitution: ListConstitutionFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithTenantFn;

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    const badContext = makeContext({ input: { grade: '4' } }); // missing subjects and tenantId

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('ignores TEMPLATE rows in the counts', async () => {
    const rows: ConstitutionRow[] = [
      makeRow('CAPS_CANON', 'c1'),
      makeRow('TEMPLATE', 't1'),
      makeRow('TEMPLATE', 't2'),
    ];
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue(rows);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    const result = await executor(makeContext());

    expect(result).toEqual({ capsCount: 1, atpCount: 0 });
  });

  it('propagates errors from listConstitution', async () => {
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeL0GateExecutor(withTenant, listConstitution);

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('passes tenantId from input to withTenant', async () => {
    const rows: ConstitutionRow[] = [makeRow('CAPS_CANON', 'c1')];
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue(rows);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithTenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeL0GateExecutor(withTenant, listConstitution);
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });
});
