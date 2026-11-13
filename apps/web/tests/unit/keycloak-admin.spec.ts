// The Keycloak Admin client's contract, against an injected `fetch` (slice 7a). These pin the
// requests the client makes — the paths, verbs and bodies are ASSUMPTIONS from knowledge of
// Keycloak 26 (design §13), not observations. Slice 7e checks them against a running Keycloak.

import { describe, expect, it, vi } from 'vitest';

import { createKeycloakAdmin } from '../../src/lib/idp/keycloak-admin';
import { IdpError } from '../../src/lib/idp/port';

const ISSUER = 'https://id.example/realms/infinite-ai';
const SECRET = 'sekret-value-for-tests';

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string | null;
  readonly auth: string | null;
}

type Reply = Response | ((seen: Seen) => Response);
const ok = (status = 200, body?: unknown, headers?: Record<string, string>): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    ...(headers === undefined ? {} : { headers }),
  });
const TOKEN = ok(200, { access_token: 'tok-1', expires_in: 300 });

function harness(script: Reply[], now = () => 1_000_000) {
  const seen: Seen[] = [];
  const queue = [...script];
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const record: Seen = {
      method: init?.method ?? 'GET',
      url: String(input),
      body:
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : ((init?.body as string | undefined) ?? null),
      auth: headers.get('authorization'),
    };
    seen.push(record);
    const next = queue.shift();
    if (next === undefined)
      throw new Error(`unexpected request: ${record.method} ${record.url}`);
    return typeof next === 'function' ? next(record) : next.clone();
  });
  const client = createKeycloakAdmin({
    issuerUrl: ISSUER,
    clientId: 'infinite-ai-provisioner',
    clientSecret: SECRET,
    fetch: fetchStub as unknown as typeof fetch,
    now,
  });
  return { client, seen, fetchStub };
}

describe('logging in', () => {
  it('uses the client-credentials grant on the realm token endpoint, and sends the token as a bearer', async () => {
    const { client, seen } = harness([TOKEN, ok(200, [])]);
    await client.findUserByEmail('a@b.example');
    expect(seen[0]?.url).toBe(
      'https://id.example/realms/infinite-ai/protocol/openid-connect/token',
    );
    expect(seen[0]?.body).toContain('grant_type=client_credentials');
    expect(seen[0]?.body).toContain('client_id=infinite-ai-provisioner');
    expect(seen[1]?.auth).toBe('Bearer tok-1');
  });

  it('reuses a token until shortly before it expires, then logs in again', async () => {
    let clock = 1_000_000;
    const { client, seen } = harness(
      [
        TOKEN,
        ok(200, []),
        ok(200, []),
        ok(200, { access_token: 'tok-2', expires_in: 300 }),
        ok(200, []),
      ],
      () => clock,
    );
    await client.findUserByEmail('a@b.example');
    clock += 100_000;
    await client.findUserByEmail('a@b.example');
    expect(seen.filter((s) => s.url.endsWith('/token'))).toHaveLength(1);
    clock += 200_000; // 300 s in: inside the 30 s skew of expiry
    await client.findUserByEmail('a@b.example');
    expect(seen.filter((s) => s.url.endsWith('/token'))).toHaveLength(2);
    expect(seen.at(-1)?.auth).toBe('Bearer tok-2');
  });

  it.each([400, 401])(
    'answers a refused client login (%i) as unauthorised',
    async (status) => {
      const { client } = harness([ok(status)]);
      await expect(client.findUserByEmail('a@b.example')).rejects.toMatchObject({
        kind: 'unauthorised',
      });
    },
  );

  it('forgets the token after a 401 so the next call logs in again', async () => {
    const { client, seen } = harness([
      TOKEN,
      ok(401),
      ok(200, { access_token: 'tok-2', expires_in: 300 }),
      ok(200, []),
    ]);
    await expect(client.findUserByEmail('a@b.example')).rejects.toMatchObject({
      kind: 'unauthorised',
    });
    await client.findUserByEmail('a@b.example');
    expect(seen.filter((s) => s.url.endsWith('/token'))).toHaveLength(2);
  });

  it('refuses an issuer that is not <base>/realms/<realm>', () => {
    expect(() =>
      createKeycloakAdmin({
        issuerUrl: 'https://id.example/',
        clientId: 'c',
        clientSecret: 's',
      }),
    ).toThrow(/realms/);
  });

  it('works for a Keycloak served under a path prefix', async () => {
    const seen: string[] = [];
    const client = createKeycloakAdmin({
      issuerUrl: 'https://id.example/auth/realms/infinite-ai',
      clientId: 'c',
      clientSecret: 's',
      fetch: (async (url: RequestInfo | URL) => {
        seen.push(String(url));
        return seen.length === 1 ? TOKEN.clone() : ok(200, []);
      }) as typeof fetch,
    });
    await client.findUserByEmail('a@b.example');
    expect(seen[0]).toBe(
      'https://id.example/auth/realms/infinite-ai/protocol/openid-connect/token',
    );
    expect(seen[1]).toContain('https://id.example/auth/admin/realms/infinite-ai/users?');
  });
});

