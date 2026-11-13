// Why a sign-in did or did not resolve an account (docs/PROVISIONING_DESIGN.md §4.3).
//
// Pure and free of the database package, so the session callback, the explanation shown to the
// person and the resolver can all use it. The value is shown to the person who signed in, about
// their own sign-in; it never carries an address.

/** Why a sign-in did or did not resolve an account. Shown to the person (never the address). */
export const SIGN_IN_OUTCOMES = [
  // An account resolved:
  'existing',
  'linked',
  // No account resolved:
  'no_tenant',
  'no_subject',
  'tenant_not_active',
  'account_not_active',
  'email_not_verified',
  'invalid_email',
  'no_invitation',
  'invitation_expired',
  'awaiting_confirmation',
  'email_in_use',
  'subject_mismatch',
  'refused',
] as const;

export type SignInOutcome = (typeof SIGN_IN_OUTCOMES)[number];

/** `raw` if it is exactly one of the outcomes, otherwise `null` (a token from before this existed). */
export function readOutcome(raw: unknown): SignInOutcome | null {
  return (SIGN_IN_OUTCOMES as readonly unknown[]).includes(raw)
    ? (raw as SignInOutcome)
    : null;
}
