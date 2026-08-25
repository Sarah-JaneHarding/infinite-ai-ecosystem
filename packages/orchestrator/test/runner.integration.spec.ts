// The DAG runner proven end to end, against a real Postgres — Stage 06 step 4.
//
// The pure pieces (dag.spec.ts, run-state-machine.spec.ts) already prove the DAG
// validation and the retry/timeout/next-step/compensation decisions in isolation; this is
// what proves the wiring actually works: a run persists through every step, resumes
// correctly after a "crash" (a fresh read, not state held in memory), retries with a real
// scheduled delay, times out a stale attempt, compensates in reverse order on an
// exhausted failure, pauses at a human gate, and carries one trace ID throughout.

import { randomUUID } from 'node:crypto';

import {
  disconnect,
  finishStepRun,
  getApprovalTaskForStep,
  startStepRun,
  withTenant,
} from '@infinite-ai/db';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createTracer } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConcurrencyLimiter } from '../src/concurrency.js';
import { PipelineDagError, type PipelineDefinition } from '../src/dag.js';
import { inspectRun } from '../src/inspector.js';
import {
  OrchestratorRunnerError,
  advanceRun,
  cancelRun,
  decideHumanGate,
  runToCompletion,
  startRun,
  type ApprovalMaterialProvider,
  type StepExecutionContext,
  type StepTelemetryCollector,
} from '../src/runner.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let spanExporter: InMemorySpanExporter;

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.appRwUrl;
}, 180_000);

afterAll(async () => {
  await disconnect();
  await db?.stop();
});

beforeEach(() => {
  spanExporter = new InMemorySpanExporter();
});

