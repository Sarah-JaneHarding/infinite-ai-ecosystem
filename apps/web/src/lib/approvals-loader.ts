// The reads behind the approvals screens.
//
// Rule 5: every read goes through `withTenant`, with the tenant and actor taken from the
// caller's verified session — never from the request. RLS is the second line of defence.

import { getApprovalTask, listPendingApprovalTasks, withTenant } from '@infinite-ai/db';

import { queueFor, viewFor, type ApprovalView, type PendingApproval } from './approvals';

export interface ApprovalScope {
  readonly tenantId: string;
  readonly actorId: string;
}

export async function loadApprovalQueue(
  scope: ApprovalScope,
  role: string,
): Promise<PendingApproval[]> {
  const rows = await withTenant(
    { tenantId: scope.tenantId, actorId: scope.actorId },
    (tx) => listPendingApprovalTasks(tx),
  );
  return queueFor(rows, role);
}

export async function loadApproval(
  scope: ApprovalScope,
  role: string,
  taskId: string,
  runId: string,
): Promise<ApprovalView | null> {
  const row = await withTenant(
    { tenantId: scope.tenantId, actorId: scope.actorId },
    (tx) => getApprovalTask(tx, taskId),
  );
  return viewFor(row, role, runId);
}
