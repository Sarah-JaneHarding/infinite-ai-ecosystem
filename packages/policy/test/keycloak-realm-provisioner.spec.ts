import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLATFORM_ROLES, Role } from '../src/rbac.js';

// OQ-033 step 7b / OQ-048 (a) drift guard. The application creates and updates Keycloak users through
// a dedicated service account, `infinite-ai-provisioner`. That account is a credential which can
// change who may sign in, so what it may do is a security property of the realm file, not a detail:
// this fails if it is widened, if it is given an application role, or if the worker's own account is
// quietly given user-management power instead (the alternative OQ-048 (a) rejected).
//
// What this proves: the committed realm configuration. What it does NOT prove: that Keycloak
// accepts the import and that these roles suffice for the calls the client makes. That is slice 7e,
// against a running Keycloak.

interface Client {
  readonly clientId: string;
  readonly publicClient?: boolean;
  readonly bearerOnly?: boolean;
  readonly standardFlowEnabled?: boolean;
  readonly implicitFlowEnabled?: boolean;
  readonly directAccessGrantsEnabled?: boolean;
  readonly serviceAccountsEnabled?: boolean;
  readonly secret?: string;
  readonly attributes?: Record<string, string>;
}
interface User {
  readonly username: string;
  readonly serviceAccountClientId?: string;
  readonly realmRoles?: readonly string[];
  readonly clientRoles?: Record<string, readonly string[]>;
}
const root = join(__dirname, '..', '..', '..');
const realm = JSON.parse(
  readFileSync(join(root, 'infra', 'keycloak', 'realm.json'), 'utf8'),
) as { clients: readonly Client[]; users: readonly User[] };

const PROVISIONER = 'infinite-ai-provisioner';
const client = realm.clients.find((c) => c.clientId === PROVISIONER);
const account = realm.users.find((u) => u.serviceAccountClientId === PROVISIONER);

/** What the client's calls need (create/find users, map realm roles, disable, log out, send the
 * actions email, read a realm role by name). `view-realm` is read-only. Unverified until 7e. */
const REQUIRED = ['manage-users', 'query-users', 'view-users', 'view-realm'];
/** Roles that would turn a user-management account into a realm administrator. */
const FORBIDDEN = [
  'realm-admin',
  'manage-realm',
  'manage-clients',
  'manage-authorization',
  'manage-identity-providers',
  'manage-events',
  'create-client',
  'impersonation',
];

describe('Keycloak realm: the provisioner service account (OQ-048 (a))', () => {
  it('is a confidential, service-account-only client with its secret taken from the environment', () => {
    expect(client, 'infinite-ai-provisioner client missing').toBeDefined();
    expect(client?.publicClient).toBe(false);
    expect(client?.bearerOnly).toBe(false);
    expect(client?.serviceAccountsEnabled).toBe(true);
    expect(client?.standardFlowEnabled).toBe(false);
    expect(client?.implicitFlowEnabled).toBe(false);
    expect(client?.directAccessGrantsEnabled).toBe(false);
    // A placeholder resolved at import time, never a literal (rule 7).
    expect(client?.secret).toBe('${KEYCLOAK_PROVISIONER_CLIENT_SECRET}');
  });

  it('holds exactly the user-management roles, and nothing that makes it a realm administrator', () => {
    const roles = [...(account?.clientRoles?.['realm-management'] ?? [])].sort();
    expect(roles).toEqual([...REQUIRED].sort());
    for (const forbidden of FORBIDDEN) expect(roles).not.toContain(forbidden);
    expect(Object.keys(account?.clientRoles ?? {})).toEqual(['realm-management']);
  });

  it('holds no application role of its own (it mirrors roles; it never acts as one)', () => {
    expect(account?.realmRoles ?? []).toEqual([]);
    for (const role of [...PLATFORM_ROLES, 'admin', 'smt'] as const) {
      expect(account?.realmRoles ?? []).not.toContain(role);
    }
  });

  it('keeps its tokens short-lived', () => {
    expect(Number(client?.attributes?.['access.token.lifespan'])).toBeLessThanOrEqual(
      300,
    );
  });

  it('leaves the worker’s account without user-management power (the rejected alternative)', () => {
    const worker = realm.users.find(
      (u) => u.serviceAccountClientId === 'infinite-ai-worker',
    );
    expect(Object.keys(worker?.clientRoles ?? {})).toEqual([]);
  });

  it('gives no other client or service account user-management roles', () => {
    for (const user of realm.users) {
      if (user === account) continue;
      expect(user.clientRoles?.['realm-management'] ?? [], user.username).toEqual([]);
    }
  });

  it('is wired end to end: compose passes the secret, the example names it, the generator fills it', () => {
    const compose = readFileSync(
      join(root, 'infra', 'docker', 'compose.dev.yml'),
      'utf8',
    );
    expect(compose).toMatch(
      /KEYCLOAK_PROVISIONER_CLIENT_SECRET: \$\{KEYCLOAK_PROVISIONER_CLIENT_SECRET:\?/,
    );
    const example = readFileSync(join(root, 'infra', 'docker', '.env.example'), 'utf8');
    expect(example).toMatch(/^KEYCLOAK_PROVISIONER_CLIENT_SECRET=$/m);
    const sandbox = readFileSync(join(root, 'scripts', 'sandbox.sh'), 'utf8');
    expect(sandbox).toContain('V[KEYCLOAK_PROVISIONER_CLIENT_SECRET]=');
  });

  it('names no role the application does not know', () => {
    for (const role of account?.realmRoles ?? [])
      expect(Role.safeParse(role).success).toBe(true);
  });
});

// Found by slice 7e against Keycloak 26.0.8: the Admin API silently drops a user attribute the realm's
// user profile does not declare, so users the application created had no `tenant_id`, and so no tenant
// claim. Declared here as admin-only: a user must never be able to view-edit their own tenant.
describe('Keycloak realm: tenant_id is a declared, admin-only user attribute (slice 7e)', () => {
  const raw = JSON.parse(
    readFileSync(join(root, 'infra', 'keycloak', 'realm.json'), 'utf8'),
  ) as {
    components?: Record<
      string,
      readonly { config?: Record<string, readonly string[]> }[]
    >;
  };
  const config =
    raw.components?.['org.keycloak.userprofile.UserProfileProvider']?.[0]?.config?.[
      'kc.user.profile.config'
    ]?.[0];
  const profile = (config === undefined ? { attributes: [] } : JSON.parse(config)) as {
    attributes: {
      name: string;
      permissions?: { view?: readonly string[]; edit?: readonly string[] };
    }[];
  };
  const tenant = profile.attributes.find((a) => a.name === 'tenant_id');

  it('declares tenant_id in the user profile, or Keycloak drops it', () => {
    expect(tenant, 'tenant_id is not declared in the realm user profile').toBeDefined();
  });

  it('lets only an administrator view or edit it', () => {
    expect(tenant?.permissions?.edit).toEqual(['admin']);
    expect(tenant?.permissions?.view).toEqual(['admin']);
  });

  it('keeps the standard attributes, so replacing the default profile loses nothing', () => {
    const names = profile.attributes.map((a) => a.name);
    for (const n of ['username', 'email', 'firstName', 'lastName'])
      expect(names).toContain(n);
  });
});
