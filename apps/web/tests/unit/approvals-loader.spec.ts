import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rule 5: the only way this module reaches the database is `withTenant`, with exactly the
// tenant and actor it was given.
const { withTenant, listPendingApprovalTasks, getApprovalTask } = vi.hoisted(() => ({
  withTenant: vi.fn(),
  listPendingApprovalTasks: vi.fn(),
  getApprovalTask: vi.fn(),
}));

vi.mock('@infinite-ai/db', () => ({
  withTenant,
  listPendingApprovalTasks,
  getApprovalTask,
}));

import { loadApproval, loadApprovalQueue } from '../../src/lib/approvals-loader.js';

const SCOPE = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  actorId: '5b1a0000-0000-4000-8000-0000000000aa',
};
const RUN = '7e1a0000-0000-4000-8000-000000000001';
const TX = { tx: true };

function task(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    runId: RUN,
    stepId: 'gate',
    requiredRole: 'hod',
    artefact: 'draft',
    evidence: {},
    diffAgainstPrevious: null,
    decision: null,
    createdAt: new Date('2026-10-01T08:30:00.000Z'),
    ...over,
  };
}

describe('approvals loader', () => {
  beforeEach(() => {
    withTenant.mockReset();
    listPendingApprovalTasks.mockReset();
    getApprovalTask.mockReset();
    withTenant.mockImplementation((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn(TX),
    );
  });

  it('lists inside withTenant with exactly the scope given, filtered to the role', async () => {
    listPendingApprovalTasks.mockResolvedValue([
      task(),
      task({ id: 't2', requiredRole: 'smt' }),
    ]);

    const queue = await loadApprovalQueue(SCOPE, 'hod');

    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(withTenant).toHaveBeenCalledWith(SCOPE, expect.any(Function));
    expect(listPendingApprovalTasks).toHaveBeenCalledWith(TX);
    expect(queue.map((q) => q.id)).toEqual(['t1']);
  });

  it('reads one task inside withTenant and returns its view', async () => {
    getApprovalTask.mockResolvedValue(task());

    const view = await loadApproval(SCOPE, 'hod', 't1', RUN);

    expect(withTenant).toHaveBeenCalledWith(SCOPE, expect.any(Function));
    expect(getApprovalTask).toHaveBeenCalledWith(TX, 't1');
    expect(view?.artefact).toBe('draft');
  });

  it('returns null for a task the role may not see', async () => {
    getApprovalTask.mockResolvedValue(task({ requiredRole: 'smt' }));
    expect(await loadApproval(SCOPE, 'hod', 't1', RUN)).toBeNull();
  });

  it('returns null when the task does not exist in the tenant', async () => {
    getApprovalTask.mockResolvedValue(null);
    expect(await loadApproval(SCOPE, 'hod', 'nope', RUN)).toBeNull();
  });
});
