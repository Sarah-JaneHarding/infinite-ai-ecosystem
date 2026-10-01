// What the approvals screens show, derived from stored human-gate tasks.
//
// A task is shown to the role it is waiting on, and to nobody else: `requiredRole` is the
// role the orchestrator will check the deciding actor's RoleAssignment against (rule 6), so
// a queue of anything wider would show people artefacts they cannot act on.

import type { ApprovalTaskRow } from '@infinite-ai/db';

export interface PendingApproval {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
  readonly requiredRole: string;
  /** ISO timestamp the gate was opened. */
  readonly openedAt: string;
}

export interface ApprovalView extends PendingApproval {
  readonly artefact: unknown;
  readonly evidence: unknown;
  readonly diffAgainstPrevious: unknown;
}

export function toPending(row: ApprovalTaskRow): PendingApproval {
  return {
    id: row.id,
    runId: row.runId,
    stepId: row.stepId,
    requiredRole: row.requiredRole,
    openedAt: row.createdAt.toISOString(),
  };
}

/** The undecided tasks waiting on `role`, oldest first. */
export function queueFor(
  rows: readonly ApprovalTaskRow[],
  role: string,
): PendingApproval[] {
  return rows
    .filter((r) => r.decision === null && r.requiredRole === role)
    .map(toPending);
}

/** The detail page needs the run id as well as the task id (the decide route takes both). */
export function approvalHref(item: {
  readonly id: string;
  readonly runId: string;
}): string {
  return `/approvals/${encodeURIComponent(item.id)}?runId=${encodeURIComponent(item.runId)}`;
}

/** The task only if it is still undecided, belongs to `role`, and `runId` is its own run.
 * Anything else is `null` — the page treats "not yours" and "not there" identically. */
export function viewFor(
  row: ApprovalTaskRow | null,
  role: string,
  runId: string,
): ApprovalView | null {
  if (row === null) return null;
  if (row.decision !== null || row.requiredRole !== role || row.runId !== runId) {
    return null;
  }
  return {
    ...toPending(row),
    artefact: row.artefact,
    evidence: row.evidence,
    diffAgainstPrevious: row.diffAgainstPrevious,
  };
}

/** Text for an artefact, evidence or diff whose shape the gate does not fix: a string is
 * shown as written, anything else as indented JSON. Never HTML. */
export function describeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2) ?? '';
}
