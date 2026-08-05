// The DAG runner — Stage 06 step 4.
//
// "The runner must provide durability (state persisted per step), resumability,
// idempotency, retries with jitter, per-step timeouts, cancellation, and compensation on
// failure. A run has one trace ID from start to finish." This is the imperative shell:
// `dag.ts` declares what a pipeline is, `run-state-machine.ts` decides what a step outcome
// means, and `@infinite-ai/db`'s `orchestrator.ts` persists exactly what this module tells
// it to. Nothing here decides retry timing or the next step itself — those come from the
// pure functions this module calls.
//
// Scope, stated plainly: `agent_call`, `tool_call`, `human_gate` and `compensation` are
// fully executed here — the four kinds the manual's own reference pipeline exit gate names
// ("three agents, one human gate, one compensation path"). `branch` and `map` are declared
// and DAG-validated (`dag.ts`) and their pure next-step decisions already exist
// (`nextStepAfterSuccess`), but the runner does not yet evaluate a branch condition or fan
// a map out into per-item runs — a stated follow-up, not silently dropped (see
// `docs/STAGE_LOG.md`).
//
// `human_gate` resumption (Stage 06 step 5) follows the same resumability rule as
// everything else here: `decideHumanGate` only ever records a decision — it never advances
// the run itself, the same "never touches the run's own status" boundary
// `@infinite-ai/db`'s `finishStepRun` already draws. The run only moves once the *next*
// `advanceRun`/`runToCompletion` call re-reads the decision back from Postgres, exactly as
// a resumed-after-a-crash caller would.
//
// Resumability in practice: `advanceRun` does one unit of work and returns — it never
// loops waiting for a timer. A crashed or restarted caller resumes a run by calling
// `runToCompletion` (or `advanceRun` directly) again with the same `runId`; every decision
// it needs is read back from `@infinite-ai/db`, never held in memory across calls. That
// includes a retry: `advanceRun` only starts a scheduled retry once its own
// `nextAttemptAt` has passed, so the delay is real wall-clock time a caller polls back
// into, not a `setTimeout` this process would lose on restart.

import {
  appendAuditEvent,
  cancelRun as dbCancelRun,
  decideApprovalTask,
  finishStepRun,
  getApprovalTaskForStep,
  getRun,
  hasActiveRoleAssignment,
  listStepRuns,
  openApprovalTask,
  openRun,
  startStepRun,
  updateRunStatus,
  type ApprovalTaskRow,
  type OrchestratorRunRow,
  type OrchestratorStepRunRow,
  type TenantClient,
} from '@infinite-ai/db';
import { NOOP_TRACER, type Tracer } from '@infinite-ai/telemetry';
import { z } from 'zod';

import {
  validatePipelineDag,
  type PipelineDefinition,
  type PipelineStep,
} from './dag.js';
import {
  compensationChain,
  computeRetryDelayMs,
  hasTimedOut,
  nextStepAfterSuccess,
  shouldRetry,
} from './run-state-machine.js';

export class OrchestratorRunnerError extends Error {
  public override readonly name = 'OrchestratorRunnerError';
  constructor(message: string) {
    super(message);
  }
}

export interface StepExecutionContext {
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly input: unknown;
}

/** Runs one `agent_call`/`tool_call`/compensation step's actual work and returns its
 * output. Throwing means the step failed — the runner decides retry vs. exhaustion from
 * there, never from this function's own return value. */
export type StepExecutor = (context: StepExecutionContext) => Promise<unknown>;

export type ConditionEvaluator = (condition: string, input: unknown) => boolean;

export interface HumanGateContext {
  readonly runId: string;
  readonly stepId: string;
  readonly requiredRole: string;
  readonly input: unknown;
}

/** What a `human_gate` step's approval task is opened with — "the artefact, a diff
 * against the previous version, the evidence used" (the manual's own step 5 text).
 * `diffAgainstPrevious` is omitted (not merely `null`) when there is no previous version
 * to diff against. */
