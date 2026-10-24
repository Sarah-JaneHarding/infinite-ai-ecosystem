import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEV_IDENTITIES, DEV_TENANT_ID } from '../prisma/dev-identities.js';

// Drift guard (OQ-033). The dev stack only works if the Keycloak users and the seeded
// accounts agree on the subject: a token's `sub` is resolved to the account whose `subject`
// matches. If someone edits one side, sign-in silently resolves no actor and every gate
// decision is refused — correct, but baffling. This fails first, and says why.

interface RealmUser {
  readonly id?: string;
  readonly username: string;
  readonly email: string;
  readonly attributes?: { readonly tenant_id?: readonly string[] };
  readonly realmRoles?: readonly string[];
}

const realm = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'infra', 'keycloak', 'realm.json'),
    'utf8',
  ),
) as { users: readonly RealmUser[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('dev identities vs the Keycloak realm', () => {
  it.each(DEV_IDENTITIES.map((who) => [who.username, who] as const))(
    '%s: the realm user has the fixed id, email, role and tenant the seed assumes',
    (_username, who) => {
      const user = realm.users.find((u) => u.username === who.username);
      expect(user, `${who.username} missing from realm.json`).toBeDefined();
      expect(user?.id).toBe(who.subject);
      expect(user?.email).toBe(who.email);
      expect(user?.realmRoles).toEqual([who.role]);
      expect(user?.attributes?.tenant_id).toEqual([DEV_TENANT_ID]);
    },
  );

  it('uses ids the tenant-scoped client accepts, and no id twice', () => {
    const ids = DEV_IDENTITIES.flatMap((w) => [
      w.subject,
      w.accountId,
      w.roleAssignmentId,
    ]);
    for (const value of ids) expect(value).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the actor id (the account) distinct from the provider subject', () => {
    for (const who of DEV_IDENTITIES) expect(who.accountId).not.toBe(who.subject);
  });

  it('leaves platform staff without an account at the dev school', () => {
    const roles = DEV_IDENTITIES.map((w) => w.role) as string[];
    expect(roles).not.toContain('platform_support');
    expect(roles).not.toContain('platform_admin');
  });
});
