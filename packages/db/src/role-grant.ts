// Granting `admin` or `smt` to an EXISTING account (OQ-033 step 3b, docs/PROVISIONING_DESIGN.md §4.7).
//
// When a school has two or more administrators, one of them proposes the grant and a different one
// confirms it, each as themselves, each a durable act: the proposal is a `role_grant_request` row,
// the confirmation applies the grant in the same transaction and marks the row APPLIED. There is no
// "confirmed but not yet applied" state. A school with a single administrator has no one to
// confirm, so the grant is applied at once and the waiver is recorded in the audit ledger.
//
// The two-person rule is held twice: by the rules passed in (`ProvisioningRules`, bound to the real
// ones in apps/web) and by CHECK constraints on the table, so a caller bug cannot record a
// self-confirmed grant. Every function takes the tenant's provisioning lock first — the same lock,
// for the same reason, as the rest of step 3 (see provisioning.ts) — so two administrators confirming
// the same request at once serialise, and the second finds it no longer pending.
//
// No personal information is stored or audited here: requests and events carry ids, roles and
// states only, and there is no free-text field.

import { appendAuditEvent } from './audit.js';
import type { TenantClient } from './client.js';
import {
  currentTenantId,
  listActiveAdminAccountIds,
  lockProvisioning,
  schoolInTenant,
  type ProvisioningRules,
  type Refused,
} from './provisioning.js';

/**
 * The roles that need a second administrator. Mirrors `CONFIRMATION_REQUIRED_ROLES` in
 * `@infinite-ai/policy` (db may not import policy) and the CHECK on the table; drift tests
 * hold all three together.
 */
export const SENSITIVE_ROLES = ['admin', 'smt'] as const;

/** Shorter than an invitation's 14 days: this decides authority, and the person already works here. */
export const DEFAULT_ROLE_GRANT_LIFETIME_DAYS = 7;