export interface ApprovalMaterial {
  readonly artefact: unknown;
  readonly evidence: unknown;
  readonly diffAgainstPrevious?: unknown;
}

/** Supplies the approval task's own content the moment a run first reaches a `human_gate`
 * step. Required whenever a pipeline declares one — see the `human_gate` branch of
 * `advanceRun` for why faking this rather than asking for it would misrepresent what was
 * actually reviewed. */
export type ApprovalMaterialProvider = (
  context: HumanGateContext,
) => Promise<ApprovalMaterial> | ApprovalMaterial;

export interface RunnerOptions {
  readonly executeStep: StepExecutor;
  readonly evaluateCondition?: ConditionEvaluator;
  readonly prepareApproval?: ApprovalMaterialProvider;
  readonly retryBaseMs?: number;
  readonly retryMaxMs?: number;
  readonly random?: () => number;
  readonly tracer?: Tracer;
}

const TERMINAL_OR_PAUSED: readonly OrchestratorRunRow['status'][] = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'COMPENSATED',
];

/** Opens a new run for `pipeline` — fails fast on a malformed pipeline rather than
 * persisting a run that could never actually advance. */
export async function startRun(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  input: unknown,
  traceId: string,
  createdBy: string | null = null,
): Promise<OrchestratorRunRow> {
  validatePipelineDag(pipeline);
  return openRun(tx, {
    pipelineId: pipeline.id,
    pipelineVersion: pipeline.version,
    traceId,
    input,
    createdBy,
  });
}

/** Cancels a run directly. A step already `RUNNING` is left for `advanceRun`'s own
 * cancellation check to notice and close out. */
export async function cancelRun(
  tx: TenantClient,
  runId: string,
  now: Date = new Date(),
): Promise<OrchestratorRunRow> {
  return dbCancelRun(tx, runId, now);
}

const HumanGateDecisionInputSchema = z.object({
  outcome: z.enum(['APPROVED', 'REJECTED', 'EDITED']),
  decidedBy: z.string().uuid(),
  /** Required for every outcome, not only a rejection — "the decision, the actor, the
   * reason... are recorded" (the manual's own step 5 text) reads as unconditional. */
  reason: z.string().min(1),
  /** Present only for `outcome: 'EDITED'`; ignored otherwise. */
  editDiff: z.unknown().optional(),
});

export type HumanGateDecisionInput = z.infer<typeof HumanGateDecisionInputSchema>;

/**
 * Records a decision on the approval task open for `runId`'s current `human_gate` step —
 * "on approve, reject or edit, the decision, the actor, the reason and any edit diff are
 * recorded." This function only ever records; it never advances the run itself (see this
 * file's own header) — the next `advanceRun`/`runToCompletion` call is what notices the
 * decision and proceeds.
 *
 * Every bypass vector this stage can name is refused here, not merely discouraged: a
 * malformed decision (no actor, empty reason, an unrecognised outcome) fails Zod
 * validation before anything is read; a run not currently `WAITING_FOR_APPROVAL`, or with
 * no open approval task, has nothing to decide; an actor who does not hold the gate's own
 * `requiredRole` is refused regardless of what they claim to decide; and a task already
 * carrying a decision refuses a second one (`decideApprovalTask`'s own guard) — a decision
 * is recorded once, never overwritten by a later call.
 */
