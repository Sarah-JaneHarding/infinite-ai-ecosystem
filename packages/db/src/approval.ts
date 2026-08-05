// The `human_gate` approval task's persistence — Stage 06 step 5.
//
// "A `human_gate` step creates an approval task with the artefact, a diff against the
// previous version, the evidence used, and the required role... On approve, reject or
// edit, the decision, the actor, the reason and any edit diff are recorded." This module
// is the imperative shell for exactly that record — it does not decide what a decision
// means for the run itself (whether to proceed, or to compensate); that sequencing is
// `packages/orchestrator`'s job, the same division of labour `orchestrator.ts` already
// draws between persisting a step outcome and deciding the run's own next status.
//
// One row per (run, step): a run only ever reaches a given gate once (the forward graph
// has no cycles — `dag.ts`'s own cycle check), so `openApprovalTask` is the only way a row
// for a given gate comes to exist, and `decideApprovalTask` refuses a row that already
// carries a decision — a decision is recorded once, never re-decided.

import type { Prisma } from '@prisma/client';

import type { TenantClient } from './client.js';

export type ApprovalDecisionOutcome = 'APPROVED' | 'REJECTED' | 'EDITED';

export class ApprovalPersistenceError extends Error {
  public override readonly name = 'ApprovalPersistenceError';
  constructor(message: string) {
    super(message);
  }
}

export interface ApprovalTaskRow {
  readonly id: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly requiredRole: string;
  readonly artefact: unknown;
  readonly diffAgainstPrevious: unknown;
  readonly evidence: unknown;
  readonly traceId: string;
  readonly decision: ApprovalDecisionOutcome | null;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
  readonly reason: string | null;
  readonly editDiff: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toRow(row: {
  id: string;
  tenantId: string;
  runId: string;
  stepId: string;
  requiredRole: string;
  artefact: unknown;
  diffAgainstPrevious: unknown;
  evidence: unknown;
  traceId: string;
  decision: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  reason: string | null;
  editDiff: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ApprovalTaskRow {
  return { ...row, decision: row.decision as ApprovalDecisionOutcome | null };
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new ApprovalPersistenceError(
      'No tenant context on this transaction. Use withTenant.',
    );
  }
  return tenantId;
}

export interface OpenApprovalTaskInput {
  readonly runId: string;
  readonly stepId: string;
  readonly requiredRole: string;
  readonly artefact: unknown;
  readonly evidence: unknown;
  readonly diffAgainstPrevious?: unknown;
  readonly traceId: string;
}

/** Opens the one approval task a `human_gate` step will ever have, at the moment a run
 * first reaches it. Throws if the run does not exist in this tenant; the `(runId, stepId)`
 * unique constraint is what turns a caller that reaches the same gate twice into a database
 * error rather than a second, silently-coexisting task. */
export async function openApprovalTask(
  tx: TenantClient,
  input: OpenApprovalTaskInput,
): Promise<ApprovalTaskRow> {
  const tenantId = await currentTenantId(tx);
  const run = await tx.orchestratorRun.findFirst({ where: { id: input.runId } });
  if (run === null) {
    throw new ApprovalPersistenceError(`No run ${input.runId} in this tenant.`);
  }
  const created = await tx.approvalTask.create({
    data: {
      tenantId,
      runId: input.runId,
      stepId: input.stepId,
      requiredRole: input.requiredRole,
      artefact: input.artefact as Prisma.InputJsonValue,
      evidence: input.evidence as Prisma.InputJsonValue,
      diffAgainstPrevious: (input.diffAgainstPrevious ?? null) as Prisma.InputJsonValue,
      traceId: input.traceId,
    },
  });
  return toRow(created);
}

export async function getApprovalTask(
  tx: TenantClient,
  id: string,
): Promise<ApprovalTaskRow | null> {
  const found = await tx.approvalTask.findFirst({ where: { id } });
  return found === null ? null : toRow(found);
}

/** The one approval task for a given run and step, if it has been opened yet. */
export async function getApprovalTaskForStep(
  tx: TenantClient,
  runId: string,
  stepId: string,
): Promise<ApprovalTaskRow | null> {
  const found = await tx.approvalTask.findFirst({ where: { runId, stepId } });
  return found === null ? null : toRow(found);
}

export interface DecideApprovalTaskInput {
  readonly outcome: ApprovalDecisionOutcome;
  readonly decidedBy: string;
  readonly reason: string;
  /** Present only for `outcome: 'EDITED'`. */
  readonly editDiff?: unknown;
}

/** Records a decision onto a still-pending task. Throws if the task does not exist, or if
 * it already carries a decision — the one guard that makes "recorded once" true regardless
 * of how many times a caller (mistakenly, or racing another) tries to decide it. */
export async function decideApprovalTask(
  tx: TenantClient,
  taskId: string,
  decision: DecideApprovalTaskInput,
  now: Date,
): Promise<ApprovalTaskRow> {
  const task = await tx.approvalTask.findFirst({ where: { id: taskId } });
  if (task === null) {
    throw new ApprovalPersistenceError(`No approval task ${taskId} in this tenant.`);
  }
  if (task.decision !== null) {
    throw new ApprovalPersistenceError(
      `Approval task ${taskId} was already decided (${task.decision}).`,
    );
  }
  const updated = await tx.approvalTask.update({
    where: { id: taskId },
    data: {
      decision: decision.outcome,
      decidedBy: decision.decidedBy,
      decidedAt: now,
      reason: decision.reason,
      editDiff: (decision.editDiff ?? null) as Prisma.InputJsonValue,
      updatedAt: now,
    },
  });
  return toRow(updated);
}
