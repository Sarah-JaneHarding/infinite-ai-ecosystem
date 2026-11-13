import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/admin/staff/idp/reconcile: the administrator's "try again". Same front door as every staff
// route: tenant and account from the verified token only, acting as `admin`.
const h = vi.hoisted(() => ({ getToken: vi.fn(), configured: vi.fn(), sync: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: h.getToken }));
vi.mock('../../src/lib/env', () => ({ getWebEnv: () => ({ NEXTAUTH_SECRET: 'x' }) }));
vi.mock('../../src/lib/idp/provider', () => ({
  isIdentityProviderConfigured: h.configured,
}));
vi.mock('../../src/lib/idp/sync', () => ({ syncIdentityProvider: h.sync }));

import { POST } from '../../src/app/api/admin/staff/idp/reconcile/route.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const ADMIN = { sub: 'sub-1', tenantId: TENANT, userId: ACCOUNT, role: 'admin' };
const call = () =>
  POST(
    new NextRequest('http://localhost/api/admin/staff/idp/reconcile', { method: 'POST' }),
  );

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
  h.getToken.mockResolvedValue(ADMIN);
  h.configured.mockReturnValue(true);
  h.sync.mockResolvedValue({ synced: 3, failed: 1 });
});

describe('POST /api/admin/staff/idp/reconcile', () => {
  it('reconciles the caller’s own school and reports the counts', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: 3, failed: 1 });
    expect(h.sync).toHaveBeenCalledWith({ tenantId: TENANT, actorId: ACCOUNT });
  });

  it('refuses a caller with no session', async () => {
    h.getToken.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(h.sync).not.toHaveBeenCalled();
  });

  it.each(['teacher', 'smt', 'sbst', 'platform_admin'])(
    'refuses a session acting as %s',
    async (role) => {
      h.getToken.mockResolvedValue({ ...ADMIN, role });
      expect((await call()).status).toBe(403);
      expect(h.sync).not.toHaveBeenCalled();
    },
  );

  it('answers 409, in words, when no identity provider is connected', async () => {
    h.configured.mockReturnValue(false);
    const response = await call();
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).toContain('not connected');
    expect(h.sync).not.toHaveBeenCalled();
  });

  it('answers 503 when the records could not be read, instead of reporting success', async () => {
    h.sync.mockResolvedValue(null);
    expect((await call()).status).toBe(503);
  });
});
