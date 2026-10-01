import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// Security test: the SMT dashboard reads tenant data. Tenant and actor must come from the
// verified session — never the URL — and nothing may be read for an unauthenticated caller,
// another role, or a session with no tenant context (rule 5).
const { getServerSession, redirect, loadApprovalQueue } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
  loadApprovalQueue: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/approvals-loader', () => ({ loadApprovalQueue }));
vi.mock('@/components/smt/SmdDashboard', () => ({ SmdDashboard: () => null }));

import SmtPage from '../../src/app/(shell)/smt/page.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const USER = '5b1a0000-0000-4000-8000-0000000000aa';
const smt = { role: 'smt', tenantId: TENANT, userId: USER };

const render = async () =>
  (await SmtPage()) as ReactElement<{ pendingApprovals: number | null }>;

describe('/smt', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    loadApprovalQueue.mockReset();
    loadApprovalQueue.mockResolvedValue([{}, {}, {}]);
  });

  it("counts the school's approvals waiting on the smt role, from the session scope", async () => {
    getServerSession.mockResolvedValue(smt);
    const element = await render();
    expect(loadApprovalQueue).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      'smt',
    );
    expect(element.props.pendingApprovals).toBe(3);
  });

  it('passes zero through as zero', async () => {
    getServerSession.mockResolvedValue(smt);
    loadApprovalQueue.mockResolvedValue([]);
    expect((await render()).props.pendingApprovals).toBe(0);
  });

  it('sends an unauthenticated caller to sign in, without a read', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadApprovalQueue).not.toHaveBeenCalled();
  });

  it.each(['teacher', 'hod', 'admin', 'platform_admin'])(
    'sends %s home without a read',
    async (role) => {
      getServerSession.mockResolvedValue({ ...smt, role });
      await expect(render()).rejects.toThrow('REDIRECT:/');
      expect(loadApprovalQueue).not.toHaveBeenCalled();
    },
  );

  it.each([
    { tenantId: '', userId: USER },
    { tenantId: TENANT, userId: '' },
  ])(
    'reports the count as unavailable (null), not zero, without both ids: %j',
    async (ids) => {
      getServerSession.mockResolvedValue({ ...smt, ...ids });
      expect((await render()).props.pendingApprovals).toBeNull();
      expect(loadApprovalQueue).not.toHaveBeenCalled();
    },
  );
});
