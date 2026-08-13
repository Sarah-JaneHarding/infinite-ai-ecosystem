// Workflow execution monitoring — Stage 19 (Visual Agent Builder).
//
// Tracks the runtime state of a workflow execution at the node level.
// This is the design-time package's view of execution — it holds the state
// model and status aggregation only. The orchestrator package drives the
// actual execution; it calls the update functions here and the UI reads them.

import { z } from 'zod';

// ─── Node execution status ────────────────────────────────────────────────────

export const NodeExecutionStatus = z.enum([
  'pending', // not yet started
  'running', // currently executing
  'waiting', // blocked on a human gate or upstream node
  'succeeded', // completed successfully
  'failed', // completed with an error
  'skipped', // bypassed by a branch condition
]);
export type NodeExecutionStatus = z.infer<typeof NodeExecutionStatus>;

export const NodeExecutionState = z.object({
  nodeId: z.string().min(1),
  status: NodeExecutionStatus,
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  /** Human-readable message; set on failure or when waiting for a gate. */
  message: z.string().optional(),
  /** Number of retry attempts made (0 = first attempt). */
  attempt: z.number().int().min(0).default(0),
});
export type NodeExecutionState = z.infer<typeof NodeExecutionState>;

// ─── Workflow execution record ────────────────────────────────────────────────

export const WorkflowExecutionStatus = z.enum([
  'pending',
  'running',
  'waiting', // at least one gate is open
  'succeeded',
  'failed',
  'cancelled',
]);
export type WorkflowExecutionStatus = z.infer<typeof WorkflowExecutionStatus>;

export const WorkflowExecutionRecord = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowName: z.string().min(1),
  status: WorkflowExecutionStatus,
  nodeStates: z.array(NodeExecutionState),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  triggeredBy: z.string().min(1), // actorId that triggered the run
});
export type WorkflowExecutionRecord = z.infer<typeof WorkflowExecutionRecord>;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a fresh execution record for a workflow. All nodes begin as pending.
 */
export function createExecutionRecord(opts: {
  executionId: string;
  workflowId: string;
  workflowName: string;
  nodeIds: string[];
  triggeredBy: string;
}): WorkflowExecutionRecord {
  return {
    executionId: opts.executionId,
    workflowId: opts.workflowId,
    workflowName: opts.workflowName,
    status: 'pending',
    nodeStates: opts.nodeIds.map((id) => ({
      nodeId: id,
      status: 'pending',
      attempt: 0,
    })),
    startedAt: new Date().toISOString(),
    triggeredBy: opts.triggeredBy,
  };
}

// ─── State mutations (return new records; execution records are immutable) ────

/**
 * Returns a new record with the given node's state updated.
 * Throws if the nodeId is not found in the record.
 */
export function updateNodeState(
  record: WorkflowExecutionRecord,
  nodeId: string,
  patch: Partial<Omit<NodeExecutionState, 'nodeId'>>,
): WorkflowExecutionRecord {
  const idx = record.nodeStates.findIndex((s) => s.nodeId === nodeId);
  if (idx === -1) {
    throw new Error(
      `Node "${nodeId}" is not tracked in execution "${record.executionId}".`,
    );
  }
  const updated = record.nodeStates.map((s, i) => (i === idx ? { ...s, ...patch } : s));
  return {
    ...record,
    nodeStates: updated,
    status: deriveWorkflowStatus(updated, record.status),
  };
}

/**
 * Marks the overall execution as cancelled. Pending/running nodes become skipped.
 */
export function cancelExecution(
  record: WorkflowExecutionRecord,
): WorkflowExecutionRecord {
  const cancelledNodes = record.nodeStates.map((s) =>
    s.status === 'pending' || s.status === 'running'
      ? { ...s, status: 'skipped' as NodeExecutionStatus }
      : s,
  );
  return {
    ...record,
    status: 'cancelled',
    nodeStates: cancelledNodes,
    finishedAt: new Date().toISOString(),
  };
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

/**
 * Derives the overall workflow status from the current node states.
 * Does not regress a terminal status (succeeded/failed/cancelled).
 */
function deriveWorkflowStatus(
  states: NodeExecutionState[],
  current: WorkflowExecutionStatus,
): WorkflowExecutionStatus {
  if (current === 'cancelled') return 'cancelled';

  const statuses = states.map((s) => s.status);

  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.every((s) => s === 'succeeded' || s === 'skipped')) {
    return 'succeeded';
  }
  if (statuses.some((s) => s === 'waiting')) return 'waiting';
  if (statuses.some((s) => s === 'running')) return 'running';

  return 'pending';
}

/** Returns summary counts by status for dashboard display. */
export function summariseExecution(record: WorkflowExecutionRecord): {
  total: number;
  pending: number;
  running: number;
  waiting: number;
  succeeded: number;
  failed: number;
  skipped: number;
} {
  const counts = {
    total: record.nodeStates.length,
    pending: 0,
    running: 0,
    waiting: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
  for (const s of record.nodeStates) {
    counts[s.status] += 1;
  }
  return counts;
}

/** Returns the node states that are currently blocking progress. */
export function getBlockingNodes(record: WorkflowExecutionRecord): NodeExecutionState[] {
  return record.nodeStates.filter((s) => s.status === 'waiting' || s.status === 'failed');
}
