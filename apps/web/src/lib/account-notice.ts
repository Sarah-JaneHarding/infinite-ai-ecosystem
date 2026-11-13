// The explanation for a person who signed in but has no account at their school.
//
// Before invitations a sign-in with no account simply showed empty pages, and nobody could tell
// "nothing here yet" from "you have no access". Now there is always a reason (`SignInOutcome`), and
// this says it in plain words. It is shown only to school staff roles: platform staff and the
// guardian and learner users have no school account by design (PROVISIONING_DESIGN §8, §12.2 item
// 10), and telling them to ask an administrator would be wrong.
//
// What each message says is what the person can do about it. None names an address.

import { isSchoolStaffRole } from '@infinite-ai/policy';

import type { SignInOutcome } from './sign-in-outcome';

const ASK_ADMIN = "Ask your school's administrator";

const MESSAGES: Partial<Record<SignInOutcome, string>> = {
  no_invitation: `You're signed in, but your school hasn't set up an account for this email address yet. ${ASK_ADMIN} to invite you.`,
  invalid_email: `You're signed in, but your sign-in doesn't carry a usable email address. ${ASK_ADMIN} for help.`,
  invitation_expired: `Your invitation has expired. ${ASK_ADMIN} to send you a new one.`,
  awaiting_confirmation: `Your invitation is waiting for a second administrator at your school to confirm it. Try again once they have.`,
  email_not_verified: `Your email address hasn't been verified yet. Use the verification link sent to you, then sign in again.`,
  email_in_use: `Another account at your school already uses this email address. ${ASK_ADMIN} for help.`,
  account_not_active: `Your account at this school is not active. ${ASK_ADMIN} for help.`,
  tenant_not_active: `Your school's account is not active. ${ASK_ADMIN} for help.`,
  no_tenant: `Your sign-in isn't linked to a school. Contact your school's administrator or support.`,
  no_subject: `Your sign-in isn't linked to a school. Contact your school's administrator or support.`,
  refused: `Your account could not be set up. ${ASK_ADMIN} for help.`,
};

const GENERIC = `You're signed in, but you don't have an account at your school yet. ${ASK_ADMIN} for help.`;

/**
 * The message to show, or `null` when there is nothing to say: the person has an account
 * (`userId` set), or they are not a school staff role. An outcome of `null` (a token from before
 * this existed) gets the generic message rather than none, because the person still has no account.
 */
export function accountNotice(
  role: string,
  userId: string,
  outcome: SignInOutcome | null,
): string | null {
  if (userId !== '' || !isSchoolStaffRole(role)) return null;
  return (outcome === null ? undefined : MESSAGES[outcome]) ?? GENERIC;
}

/**
 * What to say to someone with no role to act as: signed in, but nothing is both asserted by the
 * sign-in and granted by the school (eligible-roles.ts). With no account that is the account's
 * own explanation; with an account it is the missing grant. Shown on `/choose-role` only.
 */
export function noRoleNotice(userId: string, outcome: SignInOutcome | null): string {
  if (userId === '') return (outcome === null ? undefined : MESSAGES[outcome]) ?? GENERIC;
  return `You're signed in, but your account has no role at your school that matches your sign-in. ${ASK_ADMIN} to check the roles you have been given.`;
}
