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
  getApprovalTaskForStep,
  startStepRun,
  withTenant,
} from '@infinite-ai/db';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createTracer } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PipelineDagError, type PipelineDefinition } from '../src/dag.js';
import {
  OrchestratorRunnerError,
  advanceRun,
  cancelRun,
  decideHumanGate,
  runToCompletion,
  startRun,
  type ApprovalMaterialProvider,
  type StepExecutionContext,
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

      return runToCompletion(
        tx,
        pipeline,
        run.id,
        { executeStep: async () => ({ recovered: true }) },
        muchLater,
      );
    });

    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.succeededStepIds).toEqual(['slow']);
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
