// Turning what the identity provider says into a role the app will act on.
//
// There is deliberately no default. A person Keycloak does not give one of our roles has no
// role here, and "no role" must never become the least-privileged role by quiet fallback:
// that would hand every unrecognised account — a role renamed in Keycloak, a new account
// nobody has set up, a typo — a teacher's access to the tenant's curriculum and approvals.

import { Role } from '@infinite-ai/policy';

/** `raw` if it is exactly one of our roles, otherwise `null`. */
export function readRole(raw: unknown): Role | null {
  const parsed = Role.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The first of our roles in the profile's `realm_access.roles`, or `null`.
 *
 * Realm roles that are not ours (Keycloak adds `default-roles-<realm>` and
 * `offline_access` to everyone) are skipped. If an account holds more than one of ours, the
 * first in the provider's order wins — see OQ-032: which should win is a policy decision. */
export function roleFromProfile(profile: unknown): Role | null {
  if (typeof profile !== 'object' || profile === null) return null;
  const realmAccess = (profile as Record<string, unknown>)['realm_access'];
  if (typeof realmAccess !== 'object' || realmAccess === null) return null;
  const roles = (realmAccess as Record<string, unknown>)['roles'];
  if (!Array.isArray(roles)) return null;
  for (const candidate of roles) {
    const role = readRole(candidate);
    if (role !== null) return role;
  }
  return null;
}
