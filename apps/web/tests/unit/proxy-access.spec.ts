import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';

import proxy from '../../src/proxy.js';

// Security test: role gating happens in the proxy, before a page or handler runs, using
// real signed session tokens (the same way `getToken` reads them in production). The
// pages' own role checks are a second layer; this is the first.
const SECRET = 'test-secret-for-proxy-access-spec-minimum-32-characters';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';

beforeAll(() => {
  process.env['NEXTAUTH_SECRET'] = SECRET;
});

async function call(pathname: string, token?: Record<string, unknown>) {
  const headers = new Headers();
  if (token !== undefined) {
    const jwt = await encode({ token: { sub: SUB, ...token }, secret: SECRET });
    headers.set('cookie', `next-auth.session-token=${jwt}`);
  }
  return proxy(new NextRequest(`http://localhost:3000${pathname}`, { headers }));
}

const asRole = (role: string) => ({ role, tenantId: 't' });

describe('proxy role gating — pages', () => {
  it('lets a role reach its own page, with the CSP', async () => {
    const response = await call('/hod', asRole('hod'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it.each([
    ['teacher', '/hod'],
    ['hod', '/teacher'],
    ['guardian', '/approvals'],
    ['learner', '/approvals/abc'],
    ['teacher', '/admin/prompts'],
    ['admin', '/platform/runs'],
    ['teacher', '/district'],
    ['smt', '/admin/env'],
  ])('sends %s away from %s, to /', async (role, pathname) => {
    const response = await call(pathname, asRole(role));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
    expect(
      response.headers.get('x-middleware-request-content-security-policy'),
    ).toBeNull();
  });

  it('lets a platform_admin reach /district and the environment docs, which have no nav link', async () => {
    expect((await call('/district', asRole('platform_admin'))).status).toBe(200);
    expect((await call('/admin/env', asRole('platform_admin'))).status).toBe(200);
    expect((await call('/admin/curriculum/caps-canon', asRole('admin'))).status).toBe(
      200,
    );
  });

  it.each(['teacher', 'hod', 'platform_admin', 'learner'])(
    'lets %s reach / — it only redirects to their own home',
    async (role) => {
      expect((await call('/', asRole(role))).status).toBe(200);
    },
  );

  it('does not send a person away in a loop: / is reachable by every role', async () => {
    const away = await call('/hod', asRole('learner'));
    const home = new URL(away.headers.get('location') ?? '').pathname;
    expect((await call(home, asRole('learner'))).status).toBe(200);
  });

  it.each(['/not-a-route', '/admin', '/HOD', '//hod', '/%68od', '/hodx'])(
    'denies the unlisted or lookalike path %s to every role',
    async (pathname) => {
      for (const role of ['teacher', 'hod', 'admin', 'platform_admin']) {
        const response = await call(pathname, asRole(role));
        expect(response.status).toBe(307);
        expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
      }
    },
  );
});

describe('proxy role gating — handlers', () => {
  it('answers 403 JSON, not a redirect, to a role that may not call a handler', async () => {
    const response = await call('/api/caps-canon', asRole('teacher'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(response.headers.get('location')).toBeNull();
  });

  it.each([
    ['/api/caps-canon', 'teacher'],
    ['/api/caps-canon/abc/ratify', 'hod'],
    ['/api/caps-canon/abc/ingest', 'platform_admin'],
    ['/api/approvals/abc/decide', 'guardian'],
    ['/api/approvals/abc/decide', 'platform_admin'],
    ['/api/some-new-handler', 'admin'],
  ])('refuses %s to %s', async (pathname, role) => {
    expect((await call(pathname, asRole(role))).status).toBe(403);
  });

  it('lets the permitted roles through to a handler', async () => {
    expect((await call('/api/caps-canon', asRole('admin'))).status).toBe(200);
    expect((await call('/api/approvals/abc/decide', asRole('hod'))).status).toBe(200);
  });
});

describe('proxy role gating — sessions without a valid role', () => {
  it.each([
    ['no role', { tenantId: 't' }],
    ['an unknown role', asRole('superuser')],
    ['a wrong-case role', asRole('Admin')],
    ['a non-string role', { role: 7, tenantId: 't' }],
  ])('treats a token with %s as signed out — never a default role', async (_n, token) => {
    const response = await call('/teacher', token);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('callbackUrl=%2Fteacher');
  });
});

describe('proxy role gating — public paths are untouched', () => {
  it('serves the sign-in page and liveness probe with no session', async () => {
    expect((await call('/sign-in')).status).toBe(200);
    expect((await call('/api/health')).status).toBe(200);
  });

  it('serves them to a signed-in role too (no role is needed)', async () => {
    expect((await call('/sign-in', asRole('learner'))).status).toBe(200);
  });
});

// OQ-032: a person eligible for more than one role signs in with no active role and may reach
// only the chooser. Real signed tokens, as above.
describe('proxy — a session that has not chosen a role yet', () => {
  const pending = { tenantId: 't', eligibleRoles: ['teacher', 'hod'] };

  it('sends a page request to the chooser, not to sign-in and not to a default role', async () => {
    for (const pathname of ['/', '/hod', '/teacher', '/approvals']) {
      const response = await call(pathname, pending);
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
        '/choose-role',
      );
    }
  });

  it('refuses an API call outright — nothing acts for a person who has not said who they are acting as', async () => {
    for (const pathname of ['/api/approvals/x/decide', '/api/caps-canon']) {
      const response = await call(pathname, pending);
      expect(response.status).toBe(403);
    }
  });

  it('lets them reach the chooser itself, with the CSP', async () => {
    const response = await call('/choose-role', pending);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('lets a person with nothing to choose from reach the explanation, and nothing else', async () => {
    const none = { tenantId: 't', eligibleRoles: [] };
    expect((await call('/choose-role', none)).status).toBe(200);
    expect((await call('/hod', none)).status).toBe(307);
  });

  it('can still reach the sign-in and auth endpoints it needs to choose and to leave', async () => {
    expect((await call('/api/auth/session', pending)).status).toBe(200);
    expect((await call('/sign-in', pending)).status).toBe(200);
  });

  it('sends a token with neither a role nor an offered list to sign-in', async () => {
    const response = await call('/choose-role', { tenantId: 't' });
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/sign-in');
  });

  it('sends a person who has a role away from the chooser, to /', async () => {
    const response = await call('/choose-role', { ...pending, role: 'hod' });
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
  });
});