describe('createUser', () => {
  const input = {
    email: 'Teacher@School.example',
    tenantId: '10000000-0000-4000-8000-000000000001',
    roles: ['teacher'] as const,
    requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] as const,
  };

  it('creates the user with the tenant attribute and actions, then maps the roles', async () => {
    const { client, seen } = harness([
      TOKEN,
      ok(201, undefined, {
        location: 'https://id.example/admin/realms/infinite-ai/users/u-123',
      }),
      ok(200, { id: 'role-1', name: 'teacher' }),
      ok(204),
    ]);
    expect(await client.createUser(input)).toEqual({ id: 'u-123', enabled: true });
    const create = JSON.parse(seen[1]?.body ?? '{}') as Record<string, unknown>;
    expect(seen[1]).toMatchObject({ method: 'POST' });
    expect(seen[1]?.url).toBe('https://id.example/admin/realms/infinite-ai/users');
    expect(create).toMatchObject({
      email: 'Teacher@School.example',
      enabled: true,
      emailVerified: false,
      attributes: { tenant_id: [input.tenantId] },
      requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'],
    });
    expect(seen[3]).toMatchObject({
      method: 'POST',
      url: 'https://id.example/admin/realms/infinite-ai/users/u-123/role-mappings/realm',
    });
    expect(JSON.parse(seen[3]?.body ?? '[]')).toEqual([
      { id: 'role-1', name: 'teacher' },
    ]);
  });

  it('never marks the address verified itself — Keycloak does that (§5)', async () => {
    const { client, seen } = harness([
      TOKEN,
      ok(201, undefined, { location: '/users/u-1' }),
      ok(200, { id: 'r', name: 'teacher' }),
      ok(204),
    ]);
    await client.createUser(input);
    expect(JSON.parse(seen[1]?.body ?? '{}')).toMatchObject({ emailVerified: false });
  });

  it('refuses to adopt an existing user (409 → conflict)', async () => {
    const { client } = harness([TOKEN, ok(409)]);
    await expect(client.createUser(input)).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('refuses a platform role before any request is made', async () => {
    const { client, fetchStub } = harness([]);
    await expect(
      client.createUser({ ...input, roles: ['platform_admin' as never] }),
    ).rejects.toMatchObject({ kind: 'invalid_role' });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('reports a 201 with no Location header as rejected, not as a user with no id', async () => {
    const { client } = harness([TOKEN, ok(201)]);
    await expect(client.createUser(input)).rejects.toMatchObject({ kind: 'rejected' });
  });
});

describe('setRoles', () => {
  const rep = (name: string) => ok(200, { id: `id-${name}`, name });

  it('adds what is missing and removes what is extra, and touches no other role', async () => {
    const { client, seen } = harness([
      TOKEN,
      ok(200, [
        { name: 'teacher' },
        { name: 'offline_access' },
        { name: 'default-roles-infinite-ai' },
        { name: 'hod' },
      ]),
      rep('smt'),
      ok(204),
      rep('hod'),
      ok(204),
    ]);
    await client.setRoles('u-1', ['teacher', 'smt']);
    const posts = seen
      .filter((s) => s.method === 'POST' && !s.url.endsWith('/token'))
      .map((s) => JSON.parse(s.body ?? '[]'));
    const deletes = seen
      .filter((s) => s.method === 'DELETE')
      .map((s) => JSON.parse(s.body ?? '[]'));
    expect(posts).toEqual([[{ id: 'id-smt', name: 'smt' }]]);
    expect(deletes).toEqual([[{ id: 'id-hod', name: 'hod' }]]);
    expect(JSON.stringify(seen)).not.toContain('offline_access"}');
  });

  it('makes no change request when the roles already match', async () => {
    const { client, seen } = harness([TOKEN, ok(200, [{ name: 'teacher' }])]);
    await client.setRoles('u-1', ['teacher']);
    expect(seen.map((s) => s.method)).toEqual(['POST', 'GET']);
  });

  it('refuses a platform role', async () => {
    const { client } = harness([]);
    await expect(
      client.setRoles('u-1', ['platform_support' as never]),
    ).rejects.toBeInstanceOf(IdpError);
  });
});

describe('the other calls', () => {
  it('setEnabled reads the user, then writes it back with only `enabled` changed', async () => {
    const { client, seen } = harness([
      TOKEN,
      ok(200, {
        id: 'u-1',
        email: 'a@b.example',
        enabled: true,
        attributes: { tenant_id: ['t'] },
      }),
      ok(204),
    ]);
    await client.setEnabled('u-1', false);
    expect(seen[2]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(seen[2]?.body ?? '{}')).toEqual({
      id: 'u-1',
      email: 'a@b.example',
      enabled: false,
      attributes: { tenant_id: ['t'] },
    });
  });

  it('revokeSessions posts to the user’s logout endpoint', async () => {
    const { client, seen } = harness([TOKEN, ok(204)]);
    await client.revokeSessions('u-1');
    expect(seen[1]).toMatchObject({
      method: 'POST',
      url: 'https://id.example/admin/realms/infinite-ai/users/u-1/logout',
    });
  });

  it('sendActionsEmail puts the action list with a whole-second lifespan', async () => {
    const { client, seen } = harness([TOKEN, ok(204)]);
    await client.sendActionsEmail('u-1', ['VERIFY_EMAIL', 'CONFIGURE_TOTP'], 86400.9);
    expect(seen[1]).toMatchObject({
      method: 'PUT',
      url: 'https://id.example/admin/realms/infinite-ai/users/u-1/execute-actions-email?lifespan=86400',
    });
    expect(JSON.parse(seen[1]?.body ?? '[]')).toEqual(['VERIFY_EMAIL', 'CONFIGURE_TOTP']);
  });

  it('findUserByEmail asks for an exact match and returns null when there is none', async () => {
    const { client, seen } = harness([TOKEN, ok(200, [])]);
    expect(await client.findUserByEmail('a+b@c.example')).toBeNull();
    expect(seen[1]?.url).toContain('email=a%2Bb%40c.example&exact=true');
  });
});

describe('errors', () => {
  it.each([
    [403, 'forbidden', false],
    [404, 'not_found', false],
    [400, 'rejected', false],
    [500, 'unavailable', true],
    [429, 'unavailable', true],
  ])('maps a %i to %s (retryable: %s)', async (status, kind, retryable) => {
    const { client } = harness([TOKEN, ok(status)]);
    const error = await client.revokeSessions('u-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IdpError);
    expect(error).toMatchObject({ kind, retryable });
  });

  it('answers a network failure as unavailable, and never repeats a secret, token or address', async () => {
    const client = createKeycloakAdmin({
      issuerUrl: ISSUER,
      clientId: 'c',
      clientSecret: SECRET,
      fetch: (async () => {
        throw new Error(`connect ECONNREFUSED with ${SECRET} for a@b.example`);
      }) as typeof fetch,
    });
    const error = (await client
      .findUserByEmail('a@b.example')
      .catch((e: unknown) => e)) as IdpError;
    expect(error.kind).toBe('unavailable');
    expect(error.retryable).toBe(true);
    expect(`${error.message} ${error.stack ?? ''}`).not.toContain(SECRET);
    expect(error.message).not.toContain('a@b.example');
  });

  it('does not put a Keycloak response body in the error', async () => {
    const { client } = harness([
      TOKEN,
      new Response('{"error":"user victim@school.example exists"}', { status: 400 }),
    ]);
    const error = (await client
      .revokeSessions('u-1')
      .catch((e: unknown) => e)) as IdpError;
    expect(error.message).toBe('identity provider: rejected');
  });
});
