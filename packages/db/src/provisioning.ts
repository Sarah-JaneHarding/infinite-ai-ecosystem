// Account provisioning — the transactional half of docs/PROVISIONING_DESIGN.md (OQ-033, step 3).
//
// An administrator invites a named person; a second administrator confirms the invitation if it
// carries `admin` or `smt` and the school has one to give; the person's first sign-in then
// links their verified identity to the invitation, which creates their account and their roles.
// Roles are also revoked and accounts suspended or offboarded here. Every function runs inside
// the caller's `withTenant` transaction, appends its audit event in that same transaction, and
// returns a result rather than throwing for a refusal — a refusal is an answer, not a fault.
//
// ---------------------------------------------------------------------------------------------
// One lock closes the race the rules cannot see
// ---------------------------------------------------------------------------------------------
// The rules (`@infinite-ai/policy`'s provisioning module) are pure: given who is acting, who the
// target is and who the school's administrators are, they return a verdict. They cannot see a
// second transaction. Two administrators each demoting the other, at the same moment, both read
// "two administrators", both pass, and the school is left with none. So every function here first
// takes a transaction-scoped advisory lock for the tenant's provisioning, and only then reads the
// administrators and applies the rules: the second transaction waits for the first to commit and
// then sees the truth. The audit append inside each function takes the audit lock (audit.ts);
// provisioning is always taken first, so the two never wait on each other in a cycle.
//
// ---------------------------------------------------------------------------------------------
// Why the rules are a parameter
// ---------------------------------------------------------------------------------------------
// The rules live in `@infinite-ai/policy`, a higher layer than this package, which therefore does
// not import it (consent.ts draws the same line). Each function takes a `ProvisioningRules` and
// the web layer binds the real ones. The shapes below mirror policy's exactly, so its functions
// satisfy the interface without a cast; `apps/web` asserts that at compile time.
//
// Personal information: an invitation's email address is personal information. It is stored
// (like `user_account.email`) behind row-level security and never written to an audit event —
// events refer to the invitation or account by id.

import type { TenantClient } from './client.js';
import { appendAuditEvent } from './audit.js';

// ---------------------------------------------------------------------------------------------
// The rules this module is driven by (structurally identical to @infinite-ai/policy's)
// ---------------------------------------------------------------------------------------------

export interface AdminStateInput {
  readonly activeAdminAccountIds: readonly string[];
}

export type RuleDecision =
  | {
      readonly allowed: true;
      readonly confirmation: 'not_required' | 'confirmed' | 'waived_sole_admin';
      readonly confirmedBy: string | null;
    }
  | { readonly allowed: false; readonly reason: string };

export interface ProvisioningRules {
  conferral(input: {
    readonly actorAccountId: string;
    readonly target:
      | { readonly kind: 'account'; readonly accountId: string }
      | { readonly kind: 'invitation'; readonly isActorsOwnAddress: boolean };
    readonly roles: readonly string[];
    readonly admins: AdminStateInput;
    readonly confirmedByAccountId?: string | null;
  }): RuleDecision;
  revocation(input: {
    readonly actorAccountId: string;
    readonly targetAccountId: string;
    readonly role: string;
    readonly admins: AdminStateInput;
  }): RuleDecision;
  statusChange(input: {
    readonly actorAccountId: string;
    readonly targetAccountId: string;
    readonly admins: AdminStateInput;
  }): RuleDecision;
}

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

/** A refusal: why, as a stable string a caller can map to a message. Nothing was changed. */
export interface Refused {
  readonly ok: false;
  readonly reason: string;
}

const refuse = (reason: string): Refused => ({ ok: false, reason });

export const DEFAULT_INVITATION_LIFETIME_DAYS = 14;

/** The default expiry for an invitation issued at `now`. */
export function defaultInvitationExpiry(now: Date): Date {
  return new Date(now.getTime() + DEFAULT_INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const MAX_EMAIL_LENGTH = 254;

/**
 * The form an address is stored and compared in: trimmed and lower-cased, and nothing else.
 * Matching is exact after this — no plus-address stripping, no fuzzy matching — so a lookalike
 * cannot match. `null` for anything that cannot be an address (empty, no `@` after the first
 * character, whitespace or control characters inside, over 254 characters).
 */
export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (email.indexOf('@') < 1) return null;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\s\u0000-\u001f\u007f]/u.test(email)) return null;
  return email;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new Error('No tenant context on this transaction. Use withTenant.');
  }
  return tenantId;
}

