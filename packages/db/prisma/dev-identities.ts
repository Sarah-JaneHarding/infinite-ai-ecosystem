// Development identities: the seven school-role logins in `infra/keycloak/realm.json`, and the
// `user_account` + `role_assignment` rows that make each of them a person the app can act for.
//
// Why this exists (OQ-033): a human-gate decision is recorded under the school's own
// `user_account.id`, resolved at sign-in from the provider's `sub`. A Keycloak user imported
// without a fixed id gets a random `sub` on every import, so no account row could ever match
// it. These users therefore carry fixed ids in the realm file, and the same ids are the
// `subject` of the accounts seeded here. `dev-identities.spec.ts` fails if the two drift.
//
// Platform staff (`platform-support.dev`, `platform-admin.dev`) are deliberately absent: they
// have no tenant of their own and need no account at the dev school.
//
// Everything here is invented fixture data: example.invalid addresses, no real person, and no
// secret (the logins' passwords are `SEED_USER_PASSWORD`, set in the environment).

/** The dev tenant every login in the realm file is scoped to — the same id seed.ts uses. */
export const DEV_TENANT_ID = '10000000-0000-4000-8000-000000000001';

export type DevSchoolRole =
  'teacher' | 'hod' | 'smt' | 'sbst' | 'admin' | 'guardian' | 'learner';

export interface DevIdentity {
  readonly username: string;
  readonly role: DevSchoolRole;
  /** The Keycloak user id, hence the `sub` of every token this login receives. */
  readonly subject: string;
  /** `user_account.id` — the actor id (OQ-033). */
  readonly accountId: string;
  /** `role_assignment.id`. */
  readonly roleAssignmentId: string;
  readonly email: string;
  readonly displayName: string;
}

/** `ba000000-0000-4000-8000-0000000000NN`: structurally valid for `withTenant`, and
 * recognisably a fixture (the `ba`/`bb`/`bc` prefixes are used for nothing else). */
const id = (prefix: 'ba' | 'bb' | 'bc', n: number): string =>
  `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function identity(n: number, role: DevSchoolRole, displayName: string): DevIdentity {
  return {
    username: `${role}.dev`,
    role,
    subject: id('ba', n),
    accountId: id('bb', n),
    roleAssignmentId: id('bc', n),
    email: `${role}.dev@example.invalid`,
    displayName,
  };
}

export const DEV_IDENTITIES: readonly DevIdentity[] = [
  identity(1, 'teacher', 'Dev Teacher'),
  identity(2, 'hod', 'Dev Head of Department'),
  identity(3, 'smt', 'Dev School Management'),
  identity(4, 'sbst', 'Dev Support Team'),
  identity(5, 'admin', 'Dev Administrator'),
  identity(6, 'guardian', 'Dev Guardian'),
  identity(7, 'learner', 'Dev Learner'),
];
