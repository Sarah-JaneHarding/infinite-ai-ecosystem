// Turning the identity provider's subject into the actor id the rest of the app uses.
//
// OQ-033: the actor is the tenant's own `user_account.id`, not the OIDC `sub`. The subject
// proves who signed in; this maps it, once, to the account that `role_assignment`, the
// human-gate role check and the audit ledger all key on.
//
// Rule 5: the lookup goes through `withTenant`, with the tenant from the verified sign-in.
// There is no fallback: no account means no actor (''), and everything downstream already
// treats '' as "nothing safe to read or decide" rather than guessing.

import {
  findActiveUserAccountId,
  InvalidTenantContextError,
  withTenant,
} from '@infinite-ai/db';

export interface ActorLookup {
  readonly tenantId: string;
  /** The OIDC `sub` from the verified profile. */
  readonly subject: string;
}

/**
 * The tenant's account id for this subject, or `''` if there is none.
 *
 * `''` covers: no tenant claim, no subject, a tenant or subject that is not a UUID (the
 * tenant-scoped client refuses to open a transaction for one), and no ACTIVE account.
 * A database fault is not swallowed: sign-in fails and can be retried, rather than issuing
 * a session that silently has no actor for its whole lifetime.
 */
export async function resolveActorId({
  tenantId,
  subject,
}: ActorLookup): Promise<string> {
  if (tenantId === '' || subject === '') return '';
  try {
    // The subject is also the actor of this one read. It is a read: nothing is written, so
    // nothing lands in the audit ledger under it.
    const accountId = await withTenant({ tenantId, actorId: subject }, (tx) =>
      findActiveUserAccountId(tx, subject),
    );
    return accountId ?? '';
  } catch (error) {
    if (error instanceof InvalidTenantContextError) return '';
    throw error;
  }
}
