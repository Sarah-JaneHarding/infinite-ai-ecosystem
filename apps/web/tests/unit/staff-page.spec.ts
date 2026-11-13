import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security test (OQ-033 step 5): the staff overview is for an administrator only, and reads the school
// named by the verified session — never one named in the URL — or nothing at all.
const { getServerSession, redirect, withTenant, loadStaffOverview } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
  withTenant: vi.fn(),
  loadStaffOverview: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@infinite-ai/db', () => ({ withTenant, loadStaffOverview }));

import StaffPage from '../../src/app/(shell)/admin/staff/page.js';
import { loadStaff } from '../../src/lib/staff-loader.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const TX = { tx: true };
const OVERVIEW = {
  schools: [],
  idp: { pending: 0, failed: 0 },
  accounts: [
    {
      id: ACCOUNT,
      displayName: 'Ada Abrahams',
      email: 'ada@example.invalid',
      status: 'ACTIVE',
      lastSeenAt: null,
      roles: [{ role: 'admin', schoolId: null, expiresAt: null, expired: false }],
    },
  ],
  invitations: [],
  grantRequests: [],
  truncated: false,
};

describe('/admin/staff', () => {
  beforeEach(() => {
    for (const fn of [getServerSession, redirect, withTenant, loadStaffOverview])
      fn.mockClear();
    withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
    loadStaffOverview.mockResolvedValue(OVERVIEW);
  });

  it('sends nobody without a session to sign in, reading nothing', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(StaffPage()).rejects.toThrow('REDIRECT:/sign-in');
    expect(withTenant).not.toHaveBeenCalled();
  });

  it.each([
    'teacher',
    'hod',
    'smt',
    'sbst',
    'guardian',
    'learner',
    'platform_admin',
    null,
  ])('sends %s home, reading nothing', async (role) => {
    getServerSession.mockResolvedValue({ role, tenantId: TENANT, userId: ACCOUNT });
    await expect(StaffPage()).rejects.toThrow('REDIRECT:/');
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('reads the session’s own school, as the session’s own account', async () => {
    getServerSession.mockResolvedValue({
      role: 'admin',
      tenantId: TENANT,
      userId: ACCOUNT,
    });
    const html = renderToStaticMarkup(await StaffPage());
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(html).toContain('Ada Abrahams');
  });

  it('shows an empty overview, reading nothing, for a session with no tenant or no account', async () => {
    for (const session of [
      { role: 'admin', tenantId: '', userId: ACCOUNT },
      { role: 'admin', tenantId: TENANT, userId: '' },
    ]) {
      getServerSession.mockResolvedValue(session);
      const html = renderToStaticMarkup(await StaffPage());
      expect(html).toContain('No one has signed in yet');
    }
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('does not swallow a database fault into an empty page', async () => {
    withTenant.mockRejectedValue(new Error('db down'));
    await expect(loadStaff({ tenantId: TENANT, actorId: ACCOUNT })).rejects.toThrow(
      'db down',
    );
  });
});
