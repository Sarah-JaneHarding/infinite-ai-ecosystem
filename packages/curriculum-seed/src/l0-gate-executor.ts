// l0.ingest_ratified_source executor factory — Stage 31.
//
// Returns a StepExecutor (packages/orchestrator StepExecutionContext → Promise<unknown>)
// that:
//   1. Parses CE01Input from context.input.
//   2. Opens a tenant-scoped read transaction for context.input.tenantId.
//   3. Calls listEffectiveConstitution to fetch all ratified L0 rows.
//   4. Counts CAPS_CANON and ATP_CALENDAR records.
//   5. Throws L0NotReadyError if both counts are zero (L0 unpopulated).
//   6. Returns { capsCount, atpCount } so the runner can log it to the step output.
//
// The factory accepts injected dependencies so the executor is unit-testable without a
// real database.

import { CE01Input } from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import { CurriculumSeedError } from './types.js';

export interface L0GateResult {
  readonly capsCount: number;
  readonly atpCount: number;
}

export type WithTenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<L0GateResult>,
) => Promise<L0GateResult>;

export type ListConstitutionFn = (
  tx: TenantClient,
) => Promise<readonly ConstitutionRow[]>;

export type StepExecutionContext = {
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly input: unknown;
};

export class L0NotReadyError extends Error {
  public override readonly name = 'L0NotReadyError';
  constructor(tenantId: string) {
    super(
      `L0 constitution is empty for tenant ${tenantId}. ` +
        'Run pnpm curriculum:seed && pnpm curriculum:ratify before starting MOD-01.',
    );
  }
}

/**
 * Returns a StepExecutor for the l0.ingest_ratified_source pipeline step.
 * The executor opens a tenant-scoped read and verifies L0 is populated; throws
 * L0NotReadyError if no CAPS_CANON or ATP_CALENDAR rows exist yet.
 */
export function makeL0GateExecutor(
  withTenant: WithTenantFn,
  listConstitution: ListConstitutionFn,
): (context: StepExecutionContext) => Promise<L0GateResult> {
  return async (context: StepExecutionContext): Promise<L0GateResult> => {
    const parsed = CE01Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `l0.ingest_ratified_source received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId } = parsed.data;

    return withTenant({ tenantId, actorId: 'l0-gate-executor' }, async (tx) => {
      const rows = await listConstitution(tx);
      const capsCount = rows.filter((r) => r.kind === 'CAPS_CANON').length;
      const atpCount = rows.filter((r) => r.kind === 'ATP_CALENDAR').length;

      if (capsCount === 0 && atpCount === 0) {
        throw new L0NotReadyError(tenantId);
      }

      return { capsCount, atpCount };
    });
  };
}