export async function decideHumanGate(
  tx: TenantClient,
  runId: string,
  input: HumanGateDecisionInput,
  now: Date = new Date(),
): Promise<ApprovalTaskRow> {
  const parsed = HumanGateDecisionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new OrchestratorRunnerError(
      `Invalid human gate decision: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }
  const decision = parsed.data;

  const run = await getRun(tx, runId);
  if (run === null) {
    throw new OrchestratorRunnerError(`No run ${runId} in this tenant.`);
  }
  if (run.status !== 'WAITING_FOR_APPROVAL' || run.currentStepId === null) {
    throw new OrchestratorRunnerError(`Run ${runId} is not waiting for approval.`);
  }

  const task = await getApprovalTaskForStep(tx, runId, run.currentStepId);
  if (task === null) {
    throw new OrchestratorRunnerError(
      `Run ${runId}: no approval task open for step "${run.currentStepId}".`,
    );
  }
  if (task.decision !== null) {
    throw new OrchestratorRunnerError(
      `Run ${runId}: the approval task for step "${run.currentStepId}" was already decided.`,
    );
  }

  const authorized = await hasActiveRoleAssignment(
    tx,
    decision.decidedBy,
    task.requiredRole,
    now,
  );
  if (!authorized) {
    throw new OrchestratorRunnerError(
      `Actor ${decision.decidedBy} does not hold the required role "${task.requiredRole}" ` +
        'for this gate.',
    );
  }

  const decided = await decideApprovalTask(
    tx,
    task.id,
    {
      outcome: decision.outcome,
      decidedBy: decision.decidedBy,
      reason: decision.reason,
      editDiff: decision.editDiff,
    },
    now,
  );

  // Metadata only — who decided what, and why — never the artefact's own content. The
  // same boundary `brain/write-path.ts`'s own `ratify` already holds its audit event to.
  await appendAuditEvent(tx, {
    actorId: decision.decidedBy,
    action: 'human_gate_decided',
    resourceType: 'orchestrator_run',
    resourceId: runId,
    purpose: null,
    traceId: run.traceId,
    diff: { stepId: task.stepId, decision: decision.outcome, reason: decision.reason },
    at: now,
    createdBy: decision.decidedBy,
  });

  return decided;
}

function stepFor(pipeline: PipelineDefinition, stepId: string): PipelineStep {
  const step = pipeline.steps[stepId];
  if (step === undefined) {
    throw new OrchestratorRunnerError(
      `Pipeline "${pipeline.id}": no such step "${stepId}".`,
    );
  }
  return step;
}

function latestAttempt(
  stepRuns: readonly OrchestratorStepRunRow[],
  stepId: string,
): OrchestratorStepRunRow | undefined {
  const attempts = stepRuns.filter((s) => s.stepId === stepId);
  return attempts[attempts.length - 1];
}

/**
 * Does exactly one unit of work for `runId` and returns the run's state afterwards — a
 * single step's execution, a single retry-readiness check, or nothing (no progress
 * currently possible, e.g. a step still within its timeout or a retry not yet due).
 * Never loops; `runToCompletion` is what calls this repeatedly.
 */
export async function advanceRun(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  runId: string,
  options: RunnerOptions,
  now: Date = new Date(),
): Promise<OrchestratorRunRow> {
  const run = await getRun(tx, runId);
  if (run === null) {
    throw new OrchestratorRunnerError(`No run ${runId} in this tenant.`);
  }
  if (TERMINAL_OR_PAUSED.includes(run.status)) return run;

  if (run.status === 'WAITING_FOR_APPROVAL') {
    return resumeFromHumanGate(tx, pipeline, run, options, now);
  }

  const currentStepId = run.currentStepId ?? pipeline.entryStepId;
  const step = stepFor(pipeline, currentStepId);
  const stepRuns = await listStepRuns(tx, runId);
  const latest = latestAttempt(stepRuns, currentStepId);

  if (latest?.status === 'RUNNING') {
    if (!hasTimedOut(latest.startedAt ?? latest.createdAt, step.timeoutMs, now)) {
      return run; // still within its timeout — nothing more to do yet
    }
    await finishStepRun(tx, latest.id, { status: 'TIMED_OUT' }, now);
    return handleFailure(
      tx,
      pipeline,
      run,
      step,
      latest.attempt,
      'Step timed out.',
      options,
      now,
    );
  }

  if (latest?.status === 'RETRY_SCHEDULED') {
    if (latest.nextAttemptAt !== null && latest.nextAttemptAt.getTime() > now.getTime()) {
      return run; // scheduled, but not due yet
    }
    return executeForwardStep(tx, pipeline, run, step, latest.attempt + 1, options, now);
  }

  if (step.kind === 'human_gate') {
    if (options.prepareApproval === undefined) {
      throw new OrchestratorRunnerError(
        `Run ${runId}: human_gate step "${step.id}" needs a prepareApproval function.`,
      );
    }
    const material = await options.prepareApproval({
      runId,
      stepId: step.id,
      requiredRole: step.requiredRole,
      input: run.input,
    });
    await openApprovalTask(tx, {
      runId,
      stepId: step.id,
      requiredRole: step.requiredRole,
      traceId: run.traceId,
      artefact: material.artefact,
      evidence: material.evidence,
      diffAgainstPrevious: material.diffAgainstPrevious,
    });
    return updateRunStatus(
      tx,
      runId,
      { status: 'WAITING_FOR_APPROVAL', currentStepId: step.id },
      now,
    );
  }

  if (step.kind === 'compensation') {
    throw new OrchestratorRunnerError(
      `Run ${runId}: compensation step "${step.id}" is only ever invoked directly on ` +
        'failure, never reached by forward advancement.',
    );
  }

  if (step.kind === 'branch') {
    if (options.evaluateCondition === undefined) {
      throw new OrchestratorRunnerError(
        `Run ${runId}: branch step "${step.id}" needs an evaluateCondition function.`,
      );
    }
    const result = options.evaluateCondition(step.condition, run.input);
    const nextId = nextStepAfterSuccess(step, result);
    return advanceToNextStep(tx, runId, step.id, nextId, now);
  }

  if (step.kind === 'map') {
    // Declared and DAG-validated (dag.ts); fanning out per-item runs is a stated
    // follow-up (see this file's own header), not silently dropped.
    throw new OrchestratorRunnerError(
      `Run ${runId}: map step "${step.id}" execution is not yet built.`,
    );
  }

  return executeForwardStep(
    tx,
    pipeline,
    run,
    step,
    latest === undefined ? 0 : latest.attempt + 1,
    options,
    now,
  );
}

/** Calls `advanceRun` until the run reaches a terminal or paused status, or a call makes
 * no further progress (a step within its timeout, or a retry not yet due). */
export async function runToCompletion(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  runId: string,
  options: RunnerOptions,
  now: Date = new Date(),
): Promise<OrchestratorRunRow> {
  for (;;) {
    const before = await getRun(tx, runId);
    if (before === null) {
      throw new OrchestratorRunnerError(`No run ${runId} in this tenant.`);
    }
    if (TERMINAL_OR_PAUSED.includes(before.status)) return before;

    const after = await advanceRun(tx, pipeline, runId, options, now);
    if (after.status === before.status && after.currentStepId === before.currentStepId) {
      return after; // no progress was possible this call
    }
  }
}

async function executeForwardStep(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  step: PipelineStep,
  attempt: number,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  const tracer = options.tracer ?? NOOP_TRACER;
  const stepRun = await startStepRun(tx, run.id, step.id, attempt, run.input, now);
  const span = tracer.startSpan(`orchestrator.step.${step.kind}`, {
    trace_id: run.traceId,
    run_id: run.id,
    step_id: step.id,
    attempt,
  });
  try {
    const output = await options.executeStep({
      runId: run.id,
      stepId: step.id,
      attempt,
      input: run.input,
    });
    await finishStepRun(tx, stepRun.id, { status: 'SUCCEEDED', output }, now);
    const nextId = nextStepAfterSuccess(step);
    return await advanceToNextStep(tx, run.id, step.id, nextId, now);
  } catch (error) {
    span.recordException(error);
    const message = error instanceof Error ? error.message : String(error);
    return await handleFailure(tx, pipeline, run, step, attempt, message, options, now);
  } finally {
    span.end();
  }
}

async function advanceToNextStep(
  tx: TenantClient,
  runId: string,
  succeededStepId: string,
  nextStepId: string | null,
  now: Date,
): Promise<OrchestratorRunRow> {
  if (nextStepId === null) {
    return updateRunStatus(tx, runId, { status: 'SUCCEEDED' }, now, succeededStepId);
  }
  return updateRunStatus(
    tx,
    runId,
    { status: 'RUNNING', currentStepId: nextStepId },
    now,
    succeededStepId,
  );
}

/**
 * Re-derives what a paused `human_gate` step means for the run, entirely from persisted
 * state — no different, in kind, from resuming after a crash. A pending or not-yet-opened
 * decision makes no progress (the run stays `WAITING_FOR_APPROVAL`, which is how
 * `runToCompletion`'s own "no progress" check knows to stop); a rejection is treated as the
 * step's own failure, running compensation exactly as an exhausted retry would; an approval
 * or an edit proceeds to the gate's own `next`, appending it to `succeededStepIds` like any
 * other completed step (so a later compensation-worthy failure could, in principle, undo a
 * gate that declared its own `compensatesWith`).
 */
async function resumeFromHumanGate(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  const stepId = run.currentStepId;
  if (stepId === null) {
    throw new OrchestratorRunnerError(
      `Run ${run.id}: waiting for approval with no current step recorded.`,
    );
  }
  const task = await getApprovalTaskForStep(tx, run.id, stepId);
  if (task === null || task.decision === null) {
    return run; // still pending — nothing more to do until a decision is recorded
  }
  if (task.decision === 'REJECTED') {
    return runCompensation(tx, pipeline, run, options, now);
  }
  const step = stepFor(pipeline, stepId);
  const nextId = nextStepAfterSuccess(step);
  return advanceToNextStep(tx, run.id, stepId, nextId, now);
}

async function handleFailure(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  step: PipelineStep,
  attempt: number,
  errorMessage: string,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  if (shouldRetry(attempt, step.maxRetries)) {
    const delayMs = computeRetryDelayMs(
      attempt,
      options.retryBaseMs ?? 1_000,
      options.retryMaxMs ?? 30_000,
      options.random,
    );
    const stepRuns = await listStepRuns(tx, run.id);
    const current = latestAttempt(stepRuns, step.id);
    if (current !== undefined) {
      await finishStepRun(
        tx,
        current.id,
        {
          status: 'RETRY_SCHEDULED',
          nextAttemptAt: new Date(now.getTime() + delayMs),
          error: errorMessage,
        },
        now,
      );
    }
    const refreshed = await getRun(tx, run.id);
    return refreshed ?? run;
  }

  return runCompensation(tx, pipeline, run, options, now);
}

async function runCompensation(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  const chain = compensationChain(pipeline, run.succeededStepIds);
  if (chain.length === 0) {
    return updateRunStatus(tx, run.id, { status: 'FAILED' }, now);
  }

  await updateRunStatus(
    tx,
    run.id,
    { status: 'COMPENSATING', currentStepId: chain[0]! },
    now,
  );
  const tracer = options.tracer ?? NOOP_TRACER;

  for (const compensationStepId of chain) {
    stepFor(pipeline, compensationStepId); // throws if the pipeline doesn't declare it
    const stepRun = await startStepRun(tx, run.id, compensationStepId, 0, run.input, now);
    const span = tracer.startSpan('orchestrator.step.compensation', {
      trace_id: run.traceId,
      run_id: run.id,
      step_id: compensationStepId,
    });
    try {
      const output = await options.executeStep({
        runId: run.id,
        stepId: compensationStepId,
        attempt: 0,
        input: run.input,
      });
      await finishStepRun(tx, stepRun.id, { status: 'SUCCEEDED', output }, now);
    } catch (error) {
      span.recordException(error);
      const message = error instanceof Error ? error.message : String(error);
      await finishStepRun(tx, stepRun.id, { status: 'FAILED', error: message }, now);
      // A compensation that itself fails stops the whole rollback rather than pressing on
      // and compounding an inconsistent state further — a human must intervene.
      return updateRunStatus(tx, run.id, { status: 'FAILED' }, now);
    } finally {
      span.end();
    }
  }

  return updateRunStatus(tx, run.id, { status: 'COMPENSATED' }, now);
}
