// Turning the identity provider's sign-in into the actor id the rest of the app uses, and — on a
// person's first sign-in — into their account.
//
// OQ-033: the actor is the tenant's own `user_account.id`, not the OIDC `sub`. The subject proves who
// signed in; this maps it, once, to the account that `role_assignment`, the human-gate role check and
// the audit ledger all key on. docs/PROVISIONING_DESIGN.md §4.3 is the algorithm.
//
// Rule 5: everything goes through `withTenant`, with the tenant from the verified sign-in. There is no
// fallback: no account means no actor (''), and everything downstream already treats '' as "nothing
// safe to read or decide" rather than guessing. Nothing here grants a role: a first sign-in links the
// verified address to an invitation an administrator already wrote, and the roles come from that
// invitation, never from the token.

import {
  acceptInvitation,
  findActiveUserAccountId,
  InvalidTenantContextError,
  isTenantActive,
  withTenant,
} from '@infinite-ai/db';

import type { SignInOutcome } from './sign-in-outcome';

const REFUSALS = new Set<string>([
  'account_not_active',
  'email_not_verified',
  'invalid_email',
  'no_invitation',
  'invitation_expired',
  'awaiting_confirmation',
  'email_in_use',
  'subject_mismatch',
]);

export interface SignInIdentity {
  readonly tenantId: string;
  /** The OIDC `sub` from the verified profile. */
  readonly subject: string;
  /** The address the provider asserts. Used only to find an invitation; never stored beyond the account. */
  readonly email: string;
  /** Whether the provider asserts it verified that address. Without it nothing is linked. */
  readonly emailVerified: boolean;
  readonly displayName: string;
}

export interface SignInResolution {
  /** The tenant's `user_account.id`, or `''` when no account resolved. */
  readonly actorId: string;
  readonly outcome: SignInOutcome;
}

const none = (outcome: SignInOutcome): SignInResolution => ({ actorId: '', outcome });

/**
 * Resolves a sign-in to an account (§4.3).
 *
 * 1. no tenant claim or subject, a tenant that is not a UUID, or a tenant that is not ACTIVE → no actor;
 * 2. an ACTIVE account for the subject → that account (the common path: no lock, no write);
 * 3. otherwise `acceptInvitation`, which links a verified address to a pending, unexpired, confirmed
 *    invitation in one transaction under the tenant's provisioning lock, and refuses (committing
 *    nothing but the expiry of an expired invitation) when there is none, the address is unverified,
 *    the invitation still awaits a second administrator, or the subject's account is suspended or
 *    offboarded — a person who has left is never relinked.
 *
 * A database fault is not swallowed: sign-in fails and can be retried, rather than issuing a session
 * that silently has no actor for its whole lifetime.
 */
export async function resolveSignIn(
  identity: SignInIdentity,
  now: Date = new Date(),
): Promise<SignInResolution> {
  const { tenantId, subject } = identity;
  if (tenantId === '') return none('no_tenant');
  if (subject === '') return none('no_subject');
  try {
    // The subject is also the actor of this transaction's context; the audit event for a link is
    // written under the new account's id by `acceptInvitation` itself.
    return await withTenant({ tenantId, actorId: subject }, async (tx) => {
      if (!(await isTenantActive(tx))) return none('tenant_not_active');

      const existing = await findActiveUserAccountId(tx, subject);
      if (existing !== null) return { actorId: existing, outcome: 'existing' };

      const result = await acceptInvitation(tx, {
        subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: identity.displayName,
        now,
      });
      if (!result.ok) {
        return none(
          REFUSALS.has(result.reason) ? (result.reason as SignInOutcome) : 'refused',
        );
      }
      return { actorId: result.accountId, outcome: result.outcome };
    });
  } catch (error) {
    if (error instanceof InvalidTenantContextError) return none('no_tenant');
    throw error;
  }
}
