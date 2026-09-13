// LE signal trigger — Stage 54.
//
// `buildLeSignalInput` maps a decided ApprovalTaskRow to a LE01Input for the LE signal
// pipeline. Returns null for any gate whose artefact field does not carry the four LE
// context fields — e.g. an LE evolution or exemplar promotion gate, or a MOD-02 SBST gate.
// That check is intentional: LE-01 only makes sense when a human just reviewed an
// agent-generated artefact that the Learning Engine should learn from.
//
// `startLeSignalRun` wraps the DB call to open a new LE_SIGNAL_PIPELINE run inside the
// caller's existing withTenant transaction, returning the new run ID so the caller can
// enqueue the BullMQ job *after* the transaction commits — avoiding a phantom job in Redis
// if the DB transaction later rolls back.

import { randomUUID } from 'node:crypto';

import type { ApprovalTaskRow, TenantClient } from '@infinite-ai/db';
import { LE01Input, type HITLEventType } from '@infinite-ai/contracts';
import { LE_SIGNAL_PIPELINE, startRun } from '@infinite-ai/orchestrator';
import { z } from 'zod';

// Safe extraction of LE context from the `artefact` field prepareApproval stores.
// Any approval task whose run input does NOT carry all four fields (e.g. an LE promotion
// gate, a MOD-02 support gate) produces a failed parse → null return from buildLeSignalInput.
const LeSignalContextSchema = z
  .object({
    artefactId: z.string().uuid(),
    artefactType: z.string().min(1),
    capsTopicId: z.string().min(1),
    agentId: z.string().min(1),
  })
  .passthrough();

type ApprovalOutcome = 'APPROVED' | 'EDITED' | 'REJECTED';

function outcomeToHITLEventType(outcome: ApprovalOutcome): HITLEventType {
  if (outcome === 'APPROVED') return 'approved';
  if (outcome === 'EDITED') return 'edited';
  return 'rejected';
}

/**
 * Builds a LE01Input from a decided ApprovalTaskRow.
 *
 * Returns null when:
 * - the task has no decision yet (decision === null)
 * - the task's artefact field lacks LE context (non-TB gate)
 *
 * `actorRef` must be a de-identified reference (e.g. role string or pseudonymous ID) —
 * never a natural-person identifier. LE-01's own schema comment says "role + school
 * context, no natural key"; passing the actor's UUID (a pseudonym, not a name) satisfies
 * this because no name or email is ever present.
 */
export function buildLeSignalInput(
  task: ApprovalTaskRow,
  actorRef: string,
): LE01Input | null {
  if (task.decision === null || task.decidedAt === null) return null;

  const ctxResult = LeSignalContextSchema.safeParse(task.artefact);
  if (!ctxResult.success) return null;

  const ctx = ctxResult.data;
  const eventType = outcomeToHITLEventType(task.decision as ApprovalOutcome);

  const input: LE01Input = {
    tenantId: task.tenantId,
    gateEventId: task.id,
    agentId: ctx.agentId,
    artefactId: ctx.artefactId,
    artefactType: ctx.artefactType,
    capsTopicId: ctx.capsTopicId,
    eventType,
    actorRef,
    decidedAt: task.decidedAt.toISOString(),
    ...(task.reason !== null ? { reasonCode: task.reason } : {}),
  };

  return LE01Input.parse(input);
}

/**
 * Opens a new LE_SIGNAL_PIPELINE run inside `tx` and returns its run ID for the caller
 * to enqueue as a BullMQ job after the transaction commits.
 * Returns null when the task has no LE signal context (non-TB gate).
 */
export async function startLeSignalRun(
  tx: TenantClient,
  task: ApprovalTaskRow,
  actorRef: string,
): Promise<string | null> {
  const input = buildLeSignalInput(task, actorRef);
  if (input === null) return null;

  const run = await startRun(
    tx,
    LE_SIGNAL_PIPELINE,
    input,
    // Re-use the original run's trace ID so the LE signal run is traceable back to the
    // human gate event that triggered it.
    task.traceId,
    task.decidedBy ?? null,
  );
  return run.id;
}

/** The run ID returned by startLeSignalRun, paired with the job data the BullMQ worker
 * needs to pick it up. The caller enqueues this after withTenant commits. */
export interface PendingLeSignalJob {
  readonly runId: string;
  readonly tenantId: string;
  /** The actor ID for withTenant — the person who made the gate decision. */
  readonly actorId: string;
}

/** Builds the PendingLeSignalJob from the decided task. Returns null on no LE context. */
export async function buildPendingLeSignalJob(
  tx: TenantClient,
  task: ApprovalTaskRow,
  actorRef: string,
): Promise<PendingLeSignalJob | null> {
  const runId = await startLeSignalRun(tx, task, actorRef);
  if (runId === null) return null;

  // Use the same actorId (task.decidedBy) for the BullMQ job so the withTenant context
  // in the worker correctly attributes the LE pipeline run to the same actor.
  return {
    runId,
    tenantId: task.tenantId,
    actorId: task.decidedBy ?? randomUUID(),
  };
}
