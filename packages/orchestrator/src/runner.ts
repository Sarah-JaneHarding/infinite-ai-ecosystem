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
// Scope, stated plainly: `agent_call`, `tool_call`, `human_gate`, `branch`, `map` and
// `compensation` are all executed here. `branch` evaluates `step.condition` through the
// caller-supplied `evaluateCondition` and routes to `onTrue`/`onFalse`. `map` fans
// `itemStepId` out once per item of the collection at `run.input[step.collectionField]` —
// see `advanceMapStep`'s own header for why that fan-out is one internal loop inside a
// single `advanceRun` call rather than one call per item, and why each item still gets its
// own durable, resumable step-run row.
//
// `concurrencyLimiter` (Stage 06 step 8) is optional too, and checked only for
// `agent_call` steps — see `concurrency.ts`'s own header for why a refusal is "no
// progress" rather than a failure. Queue fairness, step 8's other named requirement, is a
// scheduler concern this runner does not have (nothing here decides which *run* to advance
// next, only what one call does for the run it is given) — `fairness.ts`'s
// `selectNextFairly` is the algorithm a real scheduler will call once one exists.
//
// `startRun`'s own `isIrreversibleTool` (Stage 06 step 7) is optional: supplying it runs
// `validatePipelineGating` (`dag.ts`) before the run is ever opened, so a pipeline that can
// reach an irreversible tool call without a preceding `human_gate` never gets as far as
// `PENDING`. Omitting it does not weaken anything already enforced — it just means nobody
// has wired a tool registry in at this call site yet.
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
  type StepRunOutcome,
  type TenantClient,
} from '@infinite-ai/db';
import { NOOP_TRACER, type Tracer } from '@infinite-ai/telemetry';
import { z } from 'zod';

import type { ConcurrencyLimiter, ConcurrencySlot } from './concurrency.js';
import {
  validatePipelineDag,
  validatePipelineGating,
  type IrreversibleToolCheck,
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
  /** Set only when this attempt is one item of a `map` step — the item's index in the
   * collection. `stepId` is always the declared `itemStepId` (so a `StepExecutor` can
   * resolve the agent/tool the normal way); this field exists so a caller building an
   * idempotency key can still tell two items of the same map apart, since `stepId` and
   * `attempt` alone collide across items (every item's first attempt is `attempt: 0`
   * against the same declared `itemStepId`). */
  readonly mapItemIndex?: number;
}

/** Runs one `agent_call`/`tool_call`/compensation step's actual work and returns its
 * output. Throwing means the step failed — the runner decides retry vs. exhaustion from
 * there, never from this function's own return value. */
export type StepExecutor = (context: StepExecutionContext) => Promise<unknown>;

export type ConditionEvaluator = (condition: string, input: unknown) => boolean;

/** What a successful step reported using, retrieved, and was checked against — the Run
 * Inspector's own required fields (Stage 06 step 9). Called after `executeStep` resolves,
 * never on a failed or retried attempt: nothing today captures usage from an attempt that
 * failed before reporting it, a stated scope boundary (see `docs/STAGE_LOG.md`'s step 9
 * entry). Any field left `undefined` stays `null` on the persisted row. */
export type StepTelemetryCollector = (
  context: StepExecutionContext,
  output: unknown,
) => StepTelemetry | undefined;

