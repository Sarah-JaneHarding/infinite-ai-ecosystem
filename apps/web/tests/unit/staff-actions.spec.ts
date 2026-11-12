import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security test (OQ-033 step 5, slice c): granting, revoking and confirming are administrator acts that
// change who may do what. Every route shares one front door — the verified token's tenant and account,
// acting as `admin` — and each passes the *session's* account to the data layer as the actor, never
// anything from the request. The rules decide who may do what; the routes only route.
const db = vi.hoisted(() => ({
  getToken: vi.fn(),
  withTenant: vi.fn(),
  grantRole: vi.fn(),
  requestRoleGrant: vi.fn(),
  revokeRole: vi.fn(),
  confirmInvitation: vi.fn(),
  confirmRoleGrant: vi.fn(),
  declineRoleGrant: vi.fn(),
  cancelRoleGrant: vi.fn(),
  setAccountStatus: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({ getToken: db.getToken }));
vi.mock('@infinite-ai/db', () => ({
  withTenant: db.withTenant,
  grantRole: db.grantRole,
  requestRoleGrant: db.requestRoleGrant,
  revokeRole: db.revokeRole,
  confirmInvitation: db.confirmInvitation,
  confirmRoleGrant: db.confirmRoleGrant,
  declineRoleGrant: db.declineRoleGrant,
  cancelRoleGrant: db.cancelRoleGrant,
  setAccountStatus: db.setAccountStatus,
  SENSITIVE_ROLES: ['admin', 'smt'],
  defaultRoleGrantExpiry: (now: Date) => new Date(now.getTime() + 7 * 86_400_000),
}));
vi.mock('../../src/lib/env', () => ({ getWebEnv: () => ({ NEXTAUTH_SECRET: 'x' }) }));

import { POST as confirmInvitationRoute } from '../../src/app/api/admin/staff/invitations/[id]/confirm/route.js';
import { POST as statusRoute } from '../../src/app/api/admin/staff/accounts/[id]/status/route.js';
import { POST as grantRoute } from '../../src/app/api/admin/staff/accounts/[id]/roles/route.js';
import { POST as revokeRoleRoute } from '../../src/app/api/admin/staff/accounts/[id]/roles/revoke/route.js';
import { POST as confirmRequestRoute } from '../../src/app/api/admin/staff/role-requests/[id]/confirm/route.js';
import { POST as declineRequestRoute } from '../../src/app/api/admin/staff/role-requests/[id]/decline/route.js';
import { POST as cancelRequestRoute } from '../../src/app/api/admin/staff/role-requests/[id]/cancel/route.js';
import { provisioningRules } from '../../src/lib/provisioning-rules.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const OTHER = '5b1a0000-0000-4000-8000-0000000000aa';
const TX = { tx: true };
const ADMIN = { sub: 'sub-1', tenantId: TENANT, userId: ACCOUNT, role: 'admin' };

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

const post = (
  handler: Handler,
  id: string,
  body?: unknown,
  contentType = 'application/json',
) =>
  handler(
    new NextRequest(`http://localhost/api/admin/staff/x/${id}`, {
      method: 'POST',
      ...(body === undefined
        ? {}
        : {
            headers: { 'content-type': contentType },
            body: typeof body === 'string' ? body : JSON.stringify(body),
          }),
    }),
    { params: Promise.resolve({ id }) },
  );

interface RouteCase {
  readonly name: string;
  readonly handler: Handler;
  readonly body?: unknown;
  readonly fn: ReturnType<typeof vi.fn>;
}
const ROUTES: readonly RouteCase[] = [
  {
    name: 'grant roles',
    handler: grantRoute,
    body: { roles: ['hod'] },
    fn: db.grantRole,
  },
  {
    name: 'revoke a role',
    handler: revokeRoleRoute,
    body: { role: 'hod' },
    fn: db.revokeRole,
  },
  {
    name: 'suspend or offboard',
    handler: statusRoute,
    body: { status: 'SUSPENDED' },
    fn: db.setAccountStatus,
  },
  {
    name: 'confirm an invitation',
    handler: confirmInvitationRoute,
    fn: db.confirmInvitation,
  },
  { name: 'confirm a request', handler: confirmRequestRoute, fn: db.confirmRoleGrant },
  { name: 'decline a request', handler: declineRequestRoute, fn: db.declineRoleGrant },
  { name: 'cancel a request', handler: cancelRequestRoute, fn: db.cancelRoleGrant },
];

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
  for (const fn of [
    db.grantRole,
    db.revokeRole,
    db.confirmInvitation,
    db.confirmRoleGrant,
    db.declineRoleGrant,
    db.cancelRoleGrant,
    db.setAccountStatus,
  ]) {
    fn.mockResolvedValue({ ok: true });
  }
  db.requestRoleGrant.mockResolvedValue({
    ok: true,
    outcome: 'requested',
    requestId: OTHER,
  });
  db.getToken.mockResolvedValue(ADMIN);
});

