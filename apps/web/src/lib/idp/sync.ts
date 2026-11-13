// Telling the identity provider after a provisioning change has committed (OQ-033 step 7d).
//
// Called by an admin route AFTER its database transaction, never inside it: a network call must not hold
// the school's provisioning lock. The change itself already marked what Keycloak must hear about (in the
// same transaction, `packages/db/src/idp-sync.ts`), so if this fails or the process dies here the marker
// remains and the overview shows it. This function therefore NEVER throws: the administrator's action
// succeeded, and a Keycloak problem is reported as state, not as a failure of that action.

import {
  loadIdpAccountWork,
  loadIdpInvitationWork,
  recordAccountIdp,
  recordInvitationIdp,
  recordInvitationIdpUser,
  withTenant,
} from '@infinite-ai/db';

import type { TokenActor } from '@/lib/token-actor';

import { getIdentityProvider } from './provider';
import {
  reconcileIdentityProvider,
  type IdpStore,
  type ReconcileResult,
} from './reconcile';

export function tenantStore(
  actor: TokenActor,
  now: () => Date = () => new Date(),
): IdpStore {
  const run = <T>(fn: Parameters<typeof withTenant<T>>[1]) =>
    withTenant({ tenantId: actor.tenantId, actorId: actor.actorId }, fn);
  return {
    loadWork: () =>
      run(async (tx) => ({
        invitations: await loadIdpInvitationWork(tx, now()),
        accounts: await loadIdpAccountWork(tx, now()),
      })),
    recordInvitationUser: (id, userId) =>
      run((tx) => recordInvitationIdpUser(tx, id, userId)),
    recordInvitation: (id, outcome, userId) =>
      run((tx) => recordInvitationIdp(tx, id, outcome, userId, now())),
    recordAccount: (id, outcome) => run((tx) => recordAccountIdp(tx, id, outcome, now())),
  };
}

/** `null` when no identity provider is configured, or when reconciling itself could not run. */
export async function syncIdentityProvider(
  actor: TokenActor,
): Promise<ReconcileResult | null> {
  const idp = getIdentityProvider();
  if (idp === null) return null;
  try {
    return await reconcileIdentityProvider(idp, tenantStore(actor), actor.tenantId);
  } catch {
    // The database is unreachable or a record could not be written. Whatever was PENDING stays PENDING.
    return null;
  }
}