export function defaultRoleGrantExpiry(now: Date): Date {
  return new Date(now.getTime() + DEFAULT_ROLE_GRANT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

const refuse = (reason: string): Refused => ({ ok: false, reason });

interface RequestRow {
  readonly id: string;
  readonly targetAccountId: string;
  readonly roles: readonly string[];
  readonly schoolId: string | null;
  readonly requestedBy: string;
  readonly status: string;
  readonly expiresAt: Date;
}

/** Marks a PENDING request that has run out of time EXPIRED, with its audit event. */
async function expireRequest(
  tx: TenantClient,
  request: RequestRow,
  now: Date,
): Promise<void> {
  await tx.roleGrantRequest.update({
    where: { id: request.id },
    data: { status: 'EXPIRED' },
  });
  await appendAuditEvent(tx, {
    actorId: null,
    action: 'role_grant.expired',
    resourceType: 'role_grant_request',
    resourceId: request.id,
    purpose: null,
    traceId: null,
    diff: { targetAccountId: request.targetAccountId, roles: [...request.roles] },
    at: now,
    createdBy: null,
  });
}

/** Roles from `roles` that `accountId` already holds (unexpired). */
async function heldRoles(
  tx: TenantClient,
  accountId: string,
  roles: readonly string[],
  now: Date,
): Promise<string[]> {
  const rows = await tx.roleAssignment.findMany({
    where: {
      userAccountId: accountId,
      role: { in: [...roles] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { role: true },
  });
  return [...new Set(rows.map((r) => r.role))];
}

async function applyGrant(
  tx: TenantClient,
  input: {
    readonly tenantId: string;
    readonly targetAccountId: string;
    readonly roles: readonly string[];
    readonly schoolId: string | null;
    readonly grantedBy: string;
    readonly now: Date;
  },
): Promise<void> {
  for (const role of input.roles) {
    await tx.roleAssignment.create({
      data: {
        tenantId: input.tenantId,
        userAccountId: input.targetAccountId,
        role,
        schoolId: input.schoolId,
        grantedAt: input.now,
        createdBy: input.grantedBy,
      },
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Granting roles that need no second administrator
// ---------------------------------------------------------------------------------------------

export interface GrantRoleInput {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  readonly roles: readonly string[];
  /** Optional school scope; must be a school of this tenant (`school_not_found` otherwise). */
  readonly schoolId?: string | null;
  readonly now: Date;
}

export type GrantRoleResult = { readonly ok: true } | Refused;

/**
 * An administrator grants roles that need no second administrator (`teacher`, `hod`, `sbst`,
 * `sbst_chair`) to an existing, ACTIVE account. The rules decide who may confer what; if they say a
 * second administrator is needed (`admin`, `smt`) this refuses with `confirmation_required` — that
 * path is `requestRoleGrant`, which stores the proposal for someone else to confirm. Nothing is
 * granted that the account already holds. The grant and its audit event commit together.
 *
 * A school scope, if given, must be a school of this tenant — checked here, because a foreign key
 * does not know about row-level security (`schoolInTenant`). Without one the grant is school-wide.
 */
export async function grantRole(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: GrantRoleInput,
): Promise<GrantRoleResult> {
  await lockProvisioning(tx);

  const roles = [...new Set(input.roles)].sort();
  const admins = await listActiveAdminAccountIds(tx, input.now);
  const decision = rules.conferral({
    actorAccountId: input.actorAccountId,
    target: { kind: 'account', accountId: input.targetAccountId },
    roles,
    admins: { activeAdminAccountIds: admins },
  });
  if (!decision.allowed) return refuse(decision.reason);
  // A sole administrator's waiver is for requestRoleGrant, which records it. Here only a grant
  // that never needed a second person is applied.
  if (decision.confirmation !== 'not_required') return refuse('confirmation_required');

  const schoolId = input.schoolId ?? null;
  if (schoolId !== null && !(await schoolInTenant(tx, schoolId))) {
    return refuse('school_not_found');
  }

  const target = await tx.userAccount.findFirst({
    where: { id: input.targetAccountId },
    select: { status: true },
  });
  if (target === null) return refuse('target_not_found');
  if (target.status !== 'ACTIVE') return refuse('target_not_active');

  if ((await heldRoles(tx, input.targetAccountId, roles, input.now)).length > 0) {
    return refuse('role_already_held');
  }

  const tenantId = await currentTenantId(tx);
  await applyGrant(tx, {
    tenantId,
    targetAccountId: input.targetAccountId,
    roles,
    schoolId,
    grantedBy: input.actorAccountId,
    now: input.now,
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'role_grant.applied',
    resourceType: 'user_account',
    resourceId: input.targetAccountId,
    purpose: null,
    traceId: null,
    diff: { roles, schoolId, confirmation: 'not_required' },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------------------------

export interface RequestRoleGrantInput {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  readonly roles: readonly string[];
  readonly schoolId?: string | null;
  readonly expiresAt: Date;
  readonly now: Date;
}

export type RequestRoleGrantResult =
  | { readonly ok: true; readonly outcome: 'requested'; readonly requestId: string }
  | {
      readonly ok: true;
      readonly outcome: 'applied';
      readonly confirmation: 'waived_sole_admin';
    }
  | Refused;

/**
 * An administrator proposes `admin` and/or `smt` for an existing account. With a second
 * administrator available the request is stored PENDING for them to confirm; if the school has only
 * one administrator, nobody could confirm, so the grant is applied now and the waiver is audited.
 */
export async function requestRoleGrant(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: RequestRoleGrantInput,
): Promise<RequestRoleGrantResult> {
  await lockProvisioning(tx);

  const roles = [...new Set(input.roles)].sort();
  const schoolId = input.schoolId ?? null;

  // The rules first, so a caller who is not an administrator learns nothing about the target.
  const admins = await listActiveAdminAccountIds(tx, input.now);
  const decision = rules.conferral({
    actorAccountId: input.actorAccountId,
    target: { kind: 'account', accountId: input.targetAccountId },
    roles,
    admins: { activeAdminAccountIds: admins },
  });
  if (!decision.allowed && decision.reason !== 'confirmation_required') {
    return refuse(decision.reason);
  }
  if (decision.allowed && decision.confirmation !== 'waived_sole_admin') {
    // Nothing here needs a second administrator, so there is nothing to request.
    return refuse('no_confirmation_needed');
  }

  if (!roles.every((r) => (SENSITIVE_ROLES as readonly string[]).includes(r))) {
    return refuse('role_not_sensitive');
  }
  if (input.expiresAt.getTime() <= input.now.getTime()) return refuse('invalid_expiry');
  // After the rules, so a caller who may not request this learns nothing about which schools exist.
  if (schoolId !== null && !(await schoolInTenant(tx, schoolId))) {
    return refuse('school_not_found');
  }

  const target = await tx.userAccount.findFirst({
    where: { id: input.targetAccountId },
    select: { status: true },
  });
  if (target === null) return refuse('target_not_found');
  if (target.status !== 'ACTIVE') return refuse('target_not_active');

  if ((await heldRoles(tx, input.targetAccountId, roles, input.now)).length > 0) {
    return refuse('role_already_held');
  }

  const tenantId = await currentTenantId(tx);

  if (decision.allowed) {
    await applyGrant(tx, {
      tenantId,
      targetAccountId: input.targetAccountId,
      roles,
      schoolId,
      grantedBy: input.actorAccountId,
      now: input.now,
    });
    await appendAuditEvent(tx, {
      actorId: input.actorAccountId,
      action: 'role_grant.applied',
      resourceType: 'user_account',
      resourceId: input.targetAccountId,
      purpose: null,
      traceId: null,
      diff: { roles, schoolId, confirmation: 'waived_sole_admin' },
      at: input.now,
      createdBy: input.actorAccountId,
    });
    return { ok: true, outcome: 'applied', confirmation: 'waived_sole_admin' };
  }

  // One live request per target. A pending one that has run out of time is closed, not obeyed.
  const pending = await tx.roleGrantRequest.findFirst({
    where: { targetAccountId: input.targetAccountId, status: 'PENDING' },
  });
  if (pending !== null) {
    if (pending.expiresAt.getTime() > input.now.getTime()) {
      return refuse('request_already_pending');
    }
    await expireRequest(tx, pending, input.now);
  }

  const request = await tx.roleGrantRequest.create({
    data: {
      tenantId,
      targetAccountId: input.targetAccountId,
      roles,
      schoolId,
      requestedBy: input.actorAccountId,
      expiresAt: input.expiresAt,
    },
    select: { id: true },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'role_grant.requested',
    resourceType: 'role_grant_request',
    resourceId: request.id,
    purpose: null,
    traceId: null,
    diff: {
      targetAccountId: input.targetAccountId,
      roles,
      schoolId,
      expiresAt: input.expiresAt.toISOString(),
    },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true, outcome: 'requested', requestId: request.id };
}

// ---------------------------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------------------------

export interface ConfirmRoleGrantInput {
  readonly confirmerAccountId: string;
  readonly requestId: string;
  readonly now: Date;
}

export type ConfirmRoleGrantResult = { readonly ok: true } | Refused;

/**
 * A different administrator confirms a PENDING request: the rules are re-applied against the
 * administrators as they are now (so a proposer who has since lost the role, or a confirmer who is
 * not an administrator, is refused), then the roles are granted and the request marked APPLIED in
 * this one transaction.
 */
export async function confirmRoleGrant(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: ConfirmRoleGrantInput,
): Promise<ConfirmRoleGrantResult> {
  await lockProvisioning(tx);

  const request = await tx.roleGrantRequest.findFirst({ where: { id: input.requestId } });
  if (request === null) return refuse('request_not_found');
  if (request.status !== 'PENDING') return refuse('request_not_pending');
  if (request.expiresAt.getTime() <= input.now.getTime()) {
    await expireRequest(tx, request, input.now);
    return refuse('request_expired');
  }

  const admins = await listActiveAdminAccountIds(tx, input.now);
  if (!admins.includes(input.confirmerAccountId)) return refuse('confirmer_not_admin');

  // The request cannot outlive its target (the foreign key cascades), so "not found" and "not
  // active" are one answer here.
  const target = await tx.userAccount.findFirst({
    where: { id: request.targetAccountId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (target === null) return refuse('target_not_active');

  const decision = rules.conferral({
    actorAccountId: request.requestedBy,
    target: { kind: 'account', accountId: request.targetAccountId },
    roles: request.roles,
    admins: { activeAdminAccountIds: admins },
    confirmedByAccountId: input.confirmerAccountId,
  });
  if (!decision.allowed) return refuse(decision.reason);
  // With a second administrator present the only success is a real confirmation.
  if (decision.confirmation !== 'confirmed') return refuse('confirmation_not_applicable');

  if (
    (await heldRoles(tx, request.targetAccountId, request.roles, input.now)).length > 0
  ) {
    return refuse('role_already_held');
  }

  const tenantId = await currentTenantId(tx);
  await applyGrant(tx, {
    tenantId,
    targetAccountId: request.targetAccountId,
    roles: request.roles,
    schoolId: request.schoolId,
    grantedBy: input.confirmerAccountId,
    now: input.now,
  });
  await tx.roleGrantRequest.update({
    where: { id: request.id },
    data: {
      status: 'APPLIED',
      decidedBy: input.confirmerAccountId,
      decidedAt: input.now,
    },
  });
  await appendAuditEvent(tx, {
    actorId: input.confirmerAccountId,
    action: 'role_grant.applied',
    resourceType: 'role_grant_request',
    resourceId: request.id,
    purpose: null,
    traceId: null,
    diff: {
      targetAccountId: request.targetAccountId,
      roles: [...request.roles],
      schoolId: request.schoolId,
      confirmation: 'confirmed',
      confirmedBy: input.confirmerAccountId,
      requestedBy: request.requestedBy,
    },
    at: input.now,
    createdBy: input.confirmerAccountId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Decline and cancel
// ---------------------------------------------------------------------------------------------

export interface DecideRoleGrantInput {
  readonly actorAccountId: string;
  readonly requestId: string;
  readonly now: Date;
}

export type DecideRoleGrantResult = { readonly ok: true } | Refused;

/**
 * A different administrator declines a PENDING request, so the proposer can see it was refused.
 * Not the proposer (who cancels instead) and not the person who would receive the roles.
 */
export async function declineRoleGrant(
  tx: TenantClient,
  input: DecideRoleGrantInput,
): Promise<DecideRoleGrantResult> {
  await lockProvisioning(tx);

  const admins = await listActiveAdminAccountIds(tx, input.now);
  if (!admins.includes(input.actorAccountId)) return refuse('actor_not_admin');

  const request = await tx.roleGrantRequest.findFirst({ where: { id: input.requestId } });
  if (request === null) return refuse('request_not_found');
  if (request.status !== 'PENDING') return refuse('request_not_pending');
  if (request.expiresAt.getTime() <= input.now.getTime()) {
    await expireRequest(tx, request, input.now);
    return refuse('request_expired');
  }
  if (input.actorAccountId === request.requestedBy) return refuse('decider_is_requester');
  if (input.actorAccountId === request.targetAccountId)
    return refuse('decider_is_target');

  await tx.roleGrantRequest.update({
    where: { id: request.id },
    data: { status: 'DECLINED', decidedBy: input.actorAccountId, decidedAt: input.now },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'role_grant.declined',
    resourceType: 'role_grant_request',
    resourceId: request.id,
    purpose: null,
    traceId: null,
    diff: {
      targetAccountId: request.targetAccountId,
      roles: [...request.roles],
      requestedBy: request.requestedBy,
    },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}

/**
 * Withdraws a PENDING request. Any active administrator may, the proposer included: withdrawing a
 * proposal only narrows what could happen. (A proposer who has lost the role cannot, but any other
 * administrator can, and the request expires on its own.)
 */
export async function cancelRoleGrant(
  tx: TenantClient,
  input: DecideRoleGrantInput,
): Promise<DecideRoleGrantResult> {
  await lockProvisioning(tx);

  const admins = await listActiveAdminAccountIds(tx, input.now);
  if (!admins.includes(input.actorAccountId)) return refuse('actor_not_admin');

  const request = await tx.roleGrantRequest.findFirst({ where: { id: input.requestId } });
  if (request === null) return refuse('request_not_found');
  if (request.status !== 'PENDING') return refuse('request_not_pending');

  await tx.roleGrantRequest.update({
    where: { id: request.id },
    data: { status: 'CANCELLED', decidedBy: input.actorAccountId, decidedAt: input.now },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'role_grant.cancelled',
    resourceType: 'role_grant_request',
    resourceId: request.id,
    purpose: null,
    traceId: null,
    diff: {
      targetAccountId: request.targetAccountId,
      roles: [...request.roles],
      requestedBy: request.requestedBy,
    },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}
