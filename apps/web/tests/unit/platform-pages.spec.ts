import { describe, it, expect, vi, beforeEach } from 'vitest';

// Security test: the platform pages are for platform staff only. Neither reads tenant data,
// so the checks are who may see them (rule 5's neighbour: no role reaches a page it was not
// given).
const { getServerSession, redirect } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/components/platform/RunInspector', () => ({ RunInspector: () => null }));

import RunsPage from '../../src/app/(shell)/platform/runs/page.js';

describe('/platform/runs', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
  });

  it.each(['platform_support', 'platform_admin'])('renders for %s', async (role) => {
    getServerSession.mockResolvedValue({ role });
    await expect(RunsPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an unauthenticated caller to sign in', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(RunsPage()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it.each(['teacher', 'hod', 'smt', 'sbst', 'admin', 'guardian', 'learner'])(
    'sends %s home',
    async (role) => {
      getServerSession.mockResolvedValue({ role });
      await expect(RunsPage()).rejects.toThrow('REDIRECT:/');
    },
  );
});
