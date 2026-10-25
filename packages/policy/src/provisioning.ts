// Who may confer, change and remove authority at a school (OQ-033, docs/PROVISIONING_DESIGN.md
// §4.5 and §12.1).
//
// The permission matrix answers "may an administrator grant roles at all". It cannot answer the
// questions that make that safe, because they depend on who is acting on whom and on how many
// administrators the school has. They live here, as pure functions with a reason for every
// refusal, so each is one readable rule and one test — and so the routes that arrive in step 3
// cannot forget one.
//
// Everything is pure and synchronous, like the rest of this package: the caller supplies the
// facts (who is acting, who the target is, who the school's active administrators are) and gets
// a verdict. Nothing here reads a database.

/**
 * The roles an invitation or a grant by a school administrator may carry. Staff only: a
 * platform role belongs to INFINITE-AI, and guardians and learners are provisioned by their own
 * routes (consent and a learner record), not by an administrator granting a role.
 *
 * This list is held a second time in SQL — the CHECK constraint on `user_invitation.roles` —
 * and `test/invitation-roles.spec.ts` fails if the two ever differ.
 */
export const SCHOOL_STAFF_ROLES = ['teacher', 'hod', 'smt', 'sbst', 'admin'] as const;
export type SchoolStaffRole = (typeof SCHOOL_STAFF_ROLES)[number];

/**
 * Roles whose grant is a decision about who may decide: `admin` administers accounts, `smt`
 * decides human gates. Conferring one needs a second administrator's confirmation when the
 * school has one to give (rule 6's spirit: authority over gates is not a one-person decision).
 */
export const CONFIRMATION_REQUIRED_ROLES: readonly SchoolStaffRole[] = ['admin', 'smt'];

export function isSchoolStaffRole(role: string): role is SchoolStaffRole {
  return (SCHOOL_STAFF_ROLES as readonly string[]).includes(role);
}

/** The facts about a school's administrators that every rule below needs. */
export interface AdminState {
  /**
   * Account ids of the school's ACTIVE administrators: an ACTIVE account holding an unexpired
   * `admin` assignment. Computed by the caller from the database; a suspended or lapsed
   * administrator does not count, so they can neither confirm nor keep the school "covered".
   */
  readonly activeAdminAccountIds: readonly string[];
}

export type ConfirmationOutcome =
  /** The roles conferred need no second administrator. */
  | 'not_required'
  /** A second administrator confirmed. */
  | 'confirmed'
  /** The school has a single administrator, so no one could confirm. Recorded in the audit. */
  | 'waived_sole_admin';

export type ProvisioningDenial =
  | 'actor_not_admin'
  | 'no_roles'
  | 'role_not_assignable'
  | 'cannot_change_own_roles'
  | 'cannot_change_own_status'
  | 'confirmation_required'
  | 'confirmer_not_admin'
  | 'confirmer_is_actor'
  | 'confirmer_is_target';

export type ProvisioningDecision =
  | {
      readonly allowed: true;
      readonly confirmation: ConfirmationOutcome;
      /** The confirming administrator's account id when `confirmation` is `confirmed`. */
      readonly confirmedBy: string | null;
    }
  | { readonly allowed: false; readonly reason: ProvisioningDenial };

const deny = (reason: ProvisioningDenial): ProvisioningDecision => ({
  allowed: false,
  reason,
});

const allow = (
  confirmation: ConfirmationOutcome,
  confirmedBy: string | null = null,
): ProvisioningDecision => ({ allowed: true, confirmation, confirmedBy });

function distinctAdmins(state: AdminState): ReadonlySet<string> {
  return new Set(state.activeAdminAccountIds);
}

// ---------------------------------------------------------------------------
// Conferring roles: inviting a person, or granting a role to an existing account
// ---------------------------------------------------------------------------

/** Who is receiving the roles. Explicit, so the self-grant case cannot be left out. */
export type ConferralTarget =
  /** An existing account being granted further roles. */
  | { readonly kind: 'account'; readonly accountId: string }
  /**
   * A person being invited. `isActorsOwnAddress` is the caller's comparison of the invited
   * address (normalised) with the acting administrator's own — an administrator cannot invite
   * themselves into further roles any more than grant them directly.
   */
  | { readonly kind: 'invitation'; readonly isActorsOwnAddress: boolean };

