// A Keycloak Admin REST client behind `IdentityProviderAdmin` (slice 7a). `fetch` only — no new
// dependency (rule 9) — and `fetch` is injected so the contract is tested without a Keycloak.
//
// NOT VERIFIED AGAINST A RUNNING KEYCLOAK. The paths, verbs and bodies below are from knowledge of
// Keycloak 26's Admin REST API (design §13), pinned by `keycloak-admin.spec.ts` as assumptions. Slice 7e
// is the check against the real thing; until it has run, nothing may depend on this in production.

import {
  IdpError,
  isSchoolStaffRole,
  type CreateIdpUserInput,
  type IdentityProviderAdmin,
  type IdpUser,
  type RequiredAction,
  type SchoolStaffRole,
} from './port';

export interface KeycloakAdminConfig {
  /** The realm issuer, e.g. `https://id.example/realms/infinite-ai` (the same value sign-in uses). */
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Refresh a token this long before it expires, so a request never races the expiry. */
const TOKEN_SKEW_MS = 30_000;

interface RoleRep {
  readonly id: string;
  readonly name: string;
}

export function createKeycloakAdmin(config: KeycloakAdminConfig): IdentityProviderAdmin {
  const issuer = new URL(config.issuerUrl);
  const match = /^(.*)\/realms\/([^/]+)\/?$/.exec(issuer.pathname);
  if (match === null) throw new Error('issuerUrl must look like <base>/realms/<realm>');
  const origin = `${issuer.origin}${match[1] ?? ''}`;
  const realm = decodeURIComponent(match[2] ?? '');
  const admin = `${origin}/admin/realms/${encodeURIComponent(realm)}`;
  const tokenUrl = `${origin}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? Date.now;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let token: { value: string; expiresAt: number } | null = null;

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new IdpError('unavailable');
    }
  }

  function failure(status: number): IdpError {
    if (status === 401) return new IdpError('unauthorised');
    if (status === 403) return new IdpError('forbidden');
    if (status === 404) return new IdpError('not_found');
    if (status === 409) return new IdpError('conflict');
    if (status >= 500 || status === 429) return new IdpError('unavailable');
    return new IdpError('rejected');
  }

  async function accessToken(): Promise<string> {
    if (token !== null && token.expiresAt - TOKEN_SKEW_MS > now()) return token.value;
    const response = await send(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    // A refused client login is our configuration being wrong, whatever status says so.
    if (response.status === 400 || response.status === 401)
      throw new IdpError('unauthorised');
    if (!response.ok) throw failure(response.status);
    const body: unknown = await response.json().catch(() => null);
    const parsed = body as { access_token?: unknown; expires_in?: unknown } | null;
    if (
      typeof parsed?.access_token !== 'string' ||
      typeof parsed.expires_in !== 'number'
    ) {
      throw new IdpError('rejected');
    }
    token = { value: parsed.access_token, expiresAt: now() + parsed.expires_in * 1000 };
    return token.value;
  }

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${await accessToken()}`);
    const response = await send(`${admin}${path}`, { ...init, headers });
    if (response.status === 401) token = null; // stale token: the next call logs in again
    return response;
  }

  const json = (body: unknown): RequestInit => ({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function roleReps(names: readonly SchoolStaffRole[]): Promise<RoleRep[]> {
    const reps: RoleRep[] = [];
    for (const name of names) {
      const response = await call(`/roles/${encodeURIComponent(name)}`);
      if (!response.ok) throw failure(response.status);
      const body = (await response.json().catch(() => null)) as Partial<RoleRep> | null;
      if (typeof body?.id !== 'string' || typeof body.name !== 'string') {
        throw new IdpError('rejected');
      }
      reps.push({ id: body.id, name: body.name });
    }
    return reps;
  }

  function checkRoles(
    roles: readonly string[],
  ): asserts roles is readonly SchoolStaffRole[] {
    if (!roles.every(isSchoolStaffRole)) throw new IdpError('invalid_role');
  }

  async function mapRoles(
    method: 'POST' | 'DELETE',
    userId: string,
    names: readonly SchoolStaffRole[],
  ): Promise<void> {
    if (names.length === 0) return;
    const response = await call(
      `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
      { method, ...json(await roleReps(names)) },
    );
    if (!response.ok) throw failure(response.status);
  }

  return {
    async createUser(input: CreateIdpUserInput): Promise<IdpUser> {
      checkRoles(input.roles);
      const response = await call('/users', {
        method: 'POST',
        ...json({
          username: input.email,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          enabled: true,
          emailVerified: false,
          attributes: { tenant_id: [input.tenantId] },
          requiredActions: [...input.requiredActions],
        }),
      });
      if (response.status !== 201) throw failure(response.status);
      const id = response.headers.get('location')?.split('/').pop();
      if (id === undefined || id === '') throw new IdpError('rejected');
      // A failure here leaves a user with no roles. That is the safe half-state (they hold nothing
      // they should not), and the caller records it so a retry finds the user and sets the roles.
      await mapRoles('POST', id, input.roles);
      return { id, enabled: true };
    },

    async findUserByEmail(email: string): Promise<IdpUser | null> {
      const response = await call(`/users?email=${encodeURIComponent(email)}&exact=true`);
      if (!response.ok) throw failure(response.status);
      const body = (await response.json().catch(() => null)) as
        { id?: unknown; enabled?: unknown }[] | null;
      const first = Array.isArray(body) ? body[0] : undefined;
      if (first === undefined) return null;
      if (typeof first.id !== 'string') throw new IdpError('rejected');
      return { id: first.id, enabled: first.enabled !== false };
    },

    async setRoles(userId: string, roles: readonly SchoolStaffRole[]): Promise<void> {
      checkRoles(roles);
      const response = await call(
        `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
      );
      if (!response.ok) throw failure(response.status);
      const current = (await response.json().catch(() => null)) as
        { name?: unknown }[] | null;
      const have = (Array.isArray(current) ? current : [])
        .map((r) => r.name)
        .filter(
          (n): n is SchoolStaffRole => typeof n === 'string' && isSchoolStaffRole(n),
        );
      await mapRoles(
        'POST',
        userId,
        roles.filter((r) => !have.includes(r)),
      );
      await mapRoles(
        'DELETE',
        userId,
        have.filter((r) => !roles.includes(r)),
      );
    },

    async setEnabled(userId: string, enabled: boolean): Promise<void> {
      const path = `/users/${encodeURIComponent(userId)}`;
      const current = await call(path);
      if (!current.ok) throw failure(current.status);
      const rep = (await current.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (rep === null || typeof rep !== 'object') throw new IdpError('rejected');
      const response = await call(path, { method: 'PUT', ...json({ ...rep, enabled }) });
      if (!response.ok) throw failure(response.status);
    },

    async revokeSessions(userId: string): Promise<void> {
      const response = await call(`/users/${encodeURIComponent(userId)}/logout`, {
        method: 'POST',
      });
      if (!response.ok) throw failure(response.status);
    },

    async sendActionsEmail(
      userId: string,
      actions: readonly RequiredAction[],
      lifespanSeconds: number,
    ): Promise<void> {
      const response = await call(
        `/users/${encodeURIComponent(userId)}/execute-actions-email?lifespan=${Math.trunc(lifespanSeconds)}`,
        { method: 'PUT', ...json([...actions]) },
      );
      if (!response.ok) throw failure(response.status);
    },
  };
}
