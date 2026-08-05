// The DAG orchestrator's persistence primitives — Stage 06 step 4.
//
// "The runner must provide durability (state persisted per step)... and resumability."
// This module is the imperative shell, not the state machine: it knows how to persist one
// run, one step attempt, and one transition of either — it does not decide which
// transition comes next, whether a step should retry, or which compensations a failure
// triggers. That sequencing is `packages/orchestrator`'s job, the same division of labour
// `brain-write-path.ts` already draws against `packages/brain`'s write path.
//
// Two tables, both mutable workflow state rather than a fact ledger — see the migration's
// own header for why neither joins `APPEND_ONLY_TABLES`. A retry of the same step is a
// new `OrchestratorStepRun` row (same `stepId`, next `attempt`), never an update to the
// previous attempt's row, so a step's full history — every attempt, every outcome — stays
// readable after the fact.

import type { Prisma } from '@prisma/client';

import type { TenantClient } from './client.js';

export type OrchestratorRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export type OrchestratorStepRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'SKIPPED';

export class OrchestratorPersistenceError extends Error {
  public override readonly name = 'OrchestratorPersistenceError';
  constructor(message: string) {
    super(message);
  }
}

export interface OrchestratorRunRow {
  readonly id: string;
  readonly tenantId: string;
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly status: OrchestratorRunStatus;
  readonly traceId: string;
  readonly input: unknown;
  readonly currentStepId: string | null;
  readonly succeededStepIds: readonly string[];
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export interface OrchestratorStepRunRow {
  readonly id: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly status: OrchestratorStepRunStatus;
  readonly attempt: number;
  readonly input: unknown;
  readonly output: unknown;
  readonly error: string | null;
  readonly startedAt: Date | null;
  readonly nextAttemptAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new OrchestratorPersistenceError(
      'No tenant context on this transaction. Use withTenant.',
    );
  }
  return tenantId;
}

function toRunRow(row: {
  id: string;
  tenantId: string;
  pipelineId: string;
  pipelineVersion: string;
  status: string;
  traceId: string;
  input: unknown;
  currentStepId: string | null;
  succeededStepIds: unknown;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}): OrchestratorRunRow {
  return {
    ...row,
    status: row.status as OrchestratorRunStatus,
    succeededStepIds: row.succeededStepIds as readonly string[],
  };
}