export interface StepTelemetry {
  readonly tokensUsed?: number;
  readonly costUsd?: number;
  /** `packages/brain`'s own `AssembledContext` shape, opaque here — this package does not
   * depend on `packages/brain`. */
  readonly retrievedContext?: unknown;
  /** `packages/guardrails`'s own `GuardrailVerdict[]`, opaque here for the same reason. */
  readonly guardrailVerdicts?: unknown;
}

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
  /** Caps concurrent `agent_call`/agent-compensation execution per tenant and per agent
   * (Stage 06 step 8). Omitted means unlimited — every existing call site, unchanged. */
  readonly concurrencyLimiter?: ConcurrencyLimiter;
  /** Stage 06 step 9. Omitted means no telemetry is captured — every existing call site,
   * unchanged. */
  readonly collectStepTelemetry?: StepTelemetryCollector;
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
  isIrreversibleTool?: IrreversibleToolCheck,
): Promise<OrchestratorRunRow> {
  validatePipelineDag(pipeline);
  if (isIrreversibleTool !== undefined) {
    validatePipelineGating(pipeline, isIrreversibleTool);
  }
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

const MAP_ITEM_STEP_ID_PATTERN = /^(.+)\[\d+\]$/;

/**
 * Resolves `run.currentStepId` (or the entry step, if none yet) to the declared step that
 * should actually drive this call's decision. Ordinarily that is a direct lookup — but
 * `@infinite-ai/db`'s `startStepRun` (shared by every step kind, not something this file
 * can opt out of per call) always writes back whatever `stepId` it was given as the run's
 * new `currentStepId`, and a map item's own attempts are persisted under its synthetic
 * `mapItemStepId` (`advanceMapStep`'s own header), never the map step's declared id. So
 * `run.currentStepId` legitimately ends up holding a map item's synthetic id — not only
 * from a crash at an unlucky moment, but as the *ordinary*, expected outcome of starting
 * any map item's attempt at all. When that happens, the *map step* is what is actually
 * driving the run: `advanceMapStep` re-derives every item's own state independently from
 * `listStepRuns`, never from `currentStepId`, so routing back to it here is correct and
 * loses nothing.
 */
function resolveCurrentStep(
  pipeline: PipelineDefinition,
  currentStepId: string,
): PipelineStep {
  const direct = pipeline.steps[currentStepId];
  if (direct !== undefined) return direct;

  const match = MAP_ITEM_STEP_ID_PATTERN.exec(currentStepId);
  const mapStepId = match?.[1];
  const owningMapStep = mapStepId === undefined ? undefined : pipeline.steps[mapStepId];
  if (owningMapStep !== undefined && owningMapStep.kind === 'map') {
    return owningMapStep;
  }

  throw new OrchestratorRunnerError(
    `Pipeline "${pipeline.id}": no such step "${currentStepId}".`,
  );
}

function succeededOutcome(
  options: RunnerOptions,
  context: StepExecutionContext,
  output: unknown,
): StepRunOutcome {
  const telemetry = options.collectStepTelemetry?.(context, output);
  return {
    status: 'SUCCEEDED',
    output,
    ...(telemetry?.tokensUsed !== undefined && { tokensUsed: telemetry.tokensUsed }),
    ...(telemetry?.costUsd !== undefined && { costUsd: telemetry.costUsd }),
    ...(telemetry?.retrievedContext !== undefined && {
      retrievedContext: telemetry.retrievedContext,
    }),
    ...(telemetry?.guardrailVerdicts !== undefined && {
      guardrailVerdicts: telemetry.guardrailVerdicts,
    }),
  };
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
  const step = resolveCurrentStep(pipeline, currentStepId);

  // Dispatched before the generic per-attempt pre-checks below, which assume
  // `currentStepId` names the one step whose latest attempt they should inspect. A map
  // step's `run.currentStepId` in the database is frequently a *map item's* synthetic id
  // instead (see `resolveCurrentStep`'s own header) — `advanceMapStep` re-derives each
  // item's own state independently via `listStepRuns`, never through this generic path.
  if (step.kind === 'map') {
    return advanceMapStep(tx, pipeline, run, step, options, now);
  }

  const stepRuns = await listStepRuns(tx, runId);
  const latest = latestAttempt(stepRuns, step.id);

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
  // Stage 06 step 8: "per-tenant and per-agent concurrency limits." Only `agent_call`
  // steps have an agent to key on; a refusal here is "no progress this call," the same
  // idiom a retry-not-yet-due or a still-running step's own timeout already use — nothing
  // is written, no step-run row is even created, and a later call (once some other run
  // has released a slot) may succeed.
  let concurrencySlot: ConcurrencySlot | null = null;
  if (step.kind === 'agent_call' && options.concurrencyLimiter !== undefined) {
    concurrencySlot = options.concurrencyLimiter.tryAcquire(run.tenantId, step.agentId);
    if (concurrencySlot === null) return run;
  }

  const tracer = options.tracer ?? NOOP_TRACER;
  const stepRun = await startStepRun(tx, run.id, step.id, attempt, run.input, now);
  const span = tracer.startSpan(`orchestrator.step.${step.kind}`, {
    trace_id: run.traceId,
    run_id: run.id,
    step_id: step.id,
    attempt,
  });
  try {
    const context: StepExecutionContext = {
      runId: run.id,
      stepId: step.id,
      attempt,
      input: run.input,
    };
    const output = await options.executeStep(context);
    await finishStepRun(tx, stepRun.id, succeededOutcome(options, context, output), now);
    const nextId = nextStepAfterSuccess(step);
    return await advanceToNextStep(tx, run.id, step.id, nextId, now);
  } catch (error) {
    span.recordException(error);
    const message = error instanceof Error ? error.message : String(error);
    return await handleFailure(tx, pipeline, run, step, attempt, message, options, now);
  } finally {
    span.end();
    concurrencySlot?.release();
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
      const context: StepExecutionContext = {
        runId: run.id,
        stepId: compensationStepId,
        attempt: 0,
        input: run.input,
      };
      const output = await options.executeStep(context);
      await finishStepRun(
        tx,
        stepRun.id,
        succeededOutcome(options, context, output),
        now,
      );
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

// ─────────────────────────────────────────────────────────────────────────────
// map step execution
// ─────────────────────────────────────────────────────────────────────────────

/** The step-run `stepId` column value one item of `mapStepId` is persisted under —
 * distinct from `itemStep.id` (the *declared* step every item shares), so each item gets
 * its own durable, independently-resumable row via the existing `startStepRun`/
 * `finishStepRun`/`listStepRuns` primitives with no schema change. */
function mapItemStepId(mapStepId: string, index: number): string {
  return `${mapStepId}[${index}]`;
}

/** Reads and validates the collection a `map` step fans out over. A missing or
 * non-array field is the caller's own malformed input, not a retryable condition — it
 * fails loud before any step-run row is written, the same "validate before anything is
 * read" shape `decideHumanGate`'s Zod parse already follows. */
function readMapCollection(
  input: unknown,
  collectionField: string,
  mapStepId: string,
): readonly unknown[] {
  const record = input as Record<string, unknown> | null | undefined;
  const value = record?.[collectionField];
  if (!Array.isArray(value)) {
    throw new OrchestratorRunnerError(
      `Map step "${mapStepId}": run input field "${collectionField}" is not an array.`,
    );
  }
  return value;
}

/**
 * Fans `step.itemStepId` out once per item of the collection at
 * `run.input[step.collectionField]`. Each item is its own durable attempt sequence —
 * same retry/timeout/concurrency/telemetry machinery `executeForwardStep` gives a normal
 * step, just keyed by `mapItemStepId` instead of the declared step id — so a crash mid-map
 * resumes at the first item that has not yet succeeded, never re-running one that has.
 *
 * Deliberately one internal loop across all not-yet-succeeded items in a single call,
 * rather than one call per item: `runToCompletion`'s own "no progress" check compares the
 * run's `(status, currentStepId)` before and after a call, and both stay fixed at this map
 * step's id for the map's entire duration (advancing only once every item has succeeded).
 * A design that returned after each single item's success would leave both unchanged too,
 * so `runToCompletion` would stop after the very first item — the loop here is what keeps
 * that contract honest. The loop still stops and returns as soon as an item is not
 * currently actionable (still within its timeout, or a retry not yet due), which is the
 * same "no progress possible this call" case a normal step already has.
 */
async function advanceMapStep(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  step: Extract<PipelineStep, { kind: 'map' }>,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  const itemStep = stepFor(pipeline, step.itemStepId);
  const collection = readMapCollection(run.input, step.collectionField, step.id);

  if (collection.length === 0) {
    return advanceToNextStep(tx, run.id, step.id, nextStepAfterSuccess(step), now);
  }

  for (let index = 0; index < collection.length; index += 1) {
    const itemStepId = mapItemStepId(step.id, index);
    const stepRuns = await listStepRuns(tx, run.id);
    const latest = latestAttempt(stepRuns, itemStepId);
    if (latest?.status === 'SUCCEEDED') continue;

    const result = await advanceMapItem(
      tx,
      pipeline,
      run,
      itemStep,
      itemStepId,
      collection[index],
      latest,
      options,
      now,
    );
    if (!result.succeeded) return result.run;
    // Succeeded — fall through to the next index within this same call.
  }

  return advanceToNextStep(tx, run.id, step.id, nextStepAfterSuccess(step), now);
}

interface MapItemAttemptResult {
  readonly succeeded: boolean;
  readonly run: OrchestratorRunRow;
}

/** Decides what to do for one map item given its most recent attempt — the same
 * RUNNING-timeout / RETRY_SCHEDULED-due checks `advanceRun` makes for a normal step,
 * scoped to `itemStep`'s own `timeoutMs`/`maxRetries` rather than the outer map step's. */
async function advanceMapItem(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  itemStep: PipelineStep,
  itemStepId: string,
  itemInput: unknown,
  latest: OrchestratorStepRunRow | undefined,
  options: RunnerOptions,
  now: Date,
): Promise<MapItemAttemptResult> {
  if (latest?.status === 'RUNNING') {
    if (!hasTimedOut(latest.startedAt ?? latest.createdAt, itemStep.timeoutMs, now)) {
      return { succeeded: false, run };
    }
    await finishStepRun(tx, latest.id, { status: 'TIMED_OUT' }, now);
    const outcome = await handleMapItemFailure(
      tx,
      pipeline,
      run,
      itemStep,
      itemStepId,
      latest.attempt,
      'Step timed out.',
      options,
      now,
    );
    return { succeeded: false, run: outcome };
  }

  if (latest?.status === 'RETRY_SCHEDULED') {
    if (latest.nextAttemptAt !== null && latest.nextAttemptAt.getTime() > now.getTime()) {
      return { succeeded: false, run };
    }
    return executeMapItemAttempt(
      tx,
      pipeline,
      run,
      itemStep,
      itemStepId,
      itemInput,
      latest.attempt + 1,
      options,
      now,
    );
  }

  return executeMapItemAttempt(
    tx,
    pipeline,
    run,
    itemStep,
    itemStepId,
    itemInput,
    latest === undefined ? 0 : latest.attempt + 1,
    options,
    now,
  );
}

/** Runs exactly one attempt of one map item — `executeForwardStep`'s own body, scoped to
 * one collection item instead of the whole run. `context.stepId` is `itemStep.id` (the
 * *declared* step every item shares), so a `StepExecutor` resolves the agent/tool the same
 * way it would outside a map; `context.mapItemIndex` is what lets a caller building an
 * idempotency key still tell items apart, since `stepId` and `attempt` alone collide
 * across items (see `StepExecutionContext`'s own field comment). */
async function executeMapItemAttempt(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  itemStep: PipelineStep,
  itemStepId: string,
  itemInput: unknown,
  attempt: number,
  options: RunnerOptions,
  now: Date,
): Promise<MapItemAttemptResult> {
  let concurrencySlot: ConcurrencySlot | null = null;
  if (itemStep.kind === 'agent_call' && options.concurrencyLimiter !== undefined) {
    concurrencySlot = options.concurrencyLimiter.tryAcquire(
      run.tenantId,
      itemStep.agentId,
    );
    if (concurrencySlot === null) return { succeeded: false, run };
  }

  const index = Number(itemStepId.slice(itemStepId.lastIndexOf('[') + 1, -1));
  const tracer = options.tracer ?? NOOP_TRACER;
  const stepRun = await startStepRun(tx, run.id, itemStepId, attempt, itemInput, now);
  const span = tracer.startSpan(`orchestrator.step.${itemStep.kind}`, {
    trace_id: run.traceId,
    run_id: run.id,
    step_id: itemStepId,
    attempt,
  });
  try {
    const context: StepExecutionContext = {
      runId: run.id,
      stepId: itemStep.id,
      attempt,
      input: itemInput,
      mapItemIndex: index,
    };
    const output = await options.executeStep(context);
    await finishStepRun(tx, stepRun.id, succeededOutcome(options, context, output), now);
    return { succeeded: true, run };
  } catch (error) {
    span.recordException(error);
    const message = error instanceof Error ? error.message : String(error);
    const outcome = await handleMapItemFailure(
      tx,
      pipeline,
      run,
      itemStep,
      itemStepId,
      attempt,
      message,
      options,
      now,
    );
    return { succeeded: false, run: outcome };
  } finally {
    span.end();
    concurrencySlot?.release();
  }
}

/** `handleFailure`'s own retry-vs-compensate decision, scoped to one map item: retrying
 * schedules that item's own next attempt and leaves the run itself untouched (still
 * `RUNNING` at the map step, exactly like a normal step's `RETRY_SCHEDULED`); exhausting
 * an item's retries fails the whole map the same way an exhausted normal step would —
 * there is no per-item compensation concept, only the outer map step's own
 * `compensatesWith`, which `runCompensation` already resolves from `run.succeededStepIds`
 * (an item's synthetic id is never appended there — see `advanceMapStep`'s own header). */
async function handleMapItemFailure(
  tx: TenantClient,
  pipeline: PipelineDefinition,
  run: OrchestratorRunRow,
  itemStep: PipelineStep,
  itemStepId: string,
  attempt: number,
  errorMessage: string,
  options: RunnerOptions,
  now: Date,
): Promise<OrchestratorRunRow> {
  if (shouldRetry(attempt, itemStep.maxRetries)) {
    const delayMs = computeRetryDelayMs(
      attempt,
      options.retryBaseMs ?? 1_000,
      options.retryMaxMs ?? 30_000,
      options.random,
    );
    const stepRuns = await listStepRuns(tx, run.id);
    const current = latestAttempt(stepRuns, itemStepId);
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
