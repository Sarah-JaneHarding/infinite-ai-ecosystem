import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// Security test: the HoD console reads tenant data. Tenant and actor must come from the
// verified session — never the URL — and nothing may be read for an unauthenticated caller,
// another role, or a session without tenant context (rule 5).
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
vi.mock('@/components/hod/HodConsole', () => ({ HodConsole: () => null }));

import HodPage from '../../src/app/(shell)/hod/page.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const USER = '5b1a0000-0000-4000-8000-0000000000aa';
const hod = { role: 'hod', tenantId: TENANT, userId: USER };
const QUEUE = [{ id: 'a' }, { id: 'b' }];

const render = async () => (await HodPage()) as ReactElement<{ pending: unknown }>;

describe('/hod', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    loadApprovalQueue.mockReset();
    loadApprovalQueue.mockResolvedValue(QUEUE);
  });

  it("passes the school's approvals waiting on the hod role, read with the session scope", async () => {
    getServerSession.mockResolvedValue(hod);
    const element = await render();
    expect(loadApprovalQueue).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      'hod',
    );
    expect(element.props.pending).toBe(QUEUE);
  });

  it('passes an empty queue through as empty', async () => {
    getServerSession.mockResolvedValue(hod);
    loadApprovalQueue.mockResolvedValue([]);
    expect((await render()).props.pending).toEqual([]);
  });

  it('sends an unauthenticated caller to sign in, without a read', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadApprovalQueue).not.toHaveBeenCalled();
  });

  it.each(['teacher', 'smt', 'admin', 'platform_admin'])(
    'sends %s home without a read',
    async (role) => {
      getServerSession.mockResolvedValue({ ...hod, role });
      await expect(render()).rejects.toThrow('REDIRECT:/');
      expect(loadApprovalQueue).not.toHaveBeenCalled();
    },
  );

  it.each([
    { tenantId: '', userId: USER },
    { tenantId: TENANT, userId: '' },
  ])(
    'reports the list as unavailable (null), not empty, without both ids: %j',
    async (ids) => {
      getServerSession.mockResolvedValue({ ...hod, ...ids });
      expect((await render()).props.pending).toBeNull();
      expect(loadApprovalQueue).not.toHaveBeenCalled();
    },
  );
});
