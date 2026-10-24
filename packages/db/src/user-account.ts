// Resolving an identity provider's subject to the tenant's own account id.
//
// `user_account.id` is the actor id everywhere (OQ-033): it is what `role_assignment`
// references, what a human gate's role check looks up, and what `app.actor_id` carries into
// the audit ledger. The provider's `sub` is only how a person proves who they are at
// sign-in; it is mapped to an account once, here, and never used as an actor afterwards.
//
// `user_account` is tenant-owned, so under `withTenant` RLS leaves only the caller's own
// school's accounts. `@@unique([tenantId, subject])` makes the match at most one row.

import type { TenantClient } from './client.js';

/**
 * The id of the ACTIVE account in the current tenant whose OIDC subject is `subject`, or
 * `null` if there is none. A suspended or deactivated account does not resolve: a person
 * who cannot act must not be handed an actor id.
 */
export async function findActiveUserAccountId(
  tx: TenantClient,
  subject: string,
): Promise<string | null> {
  const account = await tx.userAccount.findFirst({
    where: { subject, status: 'ACTIVE' },
    select: { id: true },
  });
  return account?.id ?? null;
}
