import { describe, it, expect, vi, beforeEach } from 'vitest';

// Security test: the SBST casebook is for the SBST role only. It holds the support pathway for
// learners, which no other school role is given.
const { getServerSession, redirect } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/components/sbst/SbstCasebook', () => ({ SbstCasebook: () => null }));

import SbstPage from '../../src/app/(shell)/sbst/page.js';

describe('/sbst', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
  });

  it('renders for sbst', async () => {
    getServerSession.mockResolvedValue({ role: 'sbst' });
    await expect(SbstPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an unauthenticated caller to sign in', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(SbstPage()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it.each([
    'teacher',
    'hod',
    'smt',
    'admin',
    'guardian',
    'learner',
    'platform_support',
    'platform_admin',
  ])('sends %s home', async (role) => {
    getServerSession.mockResolvedValue({ role });
    await expect(SbstPage()).rejects.toThrow('REDIRECT:/');
  });
});
