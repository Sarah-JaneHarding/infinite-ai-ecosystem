// Development identities: the school-role logins in `infra/keycloak/realm.json`, and the
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
  'teacher' | 'hod' | 'smt' | 'sbst' | 'sbst_chair' | 'admin' | 'guardian' | 'learner';

export interface DevIdentity {
  readonly username: string;
  /** Every role this login holds, in the realm file's order. Almost every login holds one; the
   * chair holds `sbst` and `sbst_chair` because the chair is a member of the team who also
   * chairs it, and the gates that need the chair (OQ-046) are decided "as its own role". */
  readonly roles: readonly DevSchoolRole[];
  /** The Keycloak user id, hence the `sub` of every token this login receives. */
  readonly subject: string;
  /** `user_account.id` — the actor id (OQ-033). */
  readonly accountId: string;
  /** `role_assignment.id`, one per entry of `roles`, in the same order. */
  readonly roleAssignmentIds: readonly string[];
  readonly email: string;
  readonly displayName: string;
}

/** `ba000000-0000-4000-8000-0000000000NN`: structurally valid for `withTenant`, and
 * recognisably a fixture (the `ba`/`bb`/`bc` prefixes are used for nothing else). */
const id = (prefix: 'ba' | 'bb' | 'bc' | 'bd', n: number): string =>
  `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function identity(
  n: number,
  handle: string,
  roles: readonly DevSchoolRole[],
  displayName: string,
): DevIdentity {
  return {
    username: `${handle}.dev`,
    roles,
    subject: id('ba', n),
    accountId: id('bb', n),
    // The first role keeps the id it always had, so an already-seeded database is unchanged;
    // further roles get ids that cannot collide with another login's first one.
    roleAssignmentIds: roles.map((_, i) => id('bc', i === 0 ? n : 100 * n + i)),
    email: `${handle}.dev@example.invalid`,
    displayName,
  };
}

export const DEV_IDENTITIES: readonly DevIdentity[] = [
  identity(1, 'teacher', ['teacher'], 'Dev Teacher'),
  identity(2, 'hod', ['hod'], 'Dev Head of Department'),
  identity(3, 'smt', ['smt'], 'Dev School Management'),
  identity(4, 'sbst', ['sbst'], 'Dev Support Team'),
  identity(5, 'admin', ['admin'], 'Dev Administrator'),
  identity(6, 'guardian', ['guardian'], 'Dev Guardian'),
  identity(7, 'learner', ['learner'], 'Dev Learner'),
  identity(8, 'chair', ['sbst', 'sbst_chair'], 'Dev Support Team Chair'),
];

/**
 * A dev login that has an invitation and, deliberately, NO account (OQ-033 step 8). Signing in as this person
 * exercises the real path: the verified address finds the invitation, `acceptInvitation` creates the account
 * and its role, and the invitation is spent. The seeded identities above skip that path by creating accounts
 * directly; this one does not, so the flow the schools will actually use is the one a developer can try.
 *
 * Kept out of `DEV_IDENTITIES` on purpose: nothing may seed an account for this person, and the
 * `dev-identities.spec.ts` drift guard says so.
 */
export interface DevInvitee {
  readonly username: string;
  /** The roles the invitation carries, and so the account will hold once it is accepted. */
  readonly roles: readonly DevSchoolRole[];
  /** The Keycloak user id, hence the `sub` of this login's tokens, and the `subject` of the account to be. */
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
  /** `user_invitation.id`. */
  readonly invitationId: string;
}

export const DEV_INVITEES: readonly DevInvitee[] = [
  {
    username: 'invitee.dev',
    roles: ['teacher'],
    subject: id('ba', 9),
    email: 'invitee.dev@example.invalid',
    displayName: 'Dev New Teacher',
    invitationId: id('bd', 9),
  },
];
