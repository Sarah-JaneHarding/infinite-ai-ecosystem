// The run/step lifecycle's pure logic — Stage 06 step 4.
//
// "The runner must provide durability, resumability, idempotency, retries with jitter,
// per-step timeouts, cancellation, and compensation on failure." Every one of those is a
// decision this module makes with no I/O at all — durability and resumability are what
// `runner.ts`'s persistence layer does with these decisions, not decisions themselves.
// This is the same split `packages/brain`'s write path already draws between its pure
// state machine and its persisting orchestrator.

import type { PipelineDefinition, PipelineStep } from './dag.js';

export type RunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export type StepRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'SKIPPED';

export class OrchestratorError extends Error {
  public override readonly name = 'OrchestratorError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Full-jitter exponential backoff: a random delay between 0 and
 * `min(maxMs, baseMs * 2^attempt)`. `attempt` is 0 for the delay before the *first* retry
 * (the call that already failed once). `random` defaults to `Math.random` and is
 * injectable so a test can assert an exact value rather than only a range.
 */
export function computeRetryDelayMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  if (attempt < 0) {
    throw new OrchestratorError(`attempt must be >= 0, got ${attempt}.`);
  }
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(random() * ceiling);
}

/** Whether a step that has just failed on `attempt` (0-indexed: 0 is the first attempt)
 * may retry, given the step's own declared `maxRetries`. */
export function shouldRetry(attempt: number, maxRetries: number): boolean {
  return attempt < maxRetries;
}

/** Whether a still-running step has exceeded its own declared timeout. */
export function hasTimedOut(startedAt: Date, timeoutMs: number, now: Date): boolean {
  return now.getTime() - startedAt.getTime() >= timeoutMs;
}

/**
 * The step id a run moves to after `step` succeeds. `branch` requires `branchResult` —
 * the runner's own evaluation of `step.condition` — and every other kind (including a
 * terminal `next: null`) needs none.
 */
export function nextStepAfterSuccess(
  step: PipelineStep,
  branchResult?: boolean,
): string | null {
  switch (step.kind) {
    case 'agent_call':
    case 'tool_call':
    case 'human_gate':
    case 'map':
      return step.next;
    case 'branch':
      if (branchResult === undefined) {
        throw new OrchestratorError(
          `Step "${step.id}" is a branch; nextStepAfterSuccess needs its condition's result.`,
        );
      }
      return branchResult ? step.onTrue : step.onFalse;
    case 'compensation':
      // A compensation step is invoked directly by the runner on failure, never reached
      // by walking `next` — there is nothing "after" it in the forward graph.
      return null;
  }
}

/**
 * Which `compensation` steps must run, and in what order, when `failedStepId` fails:
 * every already-succeeded step's own `compensatesWith`, walked in reverse of the order
 * those steps actually succeeded in — undoing the most recent effect first, the same
 * "last in, first undone" shape a database transaction rollback already has.
 */
export function compensationChain(
  pipeline: PipelineDefinition,
  succeededStepIdsInOrder: readonly string[],
): readonly string[] {
  const chain: string[] = [];
  for (let i = succeededStepIdsInOrder.length - 1; i >= 0; i--) {
    const stepId = succeededStepIdsInOrder[i]!;
    const step = pipeline.steps[stepId];
    if (step?.compensatesWith !== null && step?.compensatesWith !== undefined) {
      chain.push(step.compensatesWith);
    }
  }
  return chain;
}
