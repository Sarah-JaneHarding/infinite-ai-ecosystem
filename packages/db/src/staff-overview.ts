// What a school administrator sees on `/admin/staff` (OQ-033 delivery step 5, slice a — read only):
// the school's accounts with the roles they hold, and the invitations and role-grant requests that
// are still waiting.
//
// Everything is read through the tenant-scoped client, so RLS leaves only the caller's own school.
// This module only reads. The writes (invite, revoke, confirm, suspend, ...) are the provisioning
// functions, each behind its own rules and audited in its own transaction.
//
// Nothing here ranks one role above another: roles are listed in a fixed alphabetical order.

import type { TenantClient } from './client.js';

/** A primary school has tens of staff, not thousands. The cap exists so one page can never become an
 * unbounded read; `truncated` says when it bit, so the page can say so instead of looking complete. */
export const STAFF_OVERVIEW_LIMIT = 500;

/** A school of this tenant, for the scope pickers and for naming a scope. */
export interface StaffSchool {
  readonly id: string;
  readonly name: string;
}

export interface StaffRole {
  readonly role: string;
  /** The school the role is scoped to, or `null` for the whole school group / tenant. */
  readonly schoolId: string | null;
  /** `null` = does not lapse. */
  readonly expiresAt: Date | null;
  /** Already past `now`. Shown, because a lapsed role explains why someone cannot act. */
  readonly expired: boolean;
}

export interface StaffAccount {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED';
  readonly lastSeenAt: Date | null;
  readonly roles: readonly StaffRole[];
}

export interface StaffInvitation {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly schoolId: string | null;
  readonly confirmation: 'NOT_REQUIRED' | 'AWAITING' | 'CONFIRMED' | 'WAIVED_SOLE_ADMIN';
  readonly expiresAt: Date;
  /** Past `expiresAt` but not yet marked EXPIRED: it can no longer be accepted. */
  readonly expired: boolean;
}

export interface StaffGrantRequest {
  readonly id: string;
  readonly targetAccountId: string;
  readonly roles: readonly string[];
  readonly requestedBy: string;
  readonly expiresAt: Date;
  readonly expired: boolean;
}

export interface StaffOverview {
  /** This tenant's schools, by name. */
  readonly schools: readonly StaffSchool[];
  readonly accounts: readonly StaffAccount[];
  readonly invitations: readonly StaffInvitation[];
  readonly grantRequests: readonly StaffGrantRequest[];
  /** How many people the identity provider has not caught up with (OQ-033 step 7): waiting, and failed. */
  readonly idp: { readonly pending: number; readonly failed: number };
  /** True if any list reached `STAFF_OVERVIEW_LIMIT`. */
  readonly truncated: boolean;
}

export async function loadStaffOverview(
  tx: TenantClient,
  now: Date,
): Promise<StaffOverview> {
  const [schools, accounts, invitations, grantRequests, idpAccounts, idpInvitations] =
    await Promise.all([
      tx.school.findMany({
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: STAFF_OVERVIEW_LIMIT,
      }),
      tx.userAccount.findMany({
        select: {
          id: true,
          displayName: true,
          email: true,
          status: true,
          lastSeenAt: true,
          roleAssignments: { select: { role: true, expiresAt: true, schoolId: true } },
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        take: STAFF_OVERVIEW_LIMIT,
      }),
      tx.userInvitation.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          email: true,
          roles: true,
          schoolId: true,
          confirmation: true,
          expiresAt: true,
        },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: STAFF_OVERVIEW_LIMIT,
      }),
      tx.roleGrantRequest.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          targetAccountId: true,
          roles: true,
          requestedBy: true,
          expiresAt: true,
        },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: STAFF_OVERVIEW_LIMIT,
      }),
      tx.userAccount.groupBy({
        by: ['idpState'],
        where: { idpState: { in: ['PENDING', 'FAILED'] } },
        _count: { _all: true },
      }),
      // Only an invitation still waiting to become a login counts: an accepted, revoked or expired one has
      // nothing left to tell the provider.
      tx.userInvitation.groupBy({
        by: ['idpState'],
        where: { status: 'PENDING', idpState: { in: ['PENDING', 'FAILED'] } },
        _count: { _all: true },
      }),
    ]);
  const idpCount = (state: 'PENDING' | 'FAILED'): number =>
    [...idpAccounts, ...idpInvitations]
      .filter((row) => row.idpState === state)
      .reduce((sum, row) => sum + row._count._all, 0);

  return {
    idp: { pending: idpCount('PENDING'), failed: idpCount('FAILED') },
    schools,
    accounts: accounts.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      email: a.email,
      status: a.status,
      lastSeenAt: a.lastSeenAt,
      roles: a.roleAssignments
        .map((r) => ({
          role: r.role,
          schoolId: r.schoolId,
          expiresAt: r.expiresAt,
          expired: r.expiresAt !== null && r.expiresAt <= now,
        }))
        .sort((x, y) => x.role.localeCompare(y.role)),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      roles: [...i.roles].sort(),
      schoolId: i.schoolId,
      confirmation: i.confirmation,
      expiresAt: i.expiresAt,
      expired: i.expiresAt <= now,
    })),
    grantRequests: grantRequests.map((g) => ({
      id: g.id,
      targetAccountId: g.targetAccountId,
      roles: [...g.roles].sort(),
      requestedBy: g.requestedBy,
      expiresAt: g.expiresAt,
      expired: g.expiresAt <= now,
    })),
    truncated:
      schools.length === STAFF_OVERVIEW_LIMIT ||
      accounts.length === STAFF_OVERVIEW_LIMIT ||
      invitations.length === STAFF_OVERVIEW_LIMIT ||
      grantRequests.length === STAFF_OVERVIEW_LIMIT,
  };
}
