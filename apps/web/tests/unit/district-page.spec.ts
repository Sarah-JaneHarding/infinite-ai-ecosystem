import { describe, it, expect, vi, beforeEach } from 'vitest';

// Security test: /district is for platform staff only (it has no nav link, so the page check
// is the only thing besides the central route rule that keeps other roles out).
const { getServerSession, redirect } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/components/district/DistrictRollup', () => ({ DistrictRollup: () => null }));

import DistrictPage from '../../src/app/(shell)/district/page.js';

describe('/district', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
  });

  it.each(['platform_support', 'platform_admin'])('renders for %s', async (role) => {
    getServerSession.mockResolvedValue({ role });
    await expect(DistrictPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an unauthenticated caller to sign in', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(DistrictPage()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it.each(['teacher', 'hod', 'smt', 'sbst', 'admin', 'guardian', 'learner'])(
    'sends %s home',
    async (role) => {
      getServerSession.mockResolvedValue({ role });
      await expect(DistrictPage()).rejects.toThrow('REDIRECT:/');
    },
  );
});
