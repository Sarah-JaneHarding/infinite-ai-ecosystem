import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// Security test: approvals are a human-in-the-loop gate (rule 6) read per tenant (rule 5).
// The tenant and actor must come from the verified session — never the URL — nothing may be
// read for an unauthenticated caller, a role with no queue, or a session without tenant
// context, and the detail page must show only what the gate actually holds.
const { getServerSession, redirect, notFound, loadApprovalQueue, loadApproval } =
  vi.hoisted(() => ({
    getServerSession: vi.fn(),
    redirect: vi.fn((to: string): never => {
      throw new Error(`REDIRECT:${to}`);
    }),
    notFound: vi.fn((): never => {
      throw new Error('NOT_FOUND');
    }),
    loadApprovalQueue: vi.fn(),
    loadApproval: vi.fn(),
  }));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/approvals-loader', () => ({ loadApprovalQueue, loadApproval }));
vi.mock('@/components/approval/ApprovalQueue', () => ({ ApprovalQueue: () => null }));
vi.mock('@/components/approval/ApprovalDetail', () => ({ ApprovalDetail: () => null }));

import ApprovalsPage from '../../src/app/(shell)/approvals/page.js';
import ApprovalPage from '../../src/app/(shell)/approvals/[id]/page.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const USER = '5b1a0000-0000-4000-8000-0000000000aa';
const RUN = '7e1a0000-0000-4000-8000-000000000001';
const hod = { role: 'hod', tenantId: TENANT, userId: USER };

describe('/approvals', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    loadApprovalQueue.mockReset();
    loadApprovalQueue.mockResolvedValue([]);
  });

  it('reads the queue for the session tenant, actor and role', async () => {
    getServerSession.mockResolvedValue(hod);
    const element = (await ApprovalsPage()) as ReactElement<{ role: string }>;
    expect(loadApprovalQueue).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      'hod',
    );
    expect(element.props.role).toBe('hod');
  });

  it('sends an unauthenticated caller to sign in, without a read', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(ApprovalsPage()).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadApprovalQueue).not.toHaveBeenCalled();
  });

  it.each(['learner', 'guardian', 'platform_admin', 'platform_support'])(
    'sends %s home without a read — no human gate waits on that role',
    async (role) => {
      getServerSession.mockResolvedValue({ ...hod, role });
      await expect(ApprovalsPage()).rejects.toThrow('REDIRECT:/');
      expect(loadApprovalQueue).not.toHaveBeenCalled();
    },
  );

  it.each([
    { tenantId: '', userId: USER },
    { tenantId: TENANT, userId: '' },
  ])('shows an empty queue and reads nothing without both ids: %j', async (ids) => {
    getServerSession.mockResolvedValue({ ...hod, ...ids });
    const element = (await ApprovalsPage()) as ReactElement<{ items: unknown[] }>;
    expect(loadApprovalQueue).not.toHaveBeenCalled();
    expect(element.props.items).toEqual([]);
  });
});

describe('/approvals/[id]', () => {
  const render = (
    sp: Record<string, string | string[] | undefined> = { runId: RUN },
    id = 'task-1',
  ) =>
    ApprovalPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(sp),
    }) as Promise<ReactElement<{ approval: unknown }>>;

  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    notFound.mockClear();
    loadApproval.mockReset();
  });

  it('shows the stored approval, read with the session scope, role, task and run', async () => {
    const approval = { id: 'task-1', artefact: 'the real draft' };
    getServerSession.mockResolvedValue(hod);
    loadApproval.mockResolvedValue(approval);

    const element = await render();

    expect(loadApproval).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      'hod',
      'task-1',
      RUN,
    );
    expect(element.props.approval).toBe(approval);
  });

  it('is not found when the gate holds nothing for this role and run', async () => {
    getServerSession.mockResolvedValue(hod);
    loadApproval.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('NOT_FOUND');
  });

  it('is not found without a run id, and reads nothing', async () => {
    getServerSession.mockResolvedValue(hod);
    await expect(render({})).rejects.toThrow('NOT_FOUND');
    await expect(render({ runId: ['a', 'b'] })).rejects.toThrow('NOT_FOUND');
    expect(loadApproval).not.toHaveBeenCalled();
  });

  it('sends an unauthenticated caller to sign in, without a read', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadApproval).not.toHaveBeenCalled();
  });

  it.each([
    { tenantId: '', userId: USER },
    { tenantId: TENANT, userId: '' },
  ])('is not found and reads nothing without both ids: %j', async (ids) => {
    getServerSession.mockResolvedValue({ ...hod, ...ids });
    await expect(render()).rejects.toThrow('NOT_FOUND');
    expect(loadApproval).not.toHaveBeenCalled();
  });

  it('never takes the tenant or actor from the query string', async () => {
    getServerSession.mockResolvedValue(hod);
    loadApproval.mockResolvedValue({});
    await render({
      runId: RUN,
      tenantId: '20000000-0000-4000-8000-000000000002',
      actorId: '00000000-0000-4000-8000-00000000dead',
    });
    expect(loadApproval).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      'hod',
      'task-1',
      RUN,
    );
  });
});
