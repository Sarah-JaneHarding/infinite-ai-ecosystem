// The DAG runner proven end to end, against a real Postgres — Stage 06 step 4.
//
// The pure pieces (dag.spec.ts, run-state-machine.spec.ts) already prove the DAG
// validation and the retry/timeout/next-step/compensation decisions in isolation; this is
// what proves the wiring actually works: a run persists through every step, resumes
// correctly after a "crash" (a fresh read, not state held in memory), retries with a real
// scheduled delay, times out a stale attempt, compensates in reverse order on an
// exhausted failure, pauses at a human gate, and carries one trace ID throughout.

import { randomUUID } from 'node:crypto';

import { disconnect, startStepRun, withTenant } from '@infinite-ai/db';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createTracer } from '@infinite-ai/telemetry';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PipelineDefinition } from '../src/dag.js';
import {
  advanceRun,
  cancelRun,
  runToCompletion,
  startRun,
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

const STEP_COMMON = { timeoutMs: 10_000, maxRetries: 2, compensatesWith: null };

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
      });
      const second = await runToCompletion(tx, pipeline, run.id, {
        executeStep: async () => {
          calls += 1;
          return {};
        },
      });
      return { first, second };
    });

    expect(result.first.status).toBe('WAITING_FOR_APPROVAL');
    expect(result.first.currentStepId).toBe('gate');
    expect(result.second.status).toBe('WAITING_FOR_APPROVAL');
    expect(calls).toBe(1); // only step-1 ran; the gate itself never calls the executor
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