export interface RoleConferral {
  /** The administrator doing it: their `user_account.id`. */
  readonly actorAccountId: string;
  readonly target: ConferralTarget;
  /** The roles to confer. Unvalidated strings are fine: anything off the staff list is refused. */
  readonly roles: readonly string[];
  readonly admins: AdminState;
  /** Another administrator's confirmation, if one has been given. */
  readonly confirmedByAccountId?: string | null;
}

/**
 * May this administrator confer these roles?
 *
 * Checked in this order, and the order is the policy — the first failure is the reason given:
 *   1. the actor is an active administrator of the school;
 *   2. there is at least one role, and every one is a school staff role (a platform, guardian
 *      or learner role can never be conferred this way);
 *   3. nobody changes their own roles;
 *   4. `admin` and `smt` need a second administrator's confirmation — unless the school has
 *      only one administrator, in which case the grant proceeds and says so (a one-administrator
 *      primary would otherwise be unable to appoint anyone, and the exception stays visible).
 */
export function evaluateRoleConferral(input: RoleConferral): ProvisioningDecision {
  const admins = distinctAdmins(input.admins);
  if (!admins.has(input.actorAccountId)) return deny('actor_not_admin');

  if (input.roles.length === 0) return deny('no_roles');
  if (!input.roles.every(isSchoolStaffRole)) return deny('role_not_assignable');

  const targetsSelf =
    input.target.kind === 'account'
      ? input.target.accountId === input.actorAccountId
      : input.target.isActorsOwnAddress;
  if (targetsSelf) return deny('cannot_change_own_roles');

  const needsConfirmation = input.roles.some((r) =>
    (CONFIRMATION_REQUIRED_ROLES as readonly string[]).includes(r),
  );
  if (!needsConfirmation) return allow('not_required');

  // A second administrator exists iff there is any active administrator besides the actor.
  const others = [...admins].filter((id) => id !== input.actorAccountId);
  if (others.length === 0) return allow('waived_sole_admin');

  const confirmer = input.confirmedByAccountId ?? null;
  if (confirmer === null) return deny('confirmation_required');
  if (confirmer === input.actorAccountId) return deny('confirmer_is_actor');
  if (input.target.kind === 'account' && confirmer === input.target.accountId) {
    return deny('confirmer_is_target');
  }
  if (!admins.has(confirmer)) return deny('confirmer_not_admin');
  return allow('confirmed', confirmer);
}

// ---------------------------------------------------------------------------
// Removing authority: revoking a role, suspending or offboarding an account
// ---------------------------------------------------------------------------

export interface RoleRevocation {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  /** The role being removed. */
  readonly role: string;
  readonly admins: AdminState;
}

/**
 * May this administrator revoke this role?
 *
 * Removing authority needs no confirmation — it only narrows what someone can do. The one thing
 * that is never allowed is changing your own roles.
 *
 * "The school's last administrator is never removed" needs no branch of its own, and none is
 * written, because it holds by construction for a single change: the actor must be an active
 * administrator and cannot be the target, so whenever the target is an administrator the actor
 * is a second one, who remains. `provisioning.spec.ts` checks that property exhaustively over
 * small schools rather than trusting the argument.
 *
 * What this function cannot see is a *race*: two administrators each demoting the other at the
 * same moment both pass these checks against the same snapshot and leave none. That is closed
 * where the change is committed (step 3): the tenant's administrators are locked and re-counted
 * inside the transaction, and the rules are evaluated against that count.
 */
export function evaluateRoleRevocation(input: RoleRevocation): ProvisioningDecision {
  const admins = distinctAdmins(input.admins);
  if (!admins.has(input.actorAccountId)) return deny('actor_not_admin');
  if (input.targetAccountId === input.actorAccountId)
    return deny('cannot_change_own_roles');
  return allow('not_required');
}

export interface AccountStatusChange {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  readonly admins: AdminState;
}

/**
 * May this administrator suspend or offboard this account?
 *
 * Not yourself — an administrator who is leaving is offboarded by another one. As with
 * revocation, the last administrator cannot be affected by construction, and a race between two
 * administrators is closed in the committing transaction, not here.
 */
export function evaluateAccountStatusChange(
  input: AccountStatusChange,
): ProvisioningDecision {
  const admins = distinctAdmins(input.admins);
  if (!admins.has(input.actorAccountId)) return deny('actor_not_admin');
  if (input.targetAccountId === input.actorAccountId)
    return deny('cannot_change_own_status');
  return allow('not_required');
}
