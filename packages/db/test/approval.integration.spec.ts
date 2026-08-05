// The `human_gate` approval task's persistence primitives, against a real Postgres —
// Stage 06 step 5.
//
// `packages/orchestrator`'s own integration suite proves the runner's decisions end to
// end, through these functions; this file proves these functions directly and on their own
// terms — the full field set an opened task carries, the "decided once" guard, and
// `hasActiveRoleAssignment`'s own active/expired boundary.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ApprovalPersistenceError,
  decideApprovalTask,
  getApprovalTask,
  getApprovalTaskForStep,
  hasActiveRoleAssignment,
  openApprovalTask,
  openRun,
} from '../src/index.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;

const TENANT = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-08-05T21:00:00.000Z');

beforeAll(async () => {
  db = await startTestDatabase();
  appRw = db.clientFor('app_rw');
  const migrator = db.clientFor('migrator');
  await asTenant(migrator, TENANT, ACTOR, (tx) =>
    tx.tenant.create({
      data: {
        id: TENANT,
        name: 'Approval Test',
        slug: `approval-${TENANT.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

async function openTestRun(): Promise<string> {
  const run = await asTenant(appRw, TENANT, ACTOR, (tx) =>
    openRun(tx, {
      pipelineId: 'p',
      pipelineVersion: '1.0.0',
      traceId: randomUUID(),
      input: {},
    }),
  );
  return run.id;
}

describe('openApprovalTask / getApprovalTask / getApprovalTaskForStep', () => {
  it('opens a task pending, with the artefact, evidence, diff and required role supplied', async () => {
    const runId = await openTestRun();
    const traceId = randomUUID();

    const task = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openApprovalTask(tx, {
        runId,
        stepId: 'gate',
        requiredRole: 'hod',
        artefact: { draft: 'v1' },
        evidence: { source: 'CE-01' },
        diffAgainstPrevious: { added: ['x'] },
        traceId,
      }),
    );

    expect(task.decision).toBeNull();
    expect(task.decidedBy).toBeNull();
    expect(task.requiredRole).toBe('hod');
    expect(task.artefact).toEqual({ draft: 'v1' });
    expect(task.evidence).toEqual({ source: 'CE-01' });
    expect(task.diffAgainstPrevious).toEqual({ added: ['x'] });
    expect(task.traceId).toBe(traceId);

    const fetched = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getApprovalTask(tx, task.id),
    );
    expect(fetched).toEqual(task);

    const byStep = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getApprovalTaskForStep(tx, runId, 'gate'),
    );
    expect(byStep).toEqual(task);
  });

  it('defaults diffAgainstPrevious to null when there is nothing to diff against', async () => {
    const runId = await openTestRun();
    const task = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openApprovalTask(tx, {
        runId,
        stepId: 'gate',
        requiredRole: 'hod',
        artefact: {},
        evidence: {},
        traceId: randomUUID(),
      }),
    );
    expect(task.diffAgainstPrevious).toBeNull();
  });

  it('refuses a second task for the same (run, step)', async () => {
    const runId = await openTestRun();
    const open = () =>
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        openApprovalTask(tx, {
          runId,
          stepId: 'gate',
          requiredRole: 'hod',
          artefact: {},
          evidence: {},
          traceId: randomUUID(),
        }),
      );
    await open();
    await expect(open()).rejects.toThrow();
  });

  it('throws for a run that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        openApprovalTask(tx, {
          runId: randomUUID(),
          stepId: 'gate',
          requiredRole: 'hod',
          artefact: {},
          evidence: {},
          traceId: randomUUID(),
        }),
      ),
    ).rejects.toThrow(ApprovalPersistenceError);
  });

  it('returns null for a task that has not been opened', async () => {
    const runId = await openTestRun();
    const found = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      getApprovalTaskForStep(tx, runId, 'gate'),
    );
    expect(found).toBeNull();
  });
});

describe('decideApprovalTask', () => {
  async function openTestTask(): Promise<string> {
    const runId = await openTestRun();
    const task = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      openApprovalTask(tx, {
        runId,
        stepId: 'gate',
        requiredRole: 'hod',
        artefact: {},
        evidence: {},
        traceId: randomUUID(),
      }),
    );
    return task.id;
  }

  it('records an APPROVED decision', async () => {
    const taskId = await openTestTask();
    const decidedBy = randomUUID();
    const decided = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      decideApprovalTask(
        tx,
        taskId,
        { outcome: 'APPROVED', decidedBy, reason: 'Looks correct.' },
        NOW,
      ),
    );
    expect(decided.decision).toBe('APPROVED');
    expect(decided.decidedBy).toBe(decidedBy);
    expect(decided.decidedAt).toEqual(NOW);
    expect(decided.reason).toBe('Looks correct.');
    expect(decided.editDiff).toBeNull();
  });

  it('records a REJECTED decision', async () => {
    const taskId = await openTestTask();
    const decided = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      decideApprovalTask(
        tx,
        taskId,
        { outcome: 'REJECTED', decidedBy: randomUUID(), reason: 'Not ready.' },
        NOW,
      ),
    );
    expect(decided.decision).toBe('REJECTED');
  });

  it('records an EDITED decision with its edit diff', async () => {
    const taskId = await openTestTask();
    const decided = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      decideApprovalTask(
        tx,
        taskId,
        {
          outcome: 'EDITED',
          decidedBy: randomUUID(),
          reason: 'Fixed the wording.',
          editDiff: { before: 'a', after: 'b' },
        },
        NOW,
      ),
    );
    expect(decided.decision).toBe('EDITED');
    expect(decided.editDiff).toEqual({ before: 'a', after: 'b' });
  });

  it('refuses a second decision on an already-decided task', async () => {
    const taskId = await openTestTask();
    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      decideApprovalTask(
        tx,
        taskId,
        { outcome: 'APPROVED', decidedBy: randomUUID(), reason: 'First.' },
        NOW,
      ),
    );
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        decideApprovalTask(
          tx,
          taskId,
          { outcome: 'REJECTED', decidedBy: randomUUID(), reason: 'Second.' },
          NOW,
        ),
      ),
    ).rejects.toThrow(ApprovalPersistenceError);
  });

  it('throws for a task that does not exist', async () => {
    await expect(
      asTenant(appRw, TENANT, ACTOR, (tx) =>
        decideApprovalTask(
          tx,
          randomUUID(),
          { outcome: 'APPROVED', decidedBy: randomUUID(), reason: 'x' },
          NOW,
        ),
      ),
    ).rejects.toThrow(ApprovalPersistenceError);
  });
});

describe('hasActiveRoleAssignment', () => {
  it('is true for an unexpired role assignment', async () => {
    const userId = randomUUID();
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      await tx.userAccount.create({
        data: {
          id: userId,
          tenantId: TENANT,
          subject: `oidc-${userId}`,
          email: `${userId}@example.test`,
          displayName: 'Test HOD',
        },
      });
      await tx.roleAssignment.create({
        data: { tenantId: TENANT, userAccountId: userId, role: 'hod' },
      });
    });

    const held = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      hasActiveRoleAssignment(tx, userId, 'hod', NOW),
    );
    expect(held).toBe(true);
  });

  it('is false for a role the actor never held', async () => {
    const userId = randomUUID();
    await asTenant(appRw, TENANT, ACTOR, (tx) =>
      tx.userAccount.create({
        data: {
          id: userId,
          tenantId: TENANT,
          subject: `oidc-${userId}`,
          email: `${userId}@example.test`,
          displayName: 'Test Teacher',
        },
      }),
    );
    const held = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      hasActiveRoleAssignment(tx, userId, 'hod', NOW),
    );
    expect(held).toBe(false);
  });

  it('is false once the assignment has expired', async () => {
    const userId = randomUUID();
    await asTenant(appRw, TENANT, ACTOR, async (tx) => {
      await tx.userAccount.create({
        data: {
          id: userId,
          tenantId: TENANT,
          subject: `oidc-${userId}`,
          email: `${userId}@example.test`,
          displayName: 'Test HOD',
        },
      });
      await tx.roleAssignment.create({
        data: {
          tenantId: TENANT,
          userAccountId: userId,
          role: 'hod',
          expiresAt: new Date(NOW.getTime() - 1_000),
        },
      });
    });

    const held = await asTenant(appRw, TENANT, ACTOR, (tx) =>
      hasActiveRoleAssignment(tx, userId, 'hod', NOW),
    );
    expect(held).toBe(false);
  });
});
