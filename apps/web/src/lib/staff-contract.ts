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

export const InvitationIdParam = z.string().uuid();

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
    message: 'You cannot invite your own address. Ask another administrator.',
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
