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

/** Every one of our roles in the profile's `realm_access.roles`, each once, in the provider's order.
 *
 * Realm roles that are not ours (Keycloak adds `default-roles-<realm>` and `offline_access` to
 * everyone) are skipped. An empty list means the account has none of our roles. Nothing here
 * chooses between them: which one a person acts as is their own choice (OQ-032, §4.8), made on
 * the chooser, never inferred from the order the provider happened to list them in. */
export function rolesFromProfile(profile: unknown): Role[] {
  if (typeof profile !== 'object' || profile === null) return [];
  const realmAccess = (profile as Record<string, unknown>)['realm_access'];
  if (typeof realmAccess !== 'object' || realmAccess === null) return [];
  const roles = (realmAccess as Record<string, unknown>)['roles'];
  if (!Array.isArray(roles)) return [];
  const found: Role[] = [];
  for (const candidate of roles) {
    const role = readRole(candidate);
    if (role !== null && !found.includes(role)) found.push(role);
  }
  return found;
}

/** `raw` if it is an array whose every element is one of our roles (each once), otherwise `null`.
 * Used on the token's `eligibleRoles`: a malformed list is not a list, never a shorter one. */
export function readRoles(raw: unknown): Role[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Role[] = [];
  for (const candidate of raw) {
    const role = readRole(candidate);
    if (role === null || out.includes(role)) return null;
    out.push(role);
  }
  return out;
}
