// The contract of the staff-provisioning API (OQ-033 step 5, slice b): what a request may carry, and
// how each refusal the provisioning rules can give is answered.
//
// Zod is the contract (CLAUDE.md: an API surface has a schema and a test that pins it). Both schemas
// are strict: an unknown key is a 400, never ignored — in particular the request cannot name a
// tenant, an actor or a role to act as; those come from the verified session only (rule 5).
//
// No message here contains an email address.

import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';
import { z } from 'zod';

/** An address is validated properly by the data layer (`normaliseEmail`); this only bounds what is
 * read, so an enormous string is refused before anything else sees it. */
const MAX_EMAIL_LENGTH = 254;

export const InviteStaffBody = z
  .object({
    email: z.string().min(1).max(MAX_EMAIL_LENGTH),
    roles: z
      .array(z.enum(SCHOOL_STAFF_ROLES))
      .min(1)
      .max(SCHOOL_STAFF_ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: 'A role may be listed once.',
      }),
  })
  .strict();
export type InviteStaffBody = z.infer<typeof InviteStaffBody>;

/** A route's `[id]`: an invitation, a role request or an account. A uuid or nothing. */
export const IdParam = z.string().uuid();
export const InvitationIdParam = IdParam;

/** Grant roles to an existing account. Whether it is applied now or proposed for a second
 * administrator to confirm is the server's decision, from the roles (admin and smt need one). */
export const GrantRolesBody = z
  .object({
    roles: z
      .array(z.enum(SCHOOL_STAFF_ROLES))
      .min(1)
      .max(SCHOOL_STAFF_ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: 'A role may be listed once.',
      }),
  })
  .strict();
export type GrantRolesBody = z.infer<typeof GrantRolesBody>;

export const GrantRolesResponse = z.object({
  /** `granted`: applied now. `requested`: stored for a second administrator to confirm.
   * `applied`: the school has one administrator, so it was applied now and the waiver audited. */
  outcome: z.enum(['granted', 'requested', 'applied']),
});

export const RevokeRoleBody = z.object({ role: z.enum(SCHOOL_STAFF_ROLES) }).strict();
export type RevokeRoleBody = z.infer<typeof RevokeRoleBody>;

export const StaffActionResponse = z.object({ done: z.literal(true) });

export const InviteStaffResponse = z.object({
  invitationId: z.string().uuid(),
  /** `AWAITING`: a second administrator must confirm before the person can sign in to it. */
  confirmation: z.enum(['NOT_REQUIRED', 'AWAITING', 'WAIVED_SOLE_ADMIN']),
});
export type InviteStaffResponse = z.infer<typeof InviteStaffResponse>;

export const RevokeInvitationResponse = z.object({ revoked: z.literal(true) });

export interface Refusal {
  readonly status: 403 | 404 | 409 | 422;
  readonly message: string;
}

const REFUSALS: Readonly<Record<string, Refusal>> = {
  actor_not_admin: {
    status: 403,
    message: 'Only an active administrator of this school can do this.',
  },
  cannot_change_own_roles: {
    status: 403,
    message:
      'You cannot change your own roles or invite your own address. Ask another administrator.',
  },
  no_roles: { status: 422, message: 'Choose at least one role.' },
  role_not_assignable: {
    status: 422,
    message: 'One of those roles cannot be given by an invitation.',
  },
  invalid_email: { status: 422, message: 'That is not a usable email address.' },
  invalid_expiry: { status: 422, message: 'The invitation could not be created.' },
  email_in_use: {
    status: 409,
    message: 'Someone at this school already has an account with that address.',
  },
  pending_invitation_exists: {
    status: 409,
    message:
      'That address already has a pending invitation. Revoke it first to send a new one.',
  },
  staff_member_not_found: {
    status: 422,
    message: 'The invitation could not be created.',
  },
  staff_member_already_linked: {
    status: 422,
    message: 'The invitation could not be created.',
  },
  confirmation_required: {
    status: 422,
    message:
      'That needs a second administrator to confirm. Request it instead of granting it.',
  },
  target_not_found: { status: 404, message: 'That person was not found at this school.' },
  target_not_active: {
    status: 409,
    message: 'That account is not active, so roles cannot be given to it.',
  },
  role_already_held: { status: 409, message: 'They already have that role.' },
  no_such_role: { status: 404, message: 'They do not have that role.' },
  role_not_sensitive: {
    status: 422,
    message: 'That role does not need a request. Grant it directly.',
  },
  no_confirmation_needed: {
    status: 422,
    message: 'That does not need a second administrator.',
  },
  mixed_roles: {
    status: 422,
    message: 'Grant administrator and management roles separately from the others.',
  },
  request_already_pending: {
    status: 409,
    message: 'There is already a request waiting for that person.',
  },
  request_not_found: { status: 404, message: 'That request was not found.' },
  request_not_pending: { status: 409, message: 'That request is no longer waiting.' },
  request_expired: { status: 409, message: 'That request has expired. Make a new one.' },
  confirmer_not_admin: {
    status: 403,
    message: 'Only an active administrator can confirm this.',
  },
  confirmer_is_actor: {
    status: 403,
    message: 'A different administrator must confirm this.',
  },
  confirmer_is_target: {
    status: 403,
    message: 'You cannot confirm a request for yourself.',
  },
  confirmation_not_applicable: {
    status: 409,
    message: 'That does not need confirming now.',
  },
  decider_is_requester: {
    status: 403,
    message: 'You proposed this, so cancel it instead of declining it.',
  },
  decider_is_target: {
    status: 403,
    message: 'You cannot decide a request for yourself.',
  },
  not_awaiting_confirmation: {
    status: 409,
    message: 'That invitation is not waiting to be confirmed.',
  },
  invitation_expired: {
    status: 409,
    message: 'That invitation has expired. Send a new one.',
  },
  proposer_unknown: { status: 422, message: 'That invitation cannot be confirmed here.' },
  invitation_not_found: { status: 404, message: 'That invitation was not found.' },
  invitation_not_pending: {
    status: 409,
    message: 'That invitation is no longer pending, so there is nothing to revoke.',
  },
};

const UNKNOWN: Refusal = { status: 422, message: 'That could not be done.' };

/** The answer for a refusal reason. A reason this build does not know is a generic 422, never a 500
 * and never the raw reason echoed back as if it were safe to show. */
export function refusalFor(reason: string): Refusal {
  return REFUSALS[reason] ?? UNKNOWN;
}
