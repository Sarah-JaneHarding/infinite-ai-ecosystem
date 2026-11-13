// An in-memory `IdentityProviderAdmin`, so the code that uses the port is tested without Keycloak.
// It enforces the same refusals the real client does (conflict, invalid role) and can be told to
// fail, so a caller's error handling is exercised rather than assumed.

import {
  IdpError,
  isSchoolStaffRole,
  type CreateIdpUserInput,
  type IdentityProviderAdmin,
  type IdpErrorKind,
  type IdpUser,
  type RequiredAction,
  type SchoolStaffRole,
} from '../../src/lib/idp/port';

export interface FakeIdpUser {
  id: string;
  email: string;
  enabled: boolean;
  tenantId: string;
  roles: SchoolStaffRole[];
  requiredActions: RequiredAction[];
  sessionsRevoked: number;
  emailsSent: { actions: RequiredAction[]; lifespanSeconds: number }[];
}

export interface FakeIdp extends IdentityProviderAdmin {
  readonly users: Map<string, FakeIdpUser>;
  readonly calls: string[];
  /** Makes the next call to `method` throw an `IdpError` of this kind (once). */
  failNext(method: keyof IdentityProviderAdmin, kind: IdpErrorKind): void;
}

export function createFakeIdp(): FakeIdp {
  const users = new Map<string, FakeIdpUser>();
  const calls: string[] = [];
  const failures = new Map<string, IdpErrorKind>();
  let counter = 0;

  function enter(method: string): void {
    calls.push(method);
    const kind = failures.get(method);
    if (kind !== undefined) {
      failures.delete(method);
      throw new IdpError(kind);
    }
  }
  const byEmail = (email: string): FakeIdpUser | undefined =>
    [...users.values()].find((u) => u.email === email.toLowerCase());
  const get = (id: string): FakeIdpUser => {
    const user = users.get(id);
    if (user === undefined) throw new IdpError('not_found');
    return user;
  };
  const view = (u: FakeIdpUser): IdpUser => ({ id: u.id, enabled: u.enabled });

  return {
    users,
    calls,
    failNext: (method, kind) => void failures.set(method, kind),
    async createUser(input: CreateIdpUserInput) {
      enter('createUser');
      if (byEmail(input.email) !== undefined) throw new IdpError('conflict');
      counter += 1;
      const user: FakeIdpUser = {
        id: `kc-${String(counter).padStart(4, '0')}`,
        email: input.email.toLowerCase(),
        enabled: true,
        tenantId: input.tenantId,
        roles: [],
        requiredActions: [...input.requiredActions],
        sessionsRevoked: 0,
        emailsSent: [],
      };
      users.set(user.id, user);
      return view(user);
    },
    async findUserByEmail(email) {
      enter('findUserByEmail');
      const user = byEmail(email);
      return user === undefined ? null : view(user);
    },
    async setRoles(userId, roles) {
      enter('setRoles');
      if (!roles.every(isSchoolStaffRole)) throw new IdpError('invalid_role');
      get(userId).roles = [...roles];
    },
    async setEnabled(userId, enabled) {
      enter('setEnabled');
      get(userId).enabled = enabled;
    },
    async revokeSessions(userId) {
      enter('revokeSessions');
      get(userId).sessionsRevoked += 1;
    },
    async sendActionsEmail(userId, actions, lifespanSeconds) {
      enter('sendActionsEmail');
      get(userId).emailsSent.push({ actions: [...actions], lifespanSeconds });
    },
  };
}
