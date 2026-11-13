// The identity-provider port (OQ-033 step 7, slice 7a; docs/PROVISIONING_DESIGN.md §5, §11.1).
//
// What the application is allowed to ask of Keycloak, and nothing more. The database stays the
// authority for who holds which role (§4.4); this port only mirrors that decision so Keycloak's own
// policies (MFA, the `tenant_id` claim) have something to key on. Two properties are enforced by the
// client, not left to callers:
//   - only school-staff roles can be mirrored. A platform role can never be set through this port, so
//     a wiring mistake cannot mint platform authority (§8);
//   - an error carries its kind and nothing else. Keycloak's response body can contain an address or
//     a token, and a message that quoted it would put that into a log.

import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';

export type SchoolStaffRole = (typeof SCHOOL_STAFF_ROLES)[number];

export function isSchoolStaffRole(value: string): value is SchoolStaffRole {
  return (SCHOOL_STAFF_ROLES as readonly string[]).includes(value);
}

/** Keycloak's own required-action aliases (§5). */
export type RequiredAction = 'VERIFY_EMAIL' | 'UPDATE_PASSWORD' | 'CONFIGURE_TOTP';

export interface CreateIdpUserInput {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  /** Written to the `tenant_id` attribute the realm maps into the token. */
  readonly tenantId: string;
  readonly roles: readonly SchoolStaffRole[];
  readonly requiredActions: readonly RequiredAction[];
}

export interface IdpUser {
  readonly id: string;
  readonly enabled: boolean;
}

export interface IdentityProviderAdmin {
  /** Creates the user. Refuses (`conflict`) rather than adopting an existing one: a stranger's
   * account with the same address must never be silently taken over. */
  createUser(input: CreateIdpUserInput): Promise<IdpUser>;
  findUserByEmail(email: string): Promise<IdpUser | null>;
  /** Makes the user's school-staff realm roles exactly `roles`. Touches no other role. */
  setRoles(userId: string, roles: readonly SchoolStaffRole[]): Promise<void>;
  setEnabled(userId: string, enabled: boolean): Promise<void>;
  /** Ends every session the user has, so a suspension takes effect now (§6). */
  revokeSessions(userId: string): Promise<void>;
  /** Keycloak's own "execute actions" email — the application sends no email itself (§5). */
  sendActionsEmail(
    userId: string,
    actions: readonly RequiredAction[],
    lifespanSeconds: number,
  ): Promise<void>;
}

export type IdpErrorKind =
  | 'unauthorised' // our credentials were refused: configuration, not the caller's fault
  | 'forbidden' // the service account lacks a role it needs (7b)
  | 'conflict' // the user already exists
  | 'not_found'
  | 'rejected' // Keycloak refused the request as malformed or invalid
  | 'unavailable' // timeout, network failure, 5xx — safe to retry
  | 'invalid_role'; // a role the port will not mirror

export class IdpError extends Error {
  public override readonly name = 'IdpError';
  constructor(public readonly kind: IdpErrorKind) {
    super(`identity provider: ${kind}`);
  }
  /** Worth retrying later. The others need a person or a code change. */
  get retryable(): boolean {
    return this.kind === 'unavailable';
  }
}