async function seedTenant(): Promise<{ tenantId: string; actorId: string }> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  await withTenant({ tenantId, actorId }, (tx) =>
    tx.tenant.create({
      data: {
        id: tenantId,
        name: `Runner Test ${tenantId.slice(0, 8)}`,
        slug: `runner-${tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
  return { tenantId, actorId };
}

/** Creates a user account and grants it `role` in `tenantId` — what `decideHumanGate`'s
 * own role check reads back via `hasActiveRoleAssignment`. */
async function seedActorWithRole(
  tenantId: string,
  actorId: string,
  role: string,
): Promise<string> {
  return withTenant({ tenantId, actorId }, async (tx) => {
    const user = await tx.userAccount.create({
      data: {
        tenantId,
        subject: `oidc-${randomUUID()}`,
        email: `${role}-${randomUUID().slice(0, 8)}@example.test`,
        displayName: `Test ${role}`,
      },
    });
    await tx.roleAssignment.create({ data: { tenantId, userAccountId: user.id, role } });
    return user.id;
  });
}

const STEP_COMMON = { timeoutMs: 10_000, maxRetries: 2, compensatesWith: null };

const prepareApproval: ApprovalMaterialProvider = () => ({
  artefact: { draft: 'v2' },
  evidence: { source: 'unit-test' },
});

describe('a linear pipeline of agent_call/tool_call steps', () => {
  it('runs to SUCCEEDED, and every step span carries the same trace id', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'ref-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'step-2',
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'tool_call',
          toolName: 'publish',
          next: 'step-3',
        },
        'step-3': {
          ...STEP_COMMON,
          id: 'step-3',
          kind: 'agent_call',
          agentId: 'CE-03',
          next: null,
        },
      },
    };

    const calls: StepExecutionContext[] = [];
    const tracer = createTracer({
      serviceName: 'test-orchestrator',
      spanProcessor: new SimpleSpanProcessor(spanExporter),
    });
    const traceId = randomUUID();

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, { learnerId: 'L1' }, traceId, actorId);
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          calls.push(ctx);
          return { done: ctx.stepId };
        },
        tracer,
      });
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['step-1', 'step-2', 'step-3']);
    expect(calls.map((c) => c.stepId)).toEqual(['step-1', 'step-2', 'step-3']);

    const spans = spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(3);
    for (const span of spans) {
      expect(span.attributes.trace_id).toBe(traceId);
    }
  });
});

describe('a human gate', () => {
  it('pauses the run, and stays paused across repeated resumption attempts', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'gated-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'gate',
        },
        gate: {
          ...STEP_COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: 'step-2',
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'agent_call',
          agentId: 'CE-02',
          next: null,
        },
      },
    };

    let calls = 0;
    const result = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const first = await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => {
          calls += 1;
          return {};
        },
        prepareApproval,
      });
      const second = await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => {
          calls += 1;
          return {};
        },
        prepareApproval,
      });
      return { first, second };
    });

    expect(result.first.status).toBe('WAITING_FOR_APPROVAL');
    expect(result.first.currentStepId).toBe('gate');
    expect(result.second.status).toBe('WAITING_FOR_APPROVAL');
    expect(calls).toBe(1); // only step-1 ran; the gate itself never calls the executor
  });

  it('opens the approval task with the artefact, evidence and required role supplied', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'gated-inspect-pipeline',
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...STEP_COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: null,
        },
      },
    };

    const task = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => ({}),
        prepareApproval,
      });
      return getApprovalTaskForStep(tx, run.id, 'gate');
    });

    expect(task).not.toBeNull();
    expect(task?.requiredRole).toBe('hod');
    expect(task?.artefact).toEqual({ draft: 'v2' });
    expect(task?.evidence).toEqual({ source: 'unit-test' });
    expect(task?.decision).toBeNull();
  });
});

describe('human gate decisions', () => {
  function gatedPipeline(
    id: string,
    compensatesWith: string | null = null,
  ): PipelineDefinition {
    return {
      id,
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          compensatesWith,
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'gate',
        },
        gate: {
          ...STEP_COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: 'step-2',
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'agent_call',
          agentId: 'CE-02',
          next: null,
        },
      },
    };
  }

  it('an approval proceeds to the next step', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('approve-pipeline');

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const executeStep = async () => ({});
      await runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
      await decideHumanGate(tx, run.id, {
        outcome: 'APPROVED',
        decidedBy: hodId,
        reason: 'Looks correct.',
      });
      return runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['step-1', 'gate', 'step-2']);
  });

  it('an edit proceeds to the next step and records the edit diff', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('edit-pipeline');

    const { finished, task } = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const executeStep = async () => ({});
      await runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
      await decideHumanGate(tx, run.id, {
        outcome: 'EDITED',
        decidedBy: hodId,
        reason: 'Fixed the wording.',
        editDiff: { before: 'v2', after: 'v2-edited' },
      });
      const finished = await runToCompletion(tx, pipeline, run.id, {
        executeStep,
        prepareApproval,
      });
      const task = await getApprovalTaskForStep(tx, run.id, 'gate');
      return { finished, task };
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(task?.decision).toBe('EDITED');
    expect(task?.editDiff).toEqual({ before: 'v2', after: 'v2-edited' });
  });

  it('a rejection with nothing to compensate ends FAILED, not SUCCEEDED', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('reject-pipeline');

    let step2Calls = 0;
    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const executeStep = async (ctx: StepExecutionContext): Promise<unknown> => {
        if (ctx.stepId === 'step-2') step2Calls += 1;
        return {};
      };
      await runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
      await decideHumanGate(tx, run.id, {
        outcome: 'REJECTED',
        decidedBy: hodId,
        reason: 'Not ready.',
      });
      return runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
    });

    expect(finished.status).toBe('FAILED');
    expect(step2Calls).toBe(0); // rejecting must never let the run proceed forward
  });

  it('a rejection rolls back an earlier step through compensation', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('reject-compensates-pipeline', 'undo-1');
    pipeline.steps['undo-1'] = {
      ...STEP_COMMON,
      id: 'undo-1',
      kind: 'compensation',
      compensatesStepId: 'step-1',
      agentId: null,
      toolName: 'release_resource',
    };

    const callOrder: string[] = [];
    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const executeStep = async (ctx: StepExecutionContext): Promise<unknown> => {
        callOrder.push(ctx.stepId);
        return {};
      };
      await runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
      await decideHumanGate(tx, run.id, {
        outcome: 'REJECTED',
        decidedBy: hodId,
        reason: 'Not ready.',
      });
      return runToCompletion(tx, pipeline, run.id, { executeStep, prepareApproval });
    });

    expect(finished.status).toBe('COMPENSATED');
    expect(callOrder).toEqual(['step-1', 'undo-1']);
  });
});

describe('human gate bypass vectors', () => {
  function gatedPipeline(id: string): PipelineDefinition {
    return {
      id,
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...STEP_COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: null,
        },
      },
    };
  }

  it('refuses a decision from an actor who does not hold the required role', async () => {
    const { tenantId, actorId } = await seedTenant();
    const teacherId = await seedActorWithRole(tenantId, actorId, 'teacher');
    const pipeline = gatedPipeline('bypass-role-pipeline');

    const { rejection, task } = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => ({}),
        prepareApproval,
      });
      let rejection: unknown;
      try {
        await decideHumanGate(tx, run.id, {
          outcome: 'APPROVED',
          decidedBy: teacherId,
          reason: 'I will approve this myself.',
        });
      } catch (error) {
        rejection = error;
      }
      const task = await getApprovalTaskForStep(tx, run.id, 'gate');
      return { rejection, task };
    });

    expect(rejection).toBeInstanceOf(OrchestratorRunnerError);
    expect(task?.decision).toBeNull(); // the bypass attempt left nothing decided
  });

  it('refuses a second decision on an already-decided task', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('bypass-double-decide-pipeline');

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => ({}),
        prepareApproval,
      });
      await decideHumanGate(tx, run.id, {
        outcome: 'APPROVED',
        decidedBy: hodId,
        reason: 'First decision.',
      });
      await expect(
        decideHumanGate(tx, run.id, {
          outcome: 'REJECTED',
          decidedBy: hodId,
          reason: 'Changed my mind.',
        }),
      ).rejects.toThrow(OrchestratorRunnerError);
      const task = await getApprovalTaskForStep(tx, run.id, 'gate');
      expect(task?.decision).toBe('APPROVED'); // the first decision, unchanged
    });
  });

  it('refuses to decide a run that is not currently waiting for approval', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('bypass-not-waiting-pipeline');

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      // Still PENDING — the run has not even reached the gate yet.
      await expect(
        decideHumanGate(tx, run.id, {
          outcome: 'APPROVED',
          decidedBy: hodId,
          reason: 'Too early.',
        }),
      ).rejects.toThrow(OrchestratorRunnerError);
    });
  });

  it('refuses a decision with no reason', async () => {
    const { tenantId, actorId } = await seedTenant();
    const hodId = await seedActorWithRole(tenantId, actorId, 'hod');
    const pipeline = gatedPipeline('bypass-empty-reason-pipeline');

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => ({}),
        prepareApproval,
      });
      await expect(
        decideHumanGate(tx, run.id, {
          outcome: 'APPROVED',
          decidedBy: hodId,
          reason: '',
        }),
      ).rejects.toThrow(OrchestratorRunnerError);
    });
  });

  it('refuses to execute a human_gate step with no prepareApproval supplied', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = gatedPipeline('bypass-no-prepare-pipeline');

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await expect(
        runToCompletion(tx, pipeline, run.id, { executeStep: async () => ({}) }),
      ).rejects.toThrow(OrchestratorRunnerError);
    });
  });
});

describe('retries with jitter, resumed across separate calls', () => {
  it('does not retry before its scheduled time, and succeeds once it is due', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'retry-pipeline',
      version: '1.0.0',
      entryStepId: 'flaky',
      steps: {
        flaky: {
          ...STEP_COMMON,
          id: 'flaky',
          kind: 'tool_call',
          toolName: 'call_flaky_service',
          next: null,
          maxRetries: 2,
        },
      },
    };

    let attempts = 0;
    const t0 = new Date('2026-08-05T00:00:00.000Z');

    const outcome = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      const executeStep = async (): Promise<unknown> => {
        attempts += 1;
        if (attempts <= 1) throw new Error('transient failure');
        return { ok: true };
      };

      // First attempt fails and schedules a retry with a fixed, known delay.
      const afterFirstFailure = await advanceRun(
        tx,
        pipeline,
        run.id,
        { executeStep, retryBaseMs: 1_000, retryMaxMs: 10_000, random: () => 1 },
        t0,
      );
      expect(afterFirstFailure.status).toBe('RUNNING');

      // Too early — the retry is not due yet, so no progress is made.
      const tooEarly = await advanceRun(
        tx,
        pipeline,
        run.id,
        { executeStep },
        new Date(t0.getTime() + 500),
      );
      expect(attempts).toBe(1);
      expect(tooEarly.status).toBe('RUNNING');

      // Past the scheduled delay (1000ms, since random() => 1 hits the full ceiling):
      // resuming now retries and succeeds.
      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep },
        new Date(t0.getTime() + 1_500),
      );
    });

    expect(outcome.status).toBe('SUCCEEDED');
    expect(attempts).toBe(2);
  });
});

describe('per-step timeouts', () => {
  it('marks a stale RUNNING attempt TIMED_OUT and retries it on the next call', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'timeout-pipeline',
      version: '1.0.0',
      entryStepId: 'slow',
      steps: {
        slow: {
          ...STEP_COMMON,
          id: 'slow',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: null,
          timeoutMs: 1_000,
          maxRetries: 1,
        },
      },
    };

    const staleStart = new Date('2026-08-05T00:00:00.000Z');
    const muchLater = new Date(staleStart.getTime() + 60_000);

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      // Simulate a previous process crashing mid-step: a real RUNNING row, started long
      // enough ago that it has already exceeded its own timeout.
      await startStepRun(tx, run.id, 'slow', 0, {}, staleStart);

      // First call: notices the stale attempt timed out and schedules a retry with a
      // fixed, known delay (same controlled-timing shape as "retries with jitter" above —
      // a freshly-scheduled retry's own `nextAttemptAt` is always strictly after `now`, so
      // one call can never both schedule and immediately service a retry).
      const afterTimeout = await advanceRun(
        tx,
        pipeline,
        run.id,
        {
          executeStep: async () => ({ recovered: true }),
          retryBaseMs: 1_000,
          retryMaxMs: 10_000,
          random: () => 1,
        },
        muchLater,
      );
      expect(afterTimeout.status).toBe('RUNNING');

      // Past the scheduled delay: the retry runs and succeeds.
      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep: async () => ({ recovered: true }) },
        new Date(muchLater.getTime() + 1_500),
      );
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['slow']);
  });
});

describe('durability: killing the worker mid-run (Stage 06 step 10)', () => {
  it('resumes at the correct step on restart, with no duplicated side effects', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'durability-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'step-2',
          timeoutMs: 1_000,
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'tool_call',
          toolName: 'publish',
          next: 'step-3',
          timeoutMs: 1_000,
        },
        'step-3': {
          ...STEP_COMMON,
          id: 'step-3',
          kind: 'agent_call',
          agentId: 'CE-02',
          next: null,
          timeoutMs: 1_000,
        },
      },
    };

    const t0 = new Date('2026-08-06T00:00:00.000Z');
    const callCounts: Record<string, number> = {};
    const executeStep = async (ctx: StepExecutionContext): Promise<unknown> => {
      callCounts[ctx.stepId] = (callCounts[ctx.stepId] ?? 0) + 1;
      return { done: ctx.stepId };
    };

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);

      // A real worker process runs step-1 to completion — the durable, persisted state a
      // restart must never redo.
      const afterStep1 = await advanceRun(tx, pipeline, run.id, { executeStep }, t0);
      expect(afterStep1.succeededStepIds).toEqual(['step-1']);

      // The worker then dies mid-step-2: its own RUNNING row exists (the row a real
      // in-flight step attempt would have), but the process crashed before executeStep
      // ever returned — simulated directly, the same way the "per-step timeouts" describe
      // block above does, rather than actually killing a process this test doesn't have.
      await startStepRun(tx, run.id, 'step-2', 0, run.input, t0);

      // "On restart": long enough after t0 for step-2's own timeout to have elapsed, with
      // no memory of anything the crashed process held. First call notices the timeout and
      // schedules a retry with a fixed, known delay (a freshly-scheduled retry's own
      // `nextAttemptAt` is always strictly after `now`, so one call can never both
      // schedule and immediately service a retry — the same controlled-timing shape
      // "retries with jitter" above uses).
      const muchLater = new Date(t0.getTime() + 60_000);
      const afterTimeout = await advanceRun(
        tx,
        pipeline,
        run.id,
        { executeStep, retryBaseMs: 1_000, retryMaxMs: 10_000, random: () => 1 },
        muchLater,
      );
      expect(afterTimeout.status).toBe('RUNNING');

      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep },
        new Date(muchLater.getTime() + 1_500),
      );
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['step-1', 'step-2', 'step-3']);
    // The correct step: step-2 resumed and completed rather than the run restarting from
    // step-1. No duplicated side effects: step-1's own executor ran exactly once, before
    // the crash — never replayed by the restart — and step-2 ran exactly once despite
    // being crashed mid-attempt.
    expect(callCounts['step-1']).toBe(1);
    expect(callCounts['step-2']).toBe(1);
    expect(callCounts['step-3']).toBe(1);
  });
});

describe('compensation on an exhausted failure', () => {
  it('runs compensations in reverse order of success, and ends COMPENSATED', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'compensating-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          compensatesWith: 'undo-1',
          kind: 'tool_call',
          toolName: 'book_resource',
          next: 'step-2',
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          compensatesWith: 'undo-2',
          kind: 'tool_call',
          toolName: 'charge_fee',
          next: 'step-3',
        },
        'step-3': {
          ...STEP_COMMON,
          id: 'step-3',
          kind: 'tool_call',
          toolName: 'always_fails',
          next: null,
          maxRetries: 0,
        },
        'undo-1': {
          ...STEP_COMMON,
          id: 'undo-1',
          kind: 'compensation',
          compensatesStepId: 'step-1',
          agentId: null,
          toolName: 'release_resource',
        },
        'undo-2': {
          ...STEP_COMMON,
          id: 'undo-2',
          kind: 'compensation',
          compensatesStepId: 'step-2',
          agentId: null,
          toolName: 'refund_fee',
        },
      },
    };

    const callOrder: string[] = [];

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          callOrder.push(ctx.stepId);
          if (ctx.stepId === 'step-3') throw new Error('permanent failure');
          return {};
        },
      });
    });

    expect(finished.status).toBe('COMPENSATED');
    expect(callOrder).toEqual(['step-1', 'step-2', 'step-3', 'undo-2', 'undo-1']);
  });
});

describe('cancellation', () => {
  it('stops further advancement once a run is cancelled', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'cancel-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'step-2',
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'agent_call',
          agentId: 'CE-02',
          next: null,
        },
      },
    };

    let step2Calls = 0;

    const { afterCancel, afterResume } = await withTenant(
      { tenantId, actorId },
      async (tx) => {
        const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
        const executeStep = async (ctx: StepExecutionContext): Promise<unknown> => {
          if (ctx.stepId === 'step-2') step2Calls += 1;
          return {};
        };
        await advanceRun(tx, pipeline, run.id, { executeStep }); // runs step-1 only
        const afterCancel = await cancelRun(tx, run.id);
        const afterResume = await runToCompletion(tx, pipeline, run.id, { executeStep });
        return { afterCancel, afterResume };
      },
    );

    expect(afterCancel.status).toBe('CANCELLED');
    expect(afterResume.status).toBe('CANCELLED');
    expect(step2Calls).toBe(0);
  });
});

describe('startRun’s optional irreversible-tool gating (Stage 06 step 7)', () => {
  const isIrreversibleTool = (name: string): boolean => name === 'delete_record';

  it('refuses to open a run whose pipeline reaches an irreversible tool ungated', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'ungated-irreversible-pipeline',
      version: '1.0.0',
      entryStepId: 'del',
      steps: {
        del: {
          ...STEP_COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };

    await withTenant({ tenantId, actorId }, async (tx) => {
      await expect(
        startRun(tx, pipeline, {}, randomUUID(), actorId, isIrreversibleTool),
      ).rejects.toThrow(PipelineDagError);
    });
  });

  it('opens the run when every path to the irreversible tool is gated', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'gated-irreversible-pipeline',
      version: '1.0.0',
      entryStepId: 'gate',
      steps: {
        gate: {
          ...STEP_COMMON,
          id: 'gate',
          kind: 'human_gate',
          requiredRole: 'hod',
          next: 'del',
        },
        del: {
          ...STEP_COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };

    const run = await withTenant({ tenantId, actorId }, (tx) =>
      startRun(tx, pipeline, {}, randomUUID(), actorId, isIrreversibleTool),
    );
    expect(run.status).toBe('PENDING');
  });

  it('does not check gating at all when isIrreversibleTool is omitted', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'unchecked-irreversible-pipeline',
      version: '1.0.0',
      entryStepId: 'del',
      steps: {
        del: {
          ...STEP_COMMON,
          id: 'del',
          kind: 'tool_call',
          toolName: 'delete_record',
          next: null,
        },
      },
    };

    const run = await withTenant({ tenantId, actorId }, (tx) =>
      startRun(tx, pipeline, {}, randomUUID(), actorId),
    );
    expect(run.status).toBe('PENDING');
  });
});

describe('concurrency limiting (Stage 06 step 8)', () => {
  it('makes no progress on an agent_call step while its agent is at capacity', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'concurrency-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: null,
        },
      },
    };
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 10, maxPerAgent: 1 });

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);

      // Occupy the one slot this agent has, as if another run's step were already
      // executing — the deterministic way to prove the wiring without a real race.
      const heldSlot = limiter.tryAcquire(tenantId, 'CE-01')!;

      let calls = 0;
      const blocked = await advanceRun(tx, pipeline, run.id, {
        executeStep: async () => {
          calls += 1;
          return {};
        },
        concurrencyLimiter: limiter,
      });
      expect(blocked.status).toBe('PENDING');
      expect(blocked.currentStepId).toBeNull();
      expect(calls).toBe(0);

      heldSlot.release();

      const finished = await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => {
          calls += 1;
          return {};
        },
        concurrencyLimiter: limiter,
      });
      expect(finished.status).toBe('SUCCEEDED');
      expect(calls).toBe(1);
    });
  });

  it('does not limit tool_call steps, which have no agent to key on', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'concurrency-tool-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'tool_call',
          toolName: 'publish',
          next: null,
        },
      },
    };
    // A limiter with zero capacity would refuse every agent_call outright; a tool_call
    // must still proceed since it has no agentId to check against.
    const limiter = new ConcurrencyLimiter({ maxPerTenant: 0, maxPerAgent: 0 });

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => ({}),
        concurrencyLimiter: limiter,
      });
    });
    expect(finished.status).toBe('SUCCEEDED');
  });
});

describe('run inspection and step telemetry (Stage 06 step 9)', () => {
  it('captures tokens/cost/retrieved-context/guardrail-verdicts only on succeeded attempts, and inspectRun totals them', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'telemetry-pipeline',
      version: '1.0.0',
      entryStepId: 'flaky',
      steps: {
        flaky: {
          ...STEP_COMMON,
          id: 'flaky',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: 'step-2',
          maxRetries: 1,
        },
        'step-2': {
          ...STEP_COMMON,
          id: 'step-2',
          kind: 'tool_call',
          toolName: 'publish',
          next: null,
        },
      },
    };

    let flakyAttempts = 0;
    const collectStepTelemetry: StepTelemetryCollector = (ctx) => {
      if (ctx.stepId === 'flaky') return { tokensUsed: 100, costUsd: 0.01 };
      if (ctx.stepId === 'step-2') {
        return {
          retrievedContext: { facts: ['f1'] },
          guardrailVerdicts: [{ passed: true }],
        };
      }
      return undefined;
    };

    const { finished, inspection } = await withTenant(
      { tenantId, actorId },
      async (tx) => {
        const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
        const finished = await runToCompletion(
          tx,
          pipeline,
          run.id,
          {
            executeStep: async (ctx) => {
              if (ctx.stepId === 'flaky') {
                flakyAttempts += 1;
                if (flakyAttempts === 1) throw new Error('transient failure');
              }
              return { done: ctx.stepId };
            },
            collectStepTelemetry,
            retryBaseMs: 0,
            retryMaxMs: 0,
            random: () => 0,
          },
          new Date('2026-08-06T00:00:00.000Z'),
        );
        const inspection = await inspectRun(tx, run.id, pipeline);
        return { finished, inspection };
      },
    );

    expect(finished.status).toBe('SUCCEEDED');
    expect(inspection).not.toBeNull();
    expect(inspection?.entryStepId).toBe('flaky');

    const flakyAttempt0 = inspection?.steps.find(
      (s) => s.stepId === 'flaky' && s.attempt === 0,
    );
    expect(flakyAttempt0?.status).toBe('RETRY_SCHEDULED');
    expect(flakyAttempt0?.tokensUsed).toBeNull(); // the failed attempt reported nothing
    expect(flakyAttempt0?.costUsd).toBeNull();

    const flakyAttempt1 = inspection?.steps.find(
      (s) => s.stepId === 'flaky' && s.attempt === 1,
    );
    expect(flakyAttempt1?.status).toBe('SUCCEEDED');
    expect(flakyAttempt1?.kind).toBe('agent_call');
    expect(flakyAttempt1?.tokensUsed).toBe(100);
    expect(flakyAttempt1?.costUsd).toBe(0.01);

    const step2 = inspection?.steps.find((s) => s.stepId === 'step-2');
    expect(step2?.kind).toBe('tool_call');
    expect(step2?.retrievedContext).toEqual({ facts: ['f1'] });
    expect(step2?.guardrailVerdicts).toEqual([{ passed: true }]);
    expect(step2?.tokensUsed).toBeNull();

    expect(inspection?.totalTokens).toBe(100);
    expect(inspection?.totalCostUsd).toBe(0.01);
  });

  it('returns null for a run that does not exist in this tenant', async () => {
    const { tenantId, actorId } = await seedTenant();
    const inspection = await withTenant({ tenantId, actorId }, (tx) =>
      inspectRun(tx, randomUUID()),
    );
    expect(inspection).toBeNull();
  });

  it('omits collectStepTelemetry with no change in behaviour, leaving telemetry columns null', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'no-telemetry-pipeline',
      version: '1.0.0',
      entryStepId: 'step-1',
      steps: {
        'step-1': {
          ...STEP_COMMON,
          id: 'step-1',
          kind: 'agent_call',
          agentId: 'CE-01',
          next: null,
        },
      },
    };

    const inspection = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, {}, randomUUID(), actorId);
      await runToCompletion(tx, pipeline, run.id, { executeStep: async () => ({}) });
      return inspectRun(tx, run.id);
    });

    expect(inspection?.entryStepId).toBeNull(); // no pipeline supplied to inspectRun
    expect(inspection?.steps[0]?.kind).toBeNull();
    expect(inspection?.steps[0]?.tokensUsed).toBeNull();
    expect(inspection?.totalTokens).toBe(0);
    expect(inspection?.totalCostUsd).toBe(0);
  });
});

describe('map step fan-out (Stage 52)', () => {
  function mapPipeline(collectionField = 'learners'): PipelineDefinition {
    return {
      id: 'map-pipeline',
      version: '1.0.0',
      entryStepId: 'screen-all',
      steps: {
        'screen-all': {
          ...STEP_COMMON,
          id: 'screen-all',
          kind: 'map',
          itemStepId: 'screen-one',
          collectionField,
          next: 'record-summary',
        },
        'screen-one': {
          ...STEP_COMMON,
          id: 'screen-one',
          kind: 'agent_call',
          agentId: 'AC-01',
          next: null,
        },
        'record-summary': {
          ...STEP_COMMON,
          id: 'record-summary',
          kind: 'tool_call',
          toolName: 'record_summary',
          next: null,
        },
      },
    };
  }

  it('runs itemStepId once per collection item, in order, then advances past the map', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();
    const calls: StepExecutionContext[] = [];

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: ['L1', 'L2', 'L3'] },
        randomUUID(),
        actorId,
      );
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          calls.push(ctx);
          return { screened: ctx.input };
        },
      });
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['screen-all', 'record-summary']);

    const itemCalls = calls.filter((c) => c.stepId === 'screen-one');
    expect(itemCalls).toHaveLength(3);
    expect(itemCalls.map((c) => c.input)).toEqual(['L1', 'L2', 'L3']);
    expect(itemCalls.map((c) => c.mapItemIndex)).toEqual([0, 1, 2]);
    expect(itemCalls.map((c) => c.attempt)).toEqual([0, 0, 0]);
    expect(calls[calls.length - 1]?.stepId).toBe('record-summary');
  });

  it('an empty collection advances straight past the map with no item calls', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();
    const calls: StepExecutionContext[] = [];

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(tx, pipeline, { learners: [] }, randomUUID(), actorId);
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          calls.push(ctx);
          return {};
        },
      });
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['screen-all', 'record-summary']);
    expect(calls).toHaveLength(1); // only record-summary ran
  });

  it('throws when the collection field on the run input is missing or not an array', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();

    await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: 'not-an-array' },
        randomUUID(),
        actorId,
      );
      await expect(
        runToCompletion(tx, pipeline, run.id, { executeStep: async () => ({}) }),
      ).rejects.toThrow(OrchestratorRunnerError);
    });
  });

  it('does not re-run an item whose step-run row already recorded SUCCEEDED (Stage 06 step 10 durability)', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();

    const { finished, calls } = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: ['L1', 'L2', 'L3'] },
        randomUUID(),
        actorId,
      );

      // Simulate a previous process having already completed item 0 before crashing: a
      // real SUCCEEDED row for it, written directly rather than through executeStep.
      const seeded = await startStepRun(tx, run.id, 'screen-all[0]', 0, 'L1', new Date());
      await finishStepRun(tx, seeded.id, { status: 'SUCCEEDED', output: {} }, new Date());

      // "Restart": a fresh call sequence, as a resumed worker would issue. Item 0's row
      // already says SUCCEEDED, so it must not be re-run.
      const calls: string[] = [];
      const result = await runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          calls.push(String(ctx.input));
          return {};
        },
      });
      return { finished: result, calls };
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['screen-all', 'record-summary']);
    // L1 is never re-run; only L2 and L3 go through executeStep, then record-summary
    // (whose input is the whole run input object, not a learner id).
    expect(calls).toEqual(['L2', 'L3', '[object Object]']);
  });

  it('retries one item on a transient failure without disturbing the others', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();
    let l2Attempts = 0;
    const succeeded: string[] = [];
    const t0 = new Date('2026-08-24T00:00:00.000Z');

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: ['L1', 'L2', 'L3'] },
        randomUUID(),
        actorId,
      );
      const executeStep = async (ctx: StepExecutionContext): Promise<unknown> => {
        if (ctx.stepId === 'screen-one' && ctx.input === 'L2') {
          l2Attempts += 1;
          if (l2Attempts === 1) throw new Error('transient failure on L2');
        }
        succeeded.push(ctx.stepId === 'screen-one' ? String(ctx.input) : ctx.stepId);
        return {};
      };

      // Runs L1 (succeeds), then L2 (fails, schedules a retry) — stops there since L2's
      // retry is not due yet.
      const afterFirstPass = await runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep, retryBaseMs: 1_000, retryMaxMs: 10_000, random: () => 1 },
        t0,
      );
      expect(afterFirstPass.status).toBe('RUNNING');
      expect(l2Attempts).toBe(1);

      // Past the scheduled delay: L2 retries and succeeds, then L3 and record-summary run.
      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep },
        new Date(t0.getTime() + 1_500),
      );
    });

    expect(finished.status).toBe('SUCCEEDED');
    // Attempted twice (the failed first attempt, then the successful retry), but only
    // pushed to `succeeded` once — the throw on the first attempt happens before the push.
    expect(l2Attempts).toBe(2);
    expect(succeeded).toEqual(['L1', 'L2', 'L3', 'record-summary']);
  });

  it('marks a stale RUNNING item TIMED_OUT and retries it on the next call', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline = mapPipeline();
    pipeline.steps['screen-one'] = {
      ...(pipeline.steps['screen-one'] as Extract<
        PipelineDefinition['steps'][string],
        { kind: 'agent_call' }
      >),
      timeoutMs: 1_000,
      maxRetries: 1,
    };

    const staleStart = new Date('2026-08-24T00:00:00.000Z');
    const muchLater = new Date(staleStart.getTime() + 60_000);

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: ['L1'] },
        randomUUID(),
        actorId,
      );
      // Simulate a previous process crashing mid-item: a real RUNNING row for item 0,
      // started long enough ago that it has already exceeded screen-one's own timeout.
      await startStepRun(tx, run.id, 'screen-all[0]', 0, 'L1', staleStart);

      // First call: notices the stale RUNNING row timed out and schedules a retry with a
      // fixed, known delay (same controlled-timing shape as "retries with jitter" above).
      const afterTimeout = await advanceRun(
        tx,
        pipeline,
        run.id,
        {
          executeStep: async () => ({ recovered: true }),
          retryBaseMs: 1_000,
          retryMaxMs: 10_000,
          random: () => 1,
        },
        muchLater,
      );
      expect(afterTimeout.status).toBe('RUNNING');

      // Past the scheduled delay: the retry runs, then item 0 and the rest of the
      // pipeline complete.
      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep: async () => ({ recovered: true }) },
        new Date(muchLater.getTime() + 1_500),
      );
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['screen-all', 'record-summary']);
  });

  it('exhausting one item’s retries fails the whole map and runs compensation for earlier steps', async () => {
    const { tenantId, actorId } = await seedTenant();
    const pipeline: PipelineDefinition = {
      id: 'map-compensating-pipeline',
      version: '1.0.0',
      entryStepId: 'book-resource',
      steps: {
        'book-resource': {
          ...STEP_COMMON,
          id: 'book-resource',
          compensatesWith: 'release-resource',
          kind: 'tool_call',
          toolName: 'book_resource',
          next: 'screen-all',
        },
        'release-resource': {
          ...STEP_COMMON,
          id: 'release-resource',
          kind: 'compensation',
          compensatesStepId: 'book-resource',
          agentId: null,
          toolName: 'release_resource',
        },
        'screen-all': {
          ...STEP_COMMON,
          id: 'screen-all',
          kind: 'map',
          itemStepId: 'screen-one',
          collectionField: 'learners',
          next: null,
        },
        'screen-one': {
          ...STEP_COMMON,
          id: 'screen-one',
          kind: 'agent_call',
          agentId: 'AC-01',
          next: null,
          maxRetries: 0,
        },
      },
    };

    const callOrder: string[] = [];

    const finished = await withTenant({ tenantId, actorId }, async (tx) => {
      const run = await startRun(
        tx,
        pipeline,
        { learners: ['L1'] },
        randomUUID(),
        actorId,
      );
      return runToCompletion(tx, pipeline, run.id, {
        executeStep: async (ctx) => {
          callOrder.push(ctx.stepId);
          if (ctx.stepId === 'screen-one') throw new Error('permanent failure on L1');
          return {};
        },
      });
    });

    expect(finished.status).toBe('COMPENSATED');
    expect(finished.succeededStepIds).toEqual(['book-resource']);
    expect(callOrder).toEqual(['book-resource', 'screen-one', 'release-resource']);
  });
});