describe.each(ROUTES)('$name — the front door', ({ handler, body, fn }) => {
  it('acts as the session’s own account in its own school', async () => {
    const response = await post(handler, OTHER, body);
    expect(response.status).toBe(200);
    expect(db.withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a session', async () => {
    db.getToken.mockResolvedValue(null);
    expect((await post(handler, OTHER, body)).status).toBe(401);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it.each([
    ['no tenant', { ...ADMIN, tenantId: '' }],
    ['no account', { ...ADMIN, userId: '' }],
    ['only the provider subject', { sub: 'sub-1', tenantId: TENANT, role: 'admin' }],
    ['no active role', { sub: 'sub-1', tenantId: TENANT, userId: ACCOUNT }],
    ['an unknown role', { ...ADMIN, role: 'superuser' }],
  ])('does nothing for a session with %s', async (_n, token) => {
    db.getToken.mockResolvedValue(token);
    expect([401, 403]).toContain((await post(handler, OTHER, body)).status);
    expect(db.withTenant).not.toHaveBeenCalled();
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
    db.getToken.mockResolvedValue({ ...ADMIN, role });
    expect((await post(handler, OTHER, body)).status).toBe(403);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it.each(['x', "' OR 1=1 --", '..%2F', '123', ''])(
    'refuses an id that is not a uuid (%j) before touching the database',
    async (id) => {
      expect((await post(handler, id, body)).status).toBe(400);
      expect(db.withTenant).not.toHaveBeenCalled();
    },
  );

  it('answers a data-layer refusal in words, never the raw reason', async () => {
    fn.mockResolvedValue({ ok: false, reason: 'actor_not_admin' });
    const response = await post(handler, OTHER, body);
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('actor_not_admin');
  });

  it('does not swallow a database fault', async () => {
    fn.mockRejectedValue(new Error('db down'));
    await expect(post(handler, OTHER, body)).rejects.toThrow('db down');
  });
});

describe.each(ROUTES.filter((r) => r.body !== undefined))(
  '$name — the body',
  ({ handler, body, fn }) => {
    it.each([
      ['form-encoded', 'a=b', 'application/x-www-form-urlencoded'],
      ['plain text', JSON.stringify(body), 'text/plain'],
    ])('refuses a %s body before reading it', async (_n, text, type) => {
      expect((await post(handler, OTHER, text, type)).status).toBe(415);
      expect(fn).not.toHaveBeenCalled();
    });

    it('refuses malformed JSON and an empty object, naming no value', async () => {
      expect((await post(handler, OTHER, '{nope')).status).toBe(400);
      expect((await post(handler, OTHER, {})).status).toBe(400);
      expect(fn).not.toHaveBeenCalled();
    });

    it.each(['tenantId', 'actorId', 'actorAccountId', 'targetAccountId', 'expiresAt'])(
      'refuses a body that names %s — the session and the url decide who and where',
      async (key) => {
        const response = await post(handler, OTHER, {
          ...(body as Record<string, unknown>),
          [key]: '99999999-9999-4999-8999-999999999999',
        });
        expect(response.status).toBe(400);
        expect(fn).not.toHaveBeenCalled();
      },
    );
  },
);

describe('grant roles — which path', () => {
  it('grants roles that need no second administrator directly, as the session’s account to the url’s target', async () => {
    const response = await post(grantRoute, OTHER, {
      roles: ['hod', 'sbst', 'sbst_chair'],
    });
    expect(await response.json()).toEqual({ outcome: 'granted' });
    expect(db.grantRole).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({
        actorAccountId: ACCOUNT,
        targetAccountId: OTHER,
        roles: ['hod', 'sbst', 'sbst_chair'],
      }),
    );
    expect(db.requestRoleGrant).not.toHaveBeenCalled();
  });

  it.each([['admin'], ['smt'], ['admin', 'smt']])(
    'only ever proposes %s for a second administrator, never grants it directly',
    async (...roles) => {
      const response = await post(grantRoute, OTHER, { roles });
      expect(await response.json()).toEqual({ outcome: 'requested' });
      expect(db.grantRole).not.toHaveBeenCalled();
      expect(db.requestRoleGrant).toHaveBeenCalledWith(
        TX,
        provisioningRules,
        expect.objectContaining({
          actorAccountId: ACCOUNT,
          targetAccountId: OTHER,
          roles,
        }),
      );
      const input = db.requestRoleGrant.mock.calls[0]?.[2] as {
        expiresAt: Date;
        now: Date;
      };
      expect(input.expiresAt.getTime()).toBeGreaterThan(input.now.getTime());
    },
  );

  it('reports a sole administrator’s waiver as applied', async () => {
    db.requestRoleGrant.mockResolvedValue({
      ok: true,
      outcome: 'applied',
      confirmation: 'waived_sole_admin',
    });
    expect(await (await post(grantRoute, OTHER, { roles: ['admin'] })).json()).toEqual({
      outcome: 'applied',
    });
  });

  it('refuses a mix of the two kinds rather than half-applying it', async () => {
    const response = await post(grantRoute, OTHER, { roles: ['hod', 'admin'] });
    expect(response.status).toBe(422);
    expect(db.grantRole).not.toHaveBeenCalled();
    expect(db.requestRoleGrant).not.toHaveBeenCalled();
  });

  it.each(['platform_admin', 'guardian', 'superuser'])(
    'refuses %s: no role outside school staff can be granted here',
    async (role) => {
      expect((await post(grantRoute, OTHER, { roles: [role] })).status).toBe(400);
      expect(db.grantRole).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['target_not_found', 404],
    ['target_not_active', 409],
    ['role_already_held', 409],
    ['cannot_change_own_roles', 403],
  ])('answers %s with %i', async (reason, status) => {
    db.grantRole.mockResolvedValue({ ok: false, reason });
    expect((await post(grantRoute, OTHER, { roles: ['hod'] })).status).toBe(status);
  });
});

describe('the actions on others’ proposals', () => {
  it('confirms as the session’s account — the confirmer is never named by the request', async () => {
    await post(confirmRequestRoute, OTHER);
    expect(db.confirmRoleGrant).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({ confirmerAccountId: ACCOUNT, requestId: OTHER }),
    );
    await post(confirmInvitationRoute, OTHER);
    expect(db.confirmInvitation).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({ confirmerAccountId: ACCOUNT, invitationId: OTHER }),
    );
  });

  it('declines and cancels as the session’s account', async () => {
    await post(declineRequestRoute, OTHER);
    await post(cancelRequestRoute, OTHER);
    for (const fn of [db.declineRoleGrant, db.cancelRoleGrant]) {
      expect(fn).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ actorAccountId: ACCOUNT, requestId: OTHER }),
      );
    }
  });

  it.each([
    ['confirmer_is_actor', 403],
    ['confirmer_is_target', 403],
    ['request_expired', 409],
    ['request_not_pending', 409],
    ['request_not_found', 404],
  ])('answers a confirm refusal %s with %i', async (reason, status) => {
    db.confirmRoleGrant.mockResolvedValue({ ok: false, reason });
    expect((await post(confirmRequestRoute, OTHER)).status).toBe(status);
  });

  it('tells a proposer who tries to decline their own request to cancel it', async () => {
    db.declineRoleGrant.mockResolvedValue({ ok: false, reason: 'decider_is_requester' });
    const response = await post(declineRequestRoute, OTHER);
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).toContain('cancel');
  });
});

