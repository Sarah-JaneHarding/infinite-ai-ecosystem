// The Run Inspector — Stage 06 step 9.
//
// "A developer-facing view of a run: the DAG, per-step inputs/outputs, tokens, cost,
// latency, retrieved context and guardrail verdicts." Everything here is read-only and
// re-derived from persisted state, the same resumability idiom the rest of this package
// already holds to — `inspectRun` is just `getRun` plus `listStepRuns` reshaped into one
// structure, never a second source of truth.
//
// `pipeline` is optional: supplying it annotates each attempt with its step's own `kind`
// and, for the entry step, marks where the DAG starts. Omitting it still returns every
// attempt actually recorded — a run's history exists independently of whether the caller
// happens to have the pipeline definition handy (e.g. inspecting an old run whose pipeline
// version was later retired).
//
// Tokens, cost, retrieved context and guardrail verdicts are `null` on any attempt that
// didn't succeed, or that succeeded without a `collectStepTelemetry` hook wired in (see
// `runner.ts`'s own `StepTelemetryCollector` doc) — a stated scope boundary, not a gap in
// this module: nothing upstream captures usage from an attempt that failed before
// reporting it.

import {
  getRun,
  listStepRuns,
  type OrchestratorStepRunRow,
  type TenantClient,
} from '@infinite-ai/db';

import type { PipelineDefinition, StepKind } from './dag.js';

export interface StepInspection {
  readonly stepId: string;
  readonly kind: StepKind | null;
  readonly attempt: number;
  readonly status: OrchestratorStepRunRow['status'];
  readonly input: unknown;
  readonly output: unknown;
  readonly error: string | null;
  readonly tokensUsed: number | null;
  readonly costUsd: number | null;
  readonly retrievedContext: unknown;
  readonly guardrailVerdicts: unknown;
  /** `null` when the attempt has no `startedAt` (never actually started) or no
   * `completedAt` yet (still running, retry-scheduled, or otherwise unfinished). */
  readonly latencyMs: number | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface RunInspection {
  readonly runId: string;
  readonly pipelineId: string;
  readonly pipelineVersion: string;
  readonly status: string;
  readonly traceId: string;
  readonly currentStepId: string | null;
  readonly entryStepId: string | null;
  readonly steps: readonly StepInspection[];
  /** Sum of every attempt's `tokensUsed`/`costUsd` that reported one — an attempt that
   * reported nothing contributes 0, not a missing total. */
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  /** Sum of every attempt's own `latencyMs` that could be computed — wall-clock time spent
   * actually executing steps, which is not the same as the run's total elapsed time
   * (`updatedAt - createdAt`) once retries, timeouts, and a paused human_gate are involved. */
  readonly totalLatencyMs: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function latencyMs(row: OrchestratorStepRunRow): number | null {
  if (row.startedAt === null || row.completedAt === null) return null;
  return row.completedAt.getTime() - row.startedAt.getTime();
}

function toStepInspection(
  row: OrchestratorStepRunRow,
  pipeline: PipelineDefinition | undefined,
): StepInspection {
  return {
    stepId: row.stepId,
    kind: pipeline?.steps[row.stepId]?.kind ?? null,
    attempt: row.attempt,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    tokensUsed: row.tokensUsed,
    costUsd: row.costUsd,
    retrievedContext: row.retrievedContext,
    guardrailVerdicts: row.guardrailVerdicts,
    latencyMs: latencyMs(row),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

/** Assembles the full developer-facing view of one run, or `null` if no such run exists in
 * the current tenant. `pipeline` is optional (see this file's own header). */
export async function inspectRun(
  tx: TenantClient,
  runId: string,
  pipeline?: PipelineDefinition,
): Promise<RunInspection | null> {
  const run = await getRun(tx, runId);
  if (run === null) return null;

  const stepRuns = await listStepRuns(tx, runId);
  const steps = stepRuns.map((row) => toStepInspection(row, pipeline));

  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalLatencyMs = 0;
  for (const step of steps) {
    totalTokens += step.tokensUsed ?? 0;
    totalCostUsd += step.costUsd ?? 0;
    totalLatencyMs += step.latencyMs ?? 0;
  }

  return {
    runId: run.id,
    pipelineId: run.pipelineId,
    pipelineVersion: run.pipelineVersion,
    status: run.status,
    traceId: run.traceId,
    currentStepId: run.currentStepId,
    entryStepId: pipeline?.entryStepId ?? null,
    steps,
    totalTokens,
    totalCostUsd,
    totalLatencyMs,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