function toStepRunRow(row: {
  id: string;
  tenantId: string;
  runId: string;
  stepId: string;
  status: string;
  attempt: number;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: Date | null;
  nextAttemptAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OrchestratorStepRunRow {
  return { ...row, status: row.status as OrchestratorStepRunStatus };
}

export interface OpenRunInput {
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly traceId: string;
  readonly input: unknown;
  readonly createdBy?: string | null;
}

/** Opens a new run at `PENDING`, with no step runs yet. The only way a run enters the
 * system. */
export async function openRun(
  tx: TenantClient,
  input: OpenRunInput,
): Promise<OrchestratorRunRow> {
  const tenantId = await currentTenantId(tx);
  const created = await tx.orchestratorRun.create({
    data: {
      tenantId,
      pipelineId: input.pipelineId,
      pipelineVersion: input.pipelineVersion,
      traceId: input.traceId,
      input: input.input as Prisma.InputJsonValue,
      createdBy: input.createdBy ?? null,
    },
  });
  return toRunRow(created);
}

export async function getRun(
  tx: TenantClient,
  runId: string,
): Promise<OrchestratorRunRow | null> {
  const found = await tx.orchestratorRun.findFirst({ where: { id: runId } });
  return found === null ? null : toRunRow(found);
}

/** Every step attempt for a run, oldest first — a resuming caller's full history of what
 * has already happened, including every retried attempt. */
export async function listStepRuns(
  tx: TenantClient,
  runId: string,
): Promise<readonly OrchestratorStepRunRow[]> {
  const rows = await tx.orchestratorStepRun.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toStepRunRow);
}

/**
 * Starts a new step attempt: creates its `RUNNING` row, and marks the run itself
 * `RUNNING` with `currentStepId` set to this step — a run's very first step is what
 * moves it off `PENDING`. `attempt` is the caller's own count (0 for a step's first try);
 * `(runId, stepId, attempt)` is unique, so retrying the same attempt twice is a database
 * error, not a silent duplicate.
 */
export async function startStepRun(
  tx: TenantClient,
  runId: string,
  stepId: string,
  attempt: number,
  input: unknown,
  now: Date,
): Promise<OrchestratorStepRunRow> {
  const tenantId = await currentTenantId(tx);
  const run = await tx.orchestratorRun.findFirst({ where: { id: runId } });
  if (run === null) {
    throw new OrchestratorPersistenceError(`No run ${runId} in this tenant.`);
  }

  const created = await tx.orchestratorStepRun.create({
    data: {
      tenantId,
      runId,
      stepId,
      attempt,
      status: 'RUNNING',
      input: input as Prisma.InputJsonValue,
      startedAt: now,
    },
  });
  await tx.orchestratorRun.update({
    where: { id: runId },
    data: {
      status: run.status === 'PENDING' ? 'RUNNING' : run.status,
      currentStepId: stepId,
      updatedAt: now,
    },
  });
  return toStepRunRow(created);
}

export type StepRunOutcome =
  | { readonly status: 'SUCCEEDED'; readonly output: unknown }
  | { readonly status: 'FAILED'; readonly error: string }
  /** This specific attempt failed but will be retried — `error` records what happened on
   * this attempt; the row's own status is `RETRY_SCHEDULED` rather than `FAILED` because
   * `FAILED` is reserved for the attempt that finally exhausts `maxRetries`. */
  | {
      readonly status: 'RETRY_SCHEDULED';
      readonly nextAttemptAt: Date;
      readonly error: string;
    }
  | { readonly status: 'TIMED_OUT' }
  | { readonly status: 'CANCELLED' };

/** Persists the outcome of one step attempt. Never touches the run's own status —
 * `updateRunStatus` is the separate, explicit call for that, so a caller cannot
 * accidentally advance the run past a step outcome it hasn't actually decided what to do
 * with yet (retry? compensate? move on?). */
export async function finishStepRun(
  tx: TenantClient,
  stepRunId: string,
  outcome: StepRunOutcome,
  now: Date,
): Promise<OrchestratorStepRunRow> {
  const data: Prisma.OrchestratorStepRunUpdateInput = { updatedAt: now };
  switch (outcome.status) {
    case 'SUCCEEDED':
      data.status = 'SUCCEEDED';
      data.output = outcome.output as Prisma.InputJsonValue;
      data.completedAt = now;
      break;
    case 'FAILED':
      data.status = 'FAILED';
      data.error = outcome.error;
      data.completedAt = now;
      break;
    case 'RETRY_SCHEDULED':
      data.status = 'RETRY_SCHEDULED';
      data.nextAttemptAt = outcome.nextAttemptAt;
      data.error = outcome.error;
      break;
    case 'TIMED_OUT':
      data.status = 'TIMED_OUT';
      data.completedAt = now;
      break;
    case 'CANCELLED':
      data.status = 'CANCELLED';
      data.completedAt = now;
      break;
  }
  const updated = await tx.orchestratorStepRun.update({
    where: { id: stepRunId },
    data,
  });
  return toStepRunRow(updated);
}

export type RunStatusUpdate =
  | { readonly status: 'RUNNING'; readonly currentStepId: string }
  | { readonly status: 'WAITING_FOR_APPROVAL'; readonly currentStepId: string }
  | { readonly status: 'SUCCEEDED' }
  | { readonly status: 'FAILED' }
  | { readonly status: 'COMPENSATING'; readonly currentStepId: string }
  | { readonly status: 'COMPENSATED' };

/**
 * Advances the run itself to a new status — the counterpart to `finishStepRun`, called
 * once a caller has decided what a step's outcome means for the run as a whole (proceed
 * to the next step, stop for a human, fail, or start compensating). `appendSucceededStepId`
 * records a step id onto the run's own ordered success list, the same call that moves the
 * run to `RUNNING` for its next step — a step only counts as succeeded once the run
 * itself has moved past it.
 */
export async function updateRunStatus(
  tx: TenantClient,
  runId: string,
  update: RunStatusUpdate,
  now: Date,
  appendSucceededStepId?: string,
): Promise<OrchestratorRunRow> {
  const run = await tx.orchestratorRun.findFirst({ where: { id: runId } });
  if (run === null) {
    throw new OrchestratorPersistenceError(`No run ${runId} in this tenant.`);
  }
  const succeededStepIds = run.succeededStepIds as readonly string[];
  const data: Prisma.OrchestratorRunUpdateInput = {
    status: update.status,
    updatedAt: now,
  };
  if ('currentStepId' in update) {
    data.currentStepId = update.currentStepId;
  }
  if (appendSucceededStepId !== undefined) {
    data.succeededStepIds = [
      ...succeededStepIds,
      appendSucceededStepId,
    ] as Prisma.InputJsonValue;
  }
  const updated = await tx.orchestratorRun.update({ where: { id: runId }, data });
  return toRunRow(updated);
}

/** Cancels a run directly — a distinct operation from the normal status progression, the
 * same "its own mechanism, not a detour through the state machine" shape
 * `tombstoneBrainFact` already has against the Brain write path. Marks the run
 * `CANCELLED` and records when; a step still `RUNNING` is left for the runner's own
 * cancellation check to catch and finish as `CANCELLED` in its own row. */
export async function cancelRun(
  tx: TenantClient,
  runId: string,
  now: Date,
): Promise<OrchestratorRunRow> {
  const run = await tx.orchestratorRun.findFirst({ where: { id: runId } });
  if (run === null) {
    throw new OrchestratorPersistenceError(`No run ${runId} in this tenant.`);
  }
  const updated = await tx.orchestratorRun.update({
    where: { id: runId },
    data: { status: 'CANCELLED', cancelledAt: now, updatedAt: now },
  });
  return toRunRow(updated);
}
