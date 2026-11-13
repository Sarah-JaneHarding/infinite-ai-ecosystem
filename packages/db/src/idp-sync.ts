// "Has the identity provider been told?" (OQ-033 step 7c; docs/PROVISIONING_DESIGN.md §11.1).
//
// The database decides who may do what; Keycloak is told afterwards, because a network call must not
// share the provisioning transaction (it would hold the per-tenant advisory lock across a request to
// another system). This module is the record of that "afterwards":
//
//   - a change that Keycloak must hear about marks the row PENDING in the SAME transaction as the change,
//     so a crash between commit and call leaves a visible marker rather than a silent gap;
//   - the caller then reads the work, calls the provider, and records SYNCED or FAILED;
//   - rows the application never opted in (`NOT_MANAGED`, the by-hand pilot path and every row that
//     predates this) are never touched, so the application only ever changes Keycloak users it created.
//
// Nothing here calls Keycloak and nothing here imports a client: db sees states, not providers. The error
// kind stored on a failure is a short token, validated here, so a response body or an address from an
// upstream error cannot be written into a table by a careless caller.

import { appendAuditEvent } from './audit.js';
import type { TenantClient } from './client.js';

/** What a caller reports after trying. `errorKind` is a token such as `unavailable`, never a message. */
export type IdpOutcome =
  { readonly ok: true } | { readonly ok: false; readonly errorKind: string };

const ERROR_KIND = /^[a-z][a-z_]{0,39}$/;

function assertErrorKind(outcome: IdpOutcome): void {
  if (!outcome.ok && !ERROR_KIND.test(outcome.errorKind)) {
    throw new Error('idp error kind must be a short lower-case token, not a message');
  }
}

/** Opts a freshly created invitation into identity-provider sync. NOT_MANAGED → PENDING only; returns
 * whether it changed. Called by the route when the integration is configured — the database cannot know. */
export async function requestInvitationIdpSync(
  tx: TenantClient,
  invitationId: string,
): Promise<boolean> {
  const result = await tx.userInvitation.updateMany({
    where: { id: invitationId, idpState: 'NOT_MANAGED' },
    data: { idpState: 'PENDING' },
  });
  return result.count === 1;
}

/** An account's database state changed in a way Keycloak has not heard about. A no-op for an account the
 * application does not manage, so it is safe to call from every status and role change. */
export async function markAccountIdpPending(
  tx: TenantClient,
  accountId: string,
): Promise<void> {
  await tx.userAccount.updateMany({
    where: { id: accountId, idpState: { not: 'NOT_MANAGED' } },
    data: { idpState: 'PENDING', idpErrorKind: null },
  });
}

export async function recordInvitationIdp(
  tx: TenantClient,
  invitationId: string,
  outcome: IdpOutcome,
  idpUserId: string | null,
  at: Date,
): Promise<void> {
  assertErrorKind(outcome);
  const data = outcome.ok
    ? { idpState: 'SYNCED' as const, idpErrorKind: null, idpUserId }
    : {
        idpState: 'FAILED' as const,
        idpErrorKind: outcome.errorKind,
        // A half-finished attempt may already have created the user; keep its id so a retry finds it.
        ...(idpUserId === null ? {} : { idpUserId }),
      };
  if (outcome.ok && idpUserId === null) {
    throw new Error('a synced invitation must name its identity-provider user');
  }
  const result = await tx.userInvitation.updateMany({
    where: { id: invitationId, idpState: { in: ['PENDING', 'FAILED'] } },
    data,
  });
  if (result.count === 0) return; // no longer waiting (revoked, or someone else got there first)
  await appendAuditEvent(tx, {
    actorId: null,
    action: outcome.ok
      ? 'user_invitation.idp_user_created'
      : 'user_invitation.idp_sync_failed',
    resourceType: 'user_invitation',
    resourceId: invitationId,
    purpose: null,
    traceId: null,
    diff: outcome.ok ? { idpUserId } : { errorKind: outcome.errorKind },
    at,
    createdBy: null,
  });
}

export async function recordAccountIdp(
  tx: TenantClient,
  accountId: string,
  outcome: IdpOutcome,
  at: Date,
): Promise<void> {
  assertErrorKind(outcome);
  const result = await tx.userAccount.updateMany({
    where: { id: accountId, idpState: { in: ['PENDING', 'FAILED'] } },
    data: outcome.ok
      ? { idpState: 'SYNCED', idpErrorKind: null }
      : { idpState: 'FAILED', idpErrorKind: outcome.errorKind },
  });
  if (result.count === 0 || outcome.ok) return; // only failures are audited; each change already is
  await appendAuditEvent(tx, {
    actorId: null,
    action: 'user_account.idp_sync_failed',
    resourceType: 'user_account',
    resourceId: accountId,
    purpose: null,
    traceId: null,
    diff: { errorKind: outcome.errorKind },
    at,
    createdBy: null,
  });
}

export interface IdpInvitationWork {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly schoolId: string | null;
  /** Set when an earlier attempt created the user but failed afterwards. */
  readonly idpUserId: string | null;
}

/** Invitations waiting for a Keycloak user: opted in, still pending, not awaiting a second administrator
 * (an unconfirmed `admin`/`smt` invitation must not become a login), and not expired. */
export async function loadIdpInvitationWork(
  tx: TenantClient,
  now: Date,
  limit = 50,
): Promise<IdpInvitationWork[]> {
  const rows = await tx.userInvitation.findMany({
    where: {
      status: 'PENDING',
      idpState: { in: ['PENDING', 'FAILED'] },
      confirmation: { not: 'AWAITING' },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, email: true, roles: true, schoolId: true, idpUserId: true },
  });
  return rows;
}

export interface IdpAccountWork {
  readonly id: string;
  /** The Keycloak user id (the OIDC `sub`). */
  readonly subject: string;
  /** Keycloak's `enabled` should be exactly this: only an ACTIVE account may sign in. */
  readonly enabled: boolean;
  /** The roles the account holds now. The caller mirrors only the ones the provider port allows. */
  readonly roles: readonly string[];
}

/** Accounts whose Keycloak user is out of date, with the state it should now have. Derived from the
 * database every time, so a retry converges instead of replaying a stale command. */
export async function loadIdpAccountWork(
  tx: TenantClient,
  now: Date,
  limit = 50,
): Promise<IdpAccountWork[]> {
  const rows = await tx.userAccount.findMany({
    where: { idpState: { in: ['PENDING', 'FAILED'] } },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      id: true,
      subject: true,
      status: true,
      roleAssignments: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { role: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    enabled: row.status === 'ACTIVE',
    roles: [...new Set(row.roleAssignments.map((r) => r.role))].sort(),
  }));
}
