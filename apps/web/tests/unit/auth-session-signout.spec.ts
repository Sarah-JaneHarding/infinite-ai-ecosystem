import { describe, it, expect, vi } from 'vitest';

// The session callback refuses a token with no valid role by throwing. That only fails
// closed if next-auth turns the throw into "signed out", which is its own behaviour rather
// than ours — so this runs the real `getServerSession` over real signed tokens instead of
// trusting that.
vi.mock('../../src/lib/env', () => ({
  getWebEnv: () => ({
    AUTH_KEYCLOAK_ID: 'id',
    AUTH_KEYCLOAK_SECRET: 'secret',
    AUTH_KEYCLOAK_ISSUER: 'http://localhost/realms/x',
  }),
}));

import { getServerSession } from 'next-auth';
import { encode } from 'next-auth/jwt';

import { authOptions } from '../../src/auth.js';

const SECRET = 'a'.repeat(40);

async function sessionFor(payload: Record<string, unknown>) {
  const token = await encode({ token: { sub: 'u1', ...payload }, secret: SECRET });
  const req = {
    headers: { host: 'localhost:3000' },
    cookies: { 'next-auth.session-token': token },
  };
  const res = {
    getHeader: () => undefined,
    setHeader: () => undefined,
    status: () => res,
    json: () => undefined,
  };
  return getServerSession(
    req as never,
    res as never,
    {
      ...authOptions,
      secret: SECRET,
    } as never,
  );
}

describe('getServerSession with the real next-auth', () => {
  it('returns the session for a token with a valid role', async () => {
    const session = await sessionFor({ role: 'hod', tenantId: 't' });
    expect(session).toMatchObject({ role: 'hod', tenantId: 't', userId: 'u1' });
  });

  it('returns no session — signed out, not a teacher — for a token with no role', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sessionFor({ tenantId: 't' })).toBeNull();
  });

  it('returns no session for a token with an unknown role', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sessionFor({ role: 'superuser', tenantId: 't' })).toBeNull();
  });
});
