import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security test (OQ-033 step 5, slice b): inviting and revoking are administrator acts. The tenant and
// actor come from the verified token alone; the request cannot widen them; a person acting as any
// role but `admin` — or with no active role — does nothing; the rules, not the route, decide who may
// confer what, and a refusal is answered without echoing an address.
const { getToken, withTenant, createInvitation, revokeInvitation } = vi.hoisted(() => ({
  getToken: vi.fn(),
  withTenant: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({ getToken }));
vi.mock('@infinite-ai/db', () => ({
  withTenant,
  createInvitation,
  revokeInvitation,
  defaultInvitationExpiry: (now: Date) => new Date(now.getTime() + 14 * 86_400_000),
}));
vi.mock('../../src/lib/env', () => ({ getWebEnv: () => ({ NEXTAUTH_SECRET: 'x' }) }));

import { POST as invite } from '../../src/app/api/admin/staff/invitations/route.js';
import { POST as revoke } from '../../src/app/api/admin/staff/invitations/[id]/revoke/route.js';
import { provisioningRules } from '../../src/lib/provisioning-rules.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const INVITATION = '5b1a0000-0000-4000-8000-0000000000aa';
const TX = { tx: true };
const ADMIN = { sub: 'sub-1', tenantId: TENANT, userId: ACCOUNT, role: 'admin' };

function inviteRequest(body: unknown, contentType: string | null = 'application/json') {
  return new NextRequest('http://localhost/api/admin/staff/invitations', {
    method: 'POST',
    headers: contentType === null ? {} : { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const revokeRequest = (id = INVITATION) =>
  revoke(
    new NextRequest(`http://localhost/api/admin/staff/invitations/${id}/revoke`, {
      method: 'POST',
    }),
    {
      params: Promise.resolve({ id }),
    },
  );
const VALID = { email: 'new@example.invalid', roles: ['teacher', 'hod'] };

beforeEach(() => {
  for (const fn of [getToken, withTenant, createInvitation, revokeInvitation])
    fn.mockReset();
  withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
  createInvitation.mockResolvedValue({
    ok: true,
    invitationId: INVITATION,
    confirmation: 'NOT_REQUIRED',
  });
  revokeInvitation.mockResolvedValue({ ok: true });
});

describe('POST /api/admin/staff/invitations', () => {
  it('invites as the session’s own account, in its own school, with the rules bound', async () => {
    getToken.mockResolvedValue(ADMIN);
    const response = await invite(inviteRequest(VALID));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      invitationId: INVITATION,
      confirmation: 'NOT_REQUIRED',
    });
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(createInvitation).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({
        actorAccountId: ACCOUNT,
        email: 'new@example.invalid',
        roles: ['teacher', 'hod'],
      }),
    );
    const input = createInvitation.mock.calls[0]?.[2] as { expiresAt: Date; now: Date };
    expect(input.expiresAt.getTime()).toBeGreaterThan(input.now.getTime());
  });

  it('tells the person when a second administrator must confirm', async () => {
    getToken.mockResolvedValue(ADMIN);
    createInvitation.mockResolvedValue({
      ok: true,
      invitationId: INVITATION,
      confirmation: 'AWAITING',
    });
    const response = await invite(inviteRequest({ ...VALID, roles: ['admin'] }));
    expect((await response.json()).confirmation).toBe('AWAITING');
  });

  it('is unauthenticated without a token, and does nothing', async () => {
    getToken.mockResolvedValue(null);
    expect((await invite(inviteRequest(VALID))).status).toBe(401);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it.each([
    ['no tenant', { ...ADMIN, tenantId: '' }],
    ['no account', { ...ADMIN, userId: '' }],
    ['only the provider subject', { sub: 'sub-1', tenantId: TENANT, role: 'admin' }],
  ])('does nothing for a session with %s', async (_name, token) => {
    getToken.mockResolvedValue(token);
    expect([401, 403]).toContain((await invite(inviteRequest(VALID))).status);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it.each([
    'teacher',
    'hod',
    'smt',
    'sbst',
    'sbst_chair',
    'guardian',
    'learner',
    'platform_admin',
  ])('does nothing for a session acting as %s', async (role) => {
    getToken.mockResolvedValue({ ...ADMIN, role });
    expect((await invite(inviteRequest(VALID))).status).toBe(403);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it.each([
    ['no role (has not chosen one yet)', {}],
    ['an unknown role', { role: 'superuser' }],
  ])('does nothing for a session with %s', async (_name, extra) => {
    getToken.mockResolvedValue({
      sub: 'sub-1',
      tenantId: TENANT,
      userId: ACCOUNT,
      ...extra,
    });
    expect((await invite(inviteRequest(VALID))).status).toBe(403);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON-typed, before reading it', async () => {
    getToken.mockResolvedValue(ADMIN);
    expect(
      (
        await invite(
          inviteRequest('email=a@b.c&roles=teacher', 'application/x-www-form-urlencoded'),
        )
      ).status,
    ).toBe(415);
    expect((await invite(inviteRequest(JSON.stringify(VALID), null))).status).toBe(415);
    expect(
      (await invite(inviteRequest(JSON.stringify(VALID), 'text/plain'))).status,
    ).toBe(415);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON and a body that breaks the contract, naming fields not values', async () => {
    getToken.mockResolvedValue(ADMIN);
    expect((await invite(inviteRequest('{not json'))).status).toBe(400);
    const response = await invite(
      inviteRequest({ email: 'a@example.invalid', roles: ['platform_admin'] }),
    );
    expect(response.status).toBe(400);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('platform_admin');
    expect(text).not.toContain('a@example.invalid');
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it.each(['tenantId', 'actorId', 'actorAccountId'])(
    'ignores nothing: a body naming %s is refused outright',
    async (key) => {
      getToken.mockResolvedValue(ADMIN);
      expect(
        (
          await invite(
            inviteRequest({ ...VALID, [key]: '99999999-9999-4999-8999-999999999999' }),
          )
        ).status,
      ).toBe(400);
      expect(createInvitation).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['actor_not_admin', 403],
    ['role_not_assignable', 422],
    ['invalid_email', 422],
    ['email_in_use', 409],
    ['pending_invitation_exists', 409],
    ['cannot_change_own_roles', 403],
  ])('answers the refusal %s with %i and no address', async (reason, status) => {
    getToken.mockResolvedValue(ADMIN);
    createInvitation.mockResolvedValue({ ok: false, reason });
    const response = await invite(inviteRequest(VALID));
    expect(response.status).toBe(status);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('new@example.invalid');
    expect(text).not.toContain(reason);
  });

  it('does not swallow a database fault', async () => {
    getToken.mockResolvedValue(ADMIN);
    createInvitation.mockRejectedValue(new Error('db down'));
    await expect(invite(inviteRequest(VALID))).rejects.toThrow('db down');
  });
});

describe('POST /api/admin/staff/invitations/[id]/revoke', () => {
  it('revokes as the session’s own account, in its own school', async () => {
    getToken.mockResolvedValue(ADMIN);
    const response = await revokeRequest();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(revokeInvitation).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ actorAccountId: ACCOUNT, invitationId: INVITATION }),
    );
  });

  it('does nothing without a session, without an account, or acting as anyone but admin', async () => {
    getToken.mockResolvedValue(null);
    expect((await revokeRequest()).status).toBe(401);
    getToken.mockResolvedValue({ ...ADMIN, userId: '' });
    expect((await revokeRequest()).status).toBe(403);
    for (const role of [
      'teacher',
      'hod',
      'smt',
      'sbst',
      'sbst_chair',
      'platform_admin',
    ]) {
      getToken.mockResolvedValue({ ...ADMIN, role });
      expect((await revokeRequest()).status).toBe(403);
    }
    getToken.mockResolvedValue({ sub: 'sub-1', tenantId: TENANT, userId: ACCOUNT });
    expect((await revokeRequest()).status).toBe(403);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses an id that is not a uuid, before touching the database', async () => {
    getToken.mockResolvedValue(ADMIN);
    for (const bad of ['x', "' OR 1=1 --", '..%2F..', '123']) {
      expect((await revokeRequest(bad)).status).toBe(400);
    }
    expect(revokeInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ['invitation_not_found', 404],
    ['invitation_not_pending', 409],
    ['actor_not_admin', 403],
  ])('answers the refusal %s with %i', async (reason, status) => {
    getToken.mockResolvedValue(ADMIN);
    revokeInvitation.mockResolvedValue({ ok: false, reason });
    expect((await revokeRequest()).status).toBe(status);
  });
});

describe('school scope on an invitation', () => {
  const SCHOOL = '7e1a0000-0000-4000-8000-000000000001';

  it('passes a school id to the data layer, which is what checks it belongs to this tenant', async () => {
    getToken.mockResolvedValue(ADMIN);
    const response = await invite(inviteRequest({ ...VALID, schoolId: SCHOOL }));
    expect(response.status).toBe(201);
    expect(createInvitation).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({ schoolId: SCHOOL }),
    );
  });

  it('passes none when none was given', async () => {
    getToken.mockResolvedValue(ADMIN);
    await invite(inviteRequest(VALID));
    expect(createInvitation.mock.calls[0]?.[2]).not.toHaveProperty('schoolId');
  });

  it('answers a school that is not this tenant’s with a 404 and no hint of where it is', async () => {
    getToken.mockResolvedValue(ADMIN);
    createInvitation.mockResolvedValue({ ok: false, reason: 'school_not_found' });
    const response = await invite(inviteRequest({ ...VALID, schoolId: SCHOOL }));
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain(SCHOOL);
  });

  it('refuses a school id that is not a uuid before touching the database', async () => {
    getToken.mockResolvedValue(ADMIN);
    expect(
      (await invite(inviteRequest({ ...VALID, schoolId: 'not-a-uuid' }))).status,
    ).toBe(400);
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