describe('revoke a role', () => {
  it('revokes the one role named, on the url’s account, as the session’s account', async () => {
    await post(revokeRoleRoute, OTHER, { role: 'sbst_chair' });
    expect(db.revokeRole).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({
        actorAccountId: ACCOUNT,
        targetAccountId: OTHER,
        role: 'sbst_chair',
      }),
    );
  });

  it.each(['platform_admin', 'guardian', '', 'ADMIN'])(
    'refuses the role %j',
    async (role) => {
      expect((await post(revokeRoleRoute, OTHER, { role })).status).toBe(400);
      expect(db.revokeRole).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no_such_role', 404],
    ['cannot_change_own_roles', 403],
    ['actor_not_admin', 403],
  ])('answers %s with %i', async (reason, status) => {
    db.revokeRole.mockResolvedValue({ ok: false, reason });
    expect((await post(revokeRoleRoute, OTHER, { role: 'hod' })).status).toBe(status);
  });
});

describe('suspend or offboard', () => {
  it.each(['SUSPENDED', 'OFFBOARDED'] as const)(
    'sets %s on the url’s account, as the session’s account, with the rules bound',
    async (status) => {
      expect((await post(statusRoute, OTHER, { status })).status).toBe(200);
      expect(db.setAccountStatus).toHaveBeenCalledWith(
        TX,
        provisioningRules,
        expect.objectContaining({
          actorAccountId: ACCOUNT,
          targetAccountId: OTHER,
          status,
        }),
      );
    },
  );

  it.each(['ACTIVE', 'active', 'CLOSED', '', 'SUSPENDED '])(
    'refuses the status %j — there is no way back to ACTIVE from here',
    async (status) => {
      expect((await post(statusRoute, OTHER, { status })).status).toBe(400);
      expect(db.setAccountStatus).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['cannot_change_own_status', 403],
    ['actor_not_admin', 403],
    ['already_offboarded', 409],
    ['no_change', 409],
    ['target_not_found', 404],
  ])('answers %s with %i, in words', async (reason, status) => {
    db.setAccountStatus.mockResolvedValue({ ok: false, reason });
    const response = await post(statusRoute, OTHER, { status: 'SUSPENDED' });
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain(reason);
  });

  it('tells a person who tries it on themselves to ask another administrator', async () => {
    db.setAccountStatus.mockResolvedValue({
      ok: false,
      reason: 'cannot_change_own_status',
    });
    const response = await post(statusRoute, ACCOUNT, { status: 'OFFBOARDED' });
    expect(JSON.stringify(await response.json())).toContain('another administrator');
  });
});

