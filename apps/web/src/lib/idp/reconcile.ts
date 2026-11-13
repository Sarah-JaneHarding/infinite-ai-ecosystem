// Bringing the identity provider in line with the database (OQ-033 step 7d; design §5, §11.1).
//
// The database is the authority (§4.4); this only mirrors it. Pure orchestration over two seams — the
// provider port and a store — so every path is tested without Keycloak or a database. Rules it keeps:
//
//   - NEVER ADOPT. If a Keycloak user with the invitation's address already exists and we did not
//     create it (no recorded id), that is a conflict for a person to resolve: the application will not
//     take over an account it cannot show is its own. (A school that created users by hand first must
//     clear them or leave them unmanaged.)
//   - RECORD THE ID FIRST. The id of a user we just created is stored before anything else is done to it,
//     so a crash afterwards leaves a retry that finds its own user, not a stranger.
//   - ENDING ACCESS IS ORDERED. Disabling comes before ending sessions, which come before role changes:
//     a person being suspended must not be able to sign back in between the steps.
//   - ONLY SCHOOL-STAFF ROLES are mirrored (the port refuses the rest), and nothing is derived from a
//     stale command: the work is read from the database each time, so a retry converges.
//   - A FAILURE IS ONE ITEM'S. It is recorded as a kind (never a message) and the rest carry on.

import { DEFAULT_INVITATION_LIFETIME_DAYS } from '@infinite-ai/db';
import type { IdpAccountWork, IdpInvitationWork, IdpOutcome } from '@infinite-ai/db';

import {
  IdpError,
  isSchoolStaffRole,
  type IdentityProviderAdmin,
  type RequiredAction,
} from './port';

export interface IdpStore {
  loadWork(): Promise<{
    readonly invitations: readonly IdpInvitationWork[];
    readonly accounts: readonly IdpAccountWork[];
  }>;
  /** Remember a user we have just created, without leaving PENDING. */
  recordInvitationUser(invitationId: string, idpUserId: string): Promise<void>;
  recordInvitation(
    invitationId: string,
    outcome: IdpOutcome,
    idpUserId: string | null,
  ): Promise<void>;
  recordAccount(accountId: string, outcome: IdpOutcome): Promise<void>;
}

export interface ReconcileResult {
  readonly synced: number;
  readonly failed: number;
}

/** Keycloak verifies the address and sets the password. The OTP step needs no action here: the realm's
 * browser flow enrols a device on first sign-in for every role that requires one (`userSetupAllowed`). */
const REQUIRED_ACTIONS: readonly RequiredAction[] = ['VERIFY_EMAIL', 'UPDATE_PASSWORD'];
const LINK_LIFESPAN_SECONDS = DEFAULT_INVITATION_LIFETIME_DAYS * 24 * 60 * 60;

const kindOf = (error: unknown): string =>
  error instanceof IdpError ? error.kind : 'unexpected';

export async function reconcileIdentityProvider(
  idp: IdentityProviderAdmin,
  store: IdpStore,
  tenantId: string,
): Promise<ReconcileResult> {
  const work = await store.loadWork();
  let synced = 0;
  let failed = 0;

  for (const invitation of work.invitations) {
    let userId = invitation.idpUserId;
    try {
      userId = await syncInvitation(idp, store, tenantId, invitation, (id) => {
        userId = id;
      });
      await store.recordInvitation(invitation.id, { ok: true }, userId);
      synced += 1;
    } catch (error) {
      await store.recordInvitation(
        invitation.id,
        { ok: false, errorKind: kindOf(error) },
        userId,
      );
      failed += 1;
    }
  }

  for (const account of work.accounts) {
    try {
      await syncAccount(idp, account);
      await store.recordAccount(account.id, { ok: true });
      synced += 1;
    } catch (error) {
      await store.recordAccount(account.id, { ok: false, errorKind: kindOf(error) });
      failed += 1;
    }
  }
  return { synced, failed };
}

async function syncInvitation(
  idp: IdentityProviderAdmin,
  store: IdpStore,
  tenantId: string,
  work: IdpInvitationWork,
  created: (userId: string) => void,
): Promise<string> {
  const roles = work.roles.filter(isSchoolStaffRole);
  if (roles.length !== work.roles.length) throw new IdpError('invalid_role');

  let userId = work.idpUserId;
  if (userId === null) {
    if ((await idp.findUserByEmail(work.email)) !== null) throw new IdpError('conflict');
    userId = (
      await idp.createUser({
        email: work.email,
        tenantId,
        requiredActions: REQUIRED_ACTIONS,
      })
    ).id;
    created(userId); // so a failure from here on is recorded against the user that now exists
    await store.recordInvitationUser(work.id, userId);
  }
  await idp.setRoles(userId, roles);
  await idp.sendActionsEmail(userId, REQUIRED_ACTIONS, LINK_LIFESPAN_SECONDS);
  return userId;
}

async function syncAccount(
  idp: IdentityProviderAdmin,
  work: IdpAccountWork,
): Promise<void> {
  const roles = work.roles.filter(isSchoolStaffRole);
  if (work.enabled) {
    await idp.setRoles(work.subject, roles);
    await idp.setEnabled(work.subject, true);
    return;
  }
  await idp.setEnabled(work.subject, false);
  await idp.revokeSessions(work.subject);
  await idp.setRoles(work.subject, roles);
}
