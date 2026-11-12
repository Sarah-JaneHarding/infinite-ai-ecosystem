// Security test (OQ-032, PROVISIONING_DESIGN §4.8 item 5): a gate is decided *as* its own role.
// A person holding several roles must be signed in as the gate's role; holding it is not enough.
// The database is stubbed — what is under test is the order and the equality of the checks; the
// real assignment query is proven in runner.integration.spec.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  getRun: vi.fn(),
  getApprovalTaskForStep: vi.fn(),
  hasActiveRoleAssignment: vi.fn(),
  decideApprovalTask: vi.fn(),
  appendAuditEvent: vi.fn(),
}));
vi.mock('@infinite-ai/db', async (importOriginal) => ({
  ...(await importOriginal<typeof DbModule>()),
  ...db,
}));

import type * as DbModule from '@infinite-ai/db';
import type { TenantClient } from '@infinite-ai/db';

import { decideHumanGate, OrchestratorRunnerError } from '../src/runner.js';

const TX = {} as TenantClient;
const ACTOR = '5b1a0000-0000-4000-8000-0000000000aa';
const NOW = new Date('2026-11-12T08:00:00.000Z');
const base = { outcome: 'APPROVED', decidedBy: ACTOR, reason: 'Looks right.' } as const;

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.getRun.mockResolvedValue({
    id: 'r1',
    status: 'WAITING_FOR_APPROVAL',
    currentStepId: 'gate',
    traceId: 't',
  });
  db.getApprovalTaskForStep.mockResolvedValue({
    id: 'task1',
    stepId: 'gate',
    requiredRole: 'hod',
    decision: null,
  });
  db.hasActiveRoleAssignment.mockResolvedValue(true);
  db.decideApprovalTask.mockResolvedValue({ id: 'task1', decision: 'APPROVED' });
});

describe('decideHumanGate — acting as the gate’s own role', () => {
  it('records the decision when acting as the required role and holding it', async () => {
    await decideHumanGate(TX, 'r1', { ...base, actingAs: 'hod' }, NOW);
    expect(db.hasActiveRoleAssignment).toHaveBeenCalledWith(TX, ACTOR, 'hod', NOW);
    expect(db.decideApprovalTask).toHaveBeenCalledTimes(1);
  });

  it('refuses a person who holds the role but is acting as another — and records nothing', async () => {
    // The account holds `hod` (the stub says so) but is signed in as `smt`.
    await expect(
      decideHumanGate(TX, 'r1', { ...base, actingAs: 'smt' }, NOW),
    ).rejects.toThrow(/acting as "smt".*decided by "hod".*Sign in acting as that role/);
    expect(db.decideApprovalTask).not.toHaveBeenCalled();
    expect(db.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('still refuses when acting as the right role but the assignment is gone (revoked mid-session)', async () => {
    db.hasActiveRoleAssignment.mockResolvedValue(false);
    await expect(
      decideHumanGate(TX, 'r1', { ...base, actingAs: 'hod' }, NOW),
    ).rejects.toThrow(/does not hold the required role "hod"/);
    expect(db.decideApprovalTask).not.toHaveBeenCalled();
    expect(db.appendAuditEvent).not.toHaveBeenCalled();
  });

  it.each(['admin', 'teacher', 'platform_admin', 'HOD', ' hod', 'hod ', 'hods'])(
    'is equality, not hierarchy or lookalikes: acting as %j does not decide a hod gate',
    async (actingAs) => {
      await expect(decideHumanGate(TX, 'r1', { ...base, actingAs }, NOW)).rejects.toThrow(
        OrchestratorRunnerError,
      );
      expect(db.decideApprovalTask).not.toHaveBeenCalled();
    },
  );

  it('does not consult the assignment for a role the person is not acting as', async () => {
    await expect(
      decideHumanGate(TX, 'r1', { ...base, actingAs: 'smt' }, NOW),
    ).rejects.toThrow(OrchestratorRunnerError);
    expect(db.hasActiveRoleAssignment).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a string', 7],
  ])(
    'refuses a decision whose actingAs is %s, before reading anything',
    async (_n, actingAs) => {
      await expect(
        decideHumanGate(TX, 'r1', { ...base, actingAs } as never, NOW),
      ).rejects.toThrow(/Invalid human gate decision/);
      expect(db.getRun).not.toHaveBeenCalled();
    },
  );

  it('records which role the decision was made as, in the audit event', async () => {
    await decideHumanGate(TX, 'r1', { ...base, actingAs: 'hod' }, NOW);
    expect(db.appendAuditEvent).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        action: 'human_gate_decided',
        diff: expect.objectContaining({ actingAs: 'hod', decision: 'APPROVED' }),
      }),
    );
  });
});