describe('school scope on a grant', () => {
  const SCHOOL = '7e1a0000-0000-4000-8000-000000000001';

  it('passes the school to a direct grant', async () => {
    await post(grantRoute, OTHER, { roles: ['hod'], schoolId: SCHOOL });
    expect(db.grantRole).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({ schoolId: SCHOOL }),
    );
  });

  it('passes the school to a request for admin or smt', async () => {
    await post(grantRoute, OTHER, { roles: ['smt'], schoolId: SCHOOL });
    expect(db.requestRoleGrant).toHaveBeenCalledWith(
      TX,
      provisioningRules,
      expect.objectContaining({ schoolId: SCHOOL }),
    );
  });

  it('passes none when none was given, on either path', async () => {
    await post(grantRoute, OTHER, { roles: ['hod'] });
    await post(grantRoute, OTHER, { roles: ['smt'] });
    expect(db.grantRole.mock.calls[0]?.[2]).not.toHaveProperty('schoolId');
    expect(db.requestRoleGrant.mock.calls[0]?.[2]).not.toHaveProperty('schoolId');
  });

  it.each([
    ['grantRole', 'hod'],
    ['requestRoleGrant', 'smt'],
  ] as const)('answers a foreign school from %s with a 404', async (fn, role) => {
    db[fn].mockResolvedValue({ ok: false, reason: 'school_not_found' });
    const response = await post(grantRoute, OTHER, { roles: [role], schoolId: SCHOOL });
    expect(response.status).toBe(404);
  });

  it.each(['x', '', 7, null])(
    'refuses the school %j before touching the database',
    async (schoolId) => {
      expect((await post(grantRoute, OTHER, { roles: ['hod'], schoolId })).status).toBe(
        400,
      );
      expect(db.withTenant).not.toHaveBeenCalled();
    },
  );
});