/**
 * Takes the tenant's provisioning lock for the rest of this transaction. Every function in this
 * module calls it first; it is exported so a caller composing several steps in one transaction
 * (and the tests) can hold it explicitly. Released automatically at commit or rollback.
 */
export async function lockProvisioning(tx: TenantClient): Promise<void> {
  const tenantId = await currentTenantId(tx);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`provisioning:${tenantId}`})::bigint)`;
}

/**
 * Account ids of the school's ACTIVE administrators: an ACTIVE account holding an unexpired
 * `admin` assignment. A suspended, offboarded or lapsed administrator does not count. Call it
 * only after `lockProvisioning`, or the answer can be stale by the time it is used.
 */
export async function listActiveAdminAccountIds(
  tx: TenantClient,
  now: Date,
): Promise<string[]> {
  const rows = await tx.roleAssignment.findMany({
    where: {
      role: 'admin',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      userAccount: { status: 'ACTIVE' },
    },
    select: { userAccountId: true },
  });
  return [...new Set(rows.map((r) => r.userAccountId))];
}

// ---------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------

export interface CreateInvitationInput {
  readonly actorAccountId: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly schoolId?: string | null;
  readonly staffMemberId?: string | null;
  readonly expiresAt: Date;
  readonly now: Date;
}

export type InvitationConfirmationState =
  'NOT_REQUIRED' | 'AWAITING' | 'WAIVED_SOLE_ADMIN';

export type CreateInvitationResult =
  | {
      readonly ok: true;
      readonly invitationId: string;
      readonly confirmation: InvitationConfirmationState;
    }
  | Refused;

/**
 * Invites a person. The rules decide who may confer which roles; when they say a second
 * administrator must confirm, the invitation is created AWAITING rather than refused — the
 * invitation is the proposal — and cannot be accepted until `confirmInvitation`.
 */
export async function createInvitation(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  await lockProvisioning(tx);

  const email = normaliseEmail(input.email);
  if (email === null) return refuse('invalid_email');
  if (input.expiresAt.getTime() <= input.now.getTime()) return refuse('invalid_expiry');

  const admins = await listActiveAdminAccountIds(tx, input.now);
  const actor = await tx.userAccount.findFirst({
    where: { id: input.actorAccountId },
    select: { email: true },
  });
  const decision = rules.conferral({
    actorAccountId: input.actorAccountId,
    target: {
      kind: 'invitation',
      isActorsOwnAddress: actor !== null && actor.email.trim().toLowerCase() === email,
    },
    roles: input.roles,
    admins: { activeAdminAccountIds: admins },
  });

  let confirmation: InvitationConfirmationState;
  if (decision.allowed) {
    confirmation =
      decision.confirmation === 'waived_sole_admin'
        ? 'WAIVED_SOLE_ADMIN'
        : 'NOT_REQUIRED';
  } else if (decision.reason === 'confirmation_required') {
    confirmation = 'AWAITING';
  } else {
    return refuse(decision.reason);
  }

  // Checked under the lock, so these are answers rather than races. (The partial unique index
  // and (tenant, email) constraint remain the backstop.)
  const existingAccount = await tx.userAccount.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingAccount !== null) return refuse('email_in_use');
  const pending = await tx.userInvitation.findFirst({
    where: { email, status: 'PENDING' },
    select: { id: true },
  });
  if (pending !== null) return refuse('pending_invitation_exists');

  const staffMemberId = input.staffMemberId ?? null;
  if (staffMemberId !== null) {
    const staff = await tx.staffMember.findFirst({
      where: { id: staffMemberId },
      select: { userAccountId: true },
    });
    if (staff === null) return refuse('staff_member_not_found');
    if (staff.userAccountId !== null) return refuse('staff_member_already_linked');
  }

  const tenantId = await currentTenantId(tx);
  const invitation = await tx.userInvitation.create({
    data: {
      tenantId,
      email,
      roles: [...input.roles],
      schoolId: input.schoolId ?? null,
      staffMemberId,
      expiresAt: input.expiresAt,
      createdBy: input.actorAccountId,
      confirmation,
    },
    select: { id: true },
  });

  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'user_invitation.created',
    resourceType: 'user_invitation',
    resourceId: invitation.id,
    purpose: null,
    traceId: null,
    // Ids and roles only — never the address.
    diff: {
      roles: [...input.roles],
      schoolId: input.schoolId ?? null,
      staffMemberId,
      confirmation,
      expiresAt: input.expiresAt.toISOString(),
    },
    at: input.now,
    createdBy: input.actorAccountId,
  });

  return { ok: true, invitationId: invitation.id, confirmation };
}

export interface ConfirmInvitationInput {
  readonly confirmerAccountId: string;
  readonly invitationId: string;
  readonly now: Date;
}

export type ConfirmInvitationResult = { readonly ok: true } | Refused;

/**
 * The second administrator confirms an AWAITING invitation — as themselves, in their own
 * authenticated request. The rules are re-applied against the administrators as they are now,
 * so a proposer who has since lost the role, or a confirmer who is not an administrator, is
 * refused.
 */
export async function confirmInvitation(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: ConfirmInvitationInput,
): Promise<ConfirmInvitationResult> {
  await lockProvisioning(tx);

  const invitation = await tx.userInvitation.findFirst({
    where: { id: input.invitationId },
  });
  if (invitation === null) return refuse('invitation_not_found');
  if (invitation.status !== 'PENDING') return refuse('invitation_not_pending');
  if (invitation.expiresAt.getTime() <= input.now.getTime())
    return refuse('invitation_expired');
  if (invitation.confirmation !== 'AWAITING') return refuse('not_awaiting_confirmation');
  if (invitation.createdBy === null) return refuse('proposer_unknown');

  const admins = await listActiveAdminAccountIds(tx, input.now);
  if (!admins.includes(input.confirmerAccountId)) return refuse('confirmer_not_admin');

  const decision = rules.conferral({
    actorAccountId: invitation.createdBy,
    target: { kind: 'invitation', isActorsOwnAddress: false },
    roles: invitation.roles,
    admins: { activeAdminAccountIds: admins },
    confirmedByAccountId: input.confirmerAccountId,
  });
  if (!decision.allowed) return refuse(decision.reason);
  // With a second administrator present the only success is a real confirmation.
  if (decision.confirmation !== 'confirmed') return refuse('confirmation_not_applicable');

  await tx.userInvitation.update({
    where: { id: invitation.id },
    data: { confirmation: 'CONFIRMED', confirmedBy: input.confirmerAccountId },
  });
  await appendAuditEvent(tx, {
    actorId: input.confirmerAccountId,
    action: 'user_invitation.confirmed',
    resourceType: 'user_invitation',
    resourceId: invitation.id,
    purpose: null,
    traceId: null,
    diff: { confirmedBy: input.confirmerAccountId, proposedBy: invitation.createdBy },
    at: input.now,
    createdBy: input.confirmerAccountId,
  });
  return { ok: true };
}

export interface RevokeInvitationInput {
  readonly actorAccountId: string;
  readonly invitationId: string;
  readonly now: Date;
}

export type RevokeInvitationResult = { readonly ok: true } | Refused;

/** Withdraws a PENDING invitation. Any active administrator may. */
export async function revokeInvitation(
  tx: TenantClient,
  input: RevokeInvitationInput,
): Promise<RevokeInvitationResult> {
  await lockProvisioning(tx);

  const admins = await listActiveAdminAccountIds(tx, input.now);
  if (!admins.includes(input.actorAccountId)) return refuse('actor_not_admin');

  const invitation = await tx.userInvitation.findFirst({
    where: { id: input.invitationId },
  });
  if (invitation === null) return refuse('invitation_not_found');
  if (invitation.status !== 'PENDING') return refuse('invitation_not_pending');

  await tx.userInvitation.update({
    where: { id: invitation.id },
    data: { status: 'REVOKED' },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'user_invitation.revoked',
    resourceType: 'user_invitation',
    resourceId: invitation.id,
    purpose: null,
    traceId: null,
    diff: { confirmation: invitation.confirmation },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// First sign-in: link a verified identity to a pending invitation
// ---------------------------------------------------------------------------------------------

export interface AcceptInvitationInput {
  /** The identity provider's `sub`. */
  readonly subject: string;
  /** The address the provider asserts. */
  readonly email: string;
  /** Whether the provider asserts it is verified. Without it nothing is linked. */
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly now: Date;
}

export type AcceptInvitationResult =
  | { readonly ok: true; readonly outcome: 'existing'; readonly accountId: string }
  | {
      readonly ok: true;
      readonly outcome: 'linked';
      readonly accountId: string;
      readonly roles: readonly string[];
    }
  | Refused;

/**
 * Resolves a signed-in identity to an account, creating it from a pending invitation if this is
 * the person's first sign-in. Nothing here grants authority beyond what an administrator already
 * wrote into the invitation: the roles come from the invitation, never from the identity.
 *
 * Refused (nothing created) when: the provider did not verify the address; there is no pending
 * invitation for it; the invitation is still awaiting a second administrator's confirmation; or
 * the subject already belongs to an account that is not ACTIVE (a suspended or offboarded person
 * is never relinked). An invitation found to have expired is marked EXPIRED and then refused.
 */
export async function acceptInvitation(
  tx: TenantClient,
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  await lockProvisioning(tx);

  // A second tab, or a retry after a lost response: the person already has an account.
  const existing = await tx.userAccount.findFirst({
    where: { subject: input.subject },
    select: { id: true, status: true },
  });
  if (existing !== null) {
    return existing.status === 'ACTIVE'
      ? { ok: true, outcome: 'existing', accountId: existing.id }
      : refuse('account_not_active');
  }

  if (!input.emailVerified) return refuse('email_not_verified');
  const email = normaliseEmail(input.email);
  if (email === null) return refuse('invalid_email');

  const invitation = await tx.userInvitation.findFirst({
    where: { email, status: 'PENDING' },
  });
  if (invitation === null) return refuse('no_invitation');

  if (invitation.expiresAt.getTime() <= input.now.getTime()) {
    await tx.userInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    });
    await appendAuditEvent(tx, {
      actorId: null,
      action: 'user_invitation.expired',
      resourceType: 'user_invitation',
      resourceId: invitation.id,
      purpose: null,
      traceId: null,
      diff: { roles: invitation.roles },
      at: input.now,
      createdBy: null,
    });
    return refuse('invitation_expired');
  }
  if (invitation.confirmation === 'AWAITING') return refuse('awaiting_confirmation');

  // The address may already belong to an account under another subject (a previous person at
  // this address). That needs an administrator, not a silent takeover.
  const sameAddress = await tx.userAccount.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (sameAddress !== null) return refuse('email_in_use');

  const tenantId = await currentTenantId(tx);
  const account = await tx.userAccount.create({
    data: {
      tenantId,
      subject: input.subject,
      email,
      displayName: input.displayName.trim() === '' ? email : input.displayName.trim(),
      createdBy: invitation.createdBy,
    },
    select: { id: true },
  });
  for (const role of invitation.roles) {
    await tx.roleAssignment.create({
      data: {
        tenantId,
        userAccountId: account.id,
        role,
        schoolId: invitation.schoolId,
        grantedAt: input.now,
        createdBy: invitation.createdBy,
      },
    });
  }
  if (invitation.staffMemberId !== null) {
    // Only a staff record not already linked: a concurrent link is refused, not overwritten.
    await tx.staffMember.updateMany({
      where: { id: invitation.staffMemberId, userAccountId: null },
      data: { userAccountId: account.id },
    });
  }
  await tx.userInvitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED', acceptedAt: input.now, acceptedAccountId: account.id },
  });
  await appendAuditEvent(tx, {
    actorId: account.id,
    action: 'user_invitation.accepted',
    resourceType: 'user_invitation',
    resourceId: invitation.id,
    purpose: null,
    traceId: null,
    diff: {
      accountId: account.id,
      roles: invitation.roles,
      schoolId: invitation.schoolId,
      confirmation: invitation.confirmation,
      confirmedBy: invitation.confirmedBy,
    },
    at: input.now,
    createdBy: account.id,
  });
  return { ok: true, outcome: 'linked', accountId: account.id, roles: invitation.roles };
}

// ---------------------------------------------------------------------------------------------
// Removing authority
// ---------------------------------------------------------------------------------------------

export interface RevokeRoleInput {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  readonly role: string;
  readonly now: Date;
}

export type RevokeRoleResult = { readonly ok: true } | Refused;

/**
 * Ends a role: its assignments are expired as of `now` rather than deleted, so the history of who
 * held what stays readable. The rules refuse a non-administrator and changing your own roles.
 */
export async function revokeRole(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: RevokeRoleInput,
): Promise<RevokeRoleResult> {
  await lockProvisioning(tx);

  const admins = await listActiveAdminAccountIds(tx, input.now);
  const decision = rules.revocation({
    actorAccountId: input.actorAccountId,
    targetAccountId: input.targetAccountId,
    role: input.role,
    admins: { activeAdminAccountIds: admins },
  });
  if (!decision.allowed) return refuse(decision.reason);

  const target = await tx.userAccount.findFirst({
    where: { id: input.targetAccountId },
    select: { id: true },
  });
  if (target === null) return refuse('target_not_found');

  const live = await tx.roleAssignment.findMany({
    where: {
      userAccountId: input.targetAccountId,
      role: input.role,
      OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
    },
    select: { id: true },
  });
  if (live.length === 0) return refuse('no_such_role');

  await tx.roleAssignment.updateMany({
    where: { id: { in: live.map((r) => r.id) } },
    data: { expiresAt: input.now },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action: 'role_assignment.revoked',
    resourceType: 'user_account',
    resourceId: input.targetAccountId,
    purpose: null,
    traceId: null,
    diff: { role: input.role, assignmentIds: live.map((r) => r.id) },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}

export interface SetAccountStatusInput {
  readonly actorAccountId: string;
  readonly targetAccountId: string;
  readonly status: 'SUSPENDED' | 'OFFBOARDED';
  readonly now: Date;
}

export type SetAccountStatusResult = { readonly ok: true } | Refused;

/**
 * Suspends or offboards an account. Either way it stops resolving at sign-in. Offboarding is
 * final: it also ends every live role, and an offboarded account cannot be changed again.
 */
export async function setAccountStatus(
  tx: TenantClient,
  rules: ProvisioningRules,
  input: SetAccountStatusInput,
): Promise<SetAccountStatusResult> {
  await lockProvisioning(tx);

  const admins = await listActiveAdminAccountIds(tx, input.now);
  const decision = rules.statusChange({
    actorAccountId: input.actorAccountId,
    targetAccountId: input.targetAccountId,
    admins: { activeAdminAccountIds: admins },
  });
  if (!decision.allowed) return refuse(decision.reason);

  const target = await tx.userAccount.findFirst({
    where: { id: input.targetAccountId },
    select: { status: true },
  });
  if (target === null) return refuse('target_not_found');
  if (target.status === 'OFFBOARDED') return refuse('already_offboarded');
  if (target.status === input.status) return refuse('no_change');

  await tx.userAccount.update({
    where: { id: input.targetAccountId },
    data: { status: input.status },
  });
  let rolesEnded = 0;
  if (input.status === 'OFFBOARDED') {
    const ended = await tx.roleAssignment.updateMany({
      where: {
        userAccountId: input.targetAccountId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
      },
      data: { expiresAt: input.now },
    });
    rolesEnded = ended.count;
  }
  await appendAuditEvent(tx, {
    actorId: input.actorAccountId,
    action:
      input.status === 'SUSPENDED' ? 'user_account.suspended' : 'user_account.offboarded',
    resourceType: 'user_account',
    resourceId: input.targetAccountId,
    purpose: null,
    traceId: null,
    diff: { from: target.status, to: input.status, rolesEnded },
    at: input.now,
    createdBy: input.actorAccountId,
  });
  return { ok: true };
}
