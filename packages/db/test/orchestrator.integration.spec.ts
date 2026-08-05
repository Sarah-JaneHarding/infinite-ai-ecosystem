// The DAG orchestrator's persistence primitives, against a real Postgres — Stage 06
// step 4.
//
// packages/orchestrator's own integration suite proves the runner end to end, through
// these functions; this file proves these functions directly and on their own terms — the
// full status vocabulary each outcome sets, the run/step relationship, and the unique
// constraint that makes retrying the same attempt twice a database error rather than a
// silent duplicate.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  OrchestratorPersistenceError,
  cancelRun,
  finishStepRun,
  getRun,
  listStepRuns,
  openRun,
  startStepRun,
  updateRunStatus,
} from '../src/orchestrator.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-08-05T09:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Orchestrator Test',
        slug: `orchestrator-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

describe('openRun / getRun', () => {
  it('opens a run at PENDING with no current step and an empty success list', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'ref-pipeline',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: { learnerId: 'L1' },
        createdBy: ACTOR,
      }),
    );

    expect(run.status).toBe('PENDING');
    expect(run.currentStepId).toBeNull();
    expect(run.succeededStepIds).toEqual([]);
    expect(run.input).toEqual({ learnerId: 'L1' });

    const fetched = await asTenant(appRw, TENANT, ACTOR, (tx) => getRun(tx, run.id));
    expect(fetched).toEqual(run);
  });

  it('returns null for a run that does not exist', async () => {
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) => getRun(tx, randomUUID()));
    expect(found).toBeNull();
  });
});

describe('startStepRun', () => {
  it('creates a RUNNING step attempt and moves a PENDING run to RUNNING', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    const stepRun = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      startStepRun(tx, run.id, 'step-1', 0, { x: 1 }, NOW),
    );

    expect(stepRun.status).toBe('RUNNING');
    expect(stepRun.attempt).toBe(0);
    expect(stepRun.startedAt).toEqual(NOW);

    const updatedRun = await asTenant(appRw, TENANT, ACTOR, (tx) => getRun(tx, run.id));
    expect(updatedRun?.status).toBe('RUNNING');
    expect(updatedRun?.currentStepId).toBe('step-1');
  });

  it('refuses a second attempt with the same (run, step, attempt) key', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      startStepRun(tx, run.id, 'step-1', 0, {}, NOW),
    );

    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        startStepRun(tx, run.id, 'step-1', 0, {}, NOW),
      ),
    ).rejects.toThrow();
  });

  it('throws for a run that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        startStepRun(tx, randomUUID(), 'step-1', 0, {}, NOW),
      ),
    ).rejects.toThrow(OrchestratorPersistenceError);
  });
});

describe('listStepRuns', () => {
  it('returns every attempt for a run, oldest first', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      await startStepRun(tx, run.id, 'step-1', 0, {}, NOW);
      await startStepRun(tx, run.id, 'step-2', 0, {}, NOW);
    });

    const stepRuns = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      listStepRuns(tx, run.id),
    );
    expect(stepRuns.map((s) => s.stepId)).toEqual(['step-1', 'step-2']);
  });
});

describe('finishStepRun', () => {
  async function openRunning() {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );
    const stepRun = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      startStepRun(tx, run.id, 'step-1', 0, {}, NOW),
    );
    return { run, stepRun };
  }

  it('records a SUCCEEDED outcome with its output', async () => {
    const { stepRun } = await openRunning();
    const finished = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      finishStepRun(tx, stepRun.id, { status: 'SUCCEEDED', output: { ok: true } }, NOW),
    );
    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.output).toEqual({ ok: true });
    expect(finished.completedAt).toEqual(NOW);
  });

  it('records a FAILED outcome with its error', async () => {
    const { stepRun } = await openRunning();
    const finished = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      finishStepRun(tx, stepRun.id, { status: 'FAILED', error: 'boom' }, NOW),
    );
    expect(finished.status).toBe('FAILED');
    expect(finished.error).toBe('boom');
  });

  it('records a RETRY_SCHEDULED outcome with its error and next attempt time', async () => {
    const { stepRun } = await openRunning();
    const nextAttemptAt = new Date(NOW.getTime() + 5_000);
    const finished = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      finishStepRun(
        tx,
        stepRun.id,
        { status: 'RETRY_SCHEDULED', nextAttemptAt, error: 'transient' },
        NOW,
      ),
    );
    expect(finished.status).toBe('RETRY_SCHEDULED');
    expect(finished.error).toBe('transient');
    expect(finished.nextAttemptAt).toEqual(nextAttemptAt);
  });

  it('records TIMED_OUT and CANCELLED outcomes', async () => {
    const { stepRun: timedOutStep } = await openRunning();
    const timedOut = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      finishStepRun(tx, timedOutStep.id, { status: 'TIMED_OUT' }, NOW),
    );
    expect(timedOut.status).toBe('TIMED_OUT');
    expect(timedOut.completedAt).toEqual(NOW);

    const { stepRun: cancelledStep } = await openRunning();
    const cancelled = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      finishStepRun(tx, cancelledStep.id, { status: 'CANCELLED' }, NOW),
    );
    expect(cancelled.status).toBe('CANCELLED');
  });
});

describe('updateRunStatus', () => {
  it('moves to RUNNING with a new current step and appends the succeeded step id', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    const updated = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      updateRunStatus(
        tx,
        run.id,
        { status: 'RUNNING', currentStepId: 'step-2' },
        NOW,
        'step-1',
      ),
    );

    expect(updated.status).toBe('RUNNING');
    expect(updated.currentStepId).toBe('step-2');
    expect(updated.succeededStepIds).toEqual(['step-1']);
  });

  it('moves to WAITING_FOR_APPROVAL, and later SUCCEEDED', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    const waiting = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      updateRunStatus(
        tx,
        run.id,
        { status: 'WAITING_FOR_APPROVAL', currentStepId: 'gate' },
        NOW,
      ),
    );
    expect(waiting.status).toBe('WAITING_FOR_APPROVAL');

    const succeeded = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      updateRunStatus(tx, run.id, { status: 'SUCCEEDED' }, NOW, 'gate'),
    );
    expect(succeeded.status).toBe('SUCCEEDED');
    expect(succeeded.succeededStepIds).toEqual(['gate']);
  });

  it('moves through COMPENSATING to COMPENSATED', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    const compensating = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      updateRunStatus(
        tx,
        run.id,
        { status: 'COMPENSATING', currentStepId: 'undo-1' },
        NOW,
      ),
    );
    expect(compensating.status).toBe('COMPENSATING');

    const compensated = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      updateRunStatus(tx, run.id, { status: 'COMPENSATED' }, NOW),
    );
    expect(compensated.status).toBe('COMPENSATED');
  });

  it('throws for a run that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        updateRunStatus(tx, randomUUID(), { status: 'FAILED' }, NOW),
      ),
    ).rejects.toThrow(OrchestratorPersistenceError);
  });
});

describe('cancelRun', () => {
  it('marks a run CANCELLED and records when', async () => {
    const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openRun(tx, {
        pipelineId: 'p',
        pipelineVersion: '1.0.0',
        traceId: randomUUID(),
        input: {},
      }),
    );

    const cancelled = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      cancelRun(tx, run.id, NOW),
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toEqual(NOW);
  });

  it('throws for a run that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) => cancelRun(tx, randomUUID(), NOW)),
    ).rejects.toThrow(OrchestratorPersistenceError);
  });
});
