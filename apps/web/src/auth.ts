import type { AuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { getWebEnv } from './lib/env';
import type { Role } from '@infinite-ai/policy';
import { resolveSignIn } from './lib/actor-resolution';
import { readOutcome, type SignInOutcome } from './lib/sign-in-outcome';
import { identityFromProfile } from './lib/profile-claims';
import { resolveEligibleRoles } from './lib/role-resolution';
import { readRole, readRoles, rolesFromProfile } from './lib/session-role';

/** Extend next-auth types with our domain fields. */
declare module 'next-auth' {
  interface Session {
    /**
     * The role this session is acting as, or `null` until the person has chosen one (OQ-032):
     * someone eligible for more than one role signs in without a role and reaches only
     * `/choose-role`. Never inferred, never defaulted.
     */
    role: Role | null;
    /** Roles this person may choose from at this sign-in; the server's list, not the client's. */
    eligibleRoles: Role[];
    tenantId: string;
    /**
     * The tenant's own `user_account.id` — the `actorId` for tenant-scoped database reads
     * and the identity a human-gate decision is recorded under (OQ-033). `''` when this
     * person has no active account at their school: pages then show nothing and routes
     * refuse to act. It is never the OIDC `sub`.
     */
    userId: string;
    /**
     * Why this sign-in did or did not resolve an account (`'existing'` / `'linked'` when it did).
     * `null` for a token issued before this existed. Shown to the person as an explanation.
     */
    accountOutcome: SignInOutcome | null;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    /** See `Session.eligibleRoles`. Absent on a token issued before the chooser existed. */
    eligibleRoles?: Role[];
    tenantId?: string;
    /** The resolved `user_account.id`; `''` if none. See `Session.userId`. */
    userId?: string;
    /** See `Session.accountOutcome`. */
    accountOutcome?: SignInOutcome;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: getWebEnv().AUTH_KEYCLOAK_ID,
      clientSecret: getWebEnv().AUTH_KEYCLOAK_SECRET,
      issuer: getWebEnv().AUTH_KEYCLOAK_ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // Fail closed: an account with none of our roles does not get a session at all (the
    // sign-in page shows why). There is no default role — see lib/session-role.ts.
    async signIn({ profile }) {
      return rolesFromProfile(profile).length > 0;
    },
    async jwt({ token, account, profile, trigger, session }) {
      if (account) {
        // Map Keycloak realm_access.roles to our Role enum. `signIn` has already refused
        // an account without one, so none here is a bug, not a user to default.
        const claimRoles = rolesFromProfile(profile);
        if (claimRoles.length === 0)
          throw new Error('Signed in without a recognised role.');
        const tenantId =
          (profile as Record<string, string> | undefined)?.['tenant_id'] ?? '';
        token['tenantId'] = tenantId;
        // The OIDC `sub` proves who signed in; the actor is the school's own account for that
        // subject, resolved once here (OQ-033) — or, on a first sign-in, created from the pending
        // invitation for the verified address (PROVISIONING_DESIGN §4.3). No account → '' → fail
        // closed; the outcome says why, so the person can be told.
        const resolution = await resolveSignIn({
          tenantId,
          subject: profile?.sub ?? token.sub ?? '',
          ...identityFromProfile(profile),
        });
        token['userId'] = resolution.actorId;
        token['accountOutcome'] = resolution.outcome;
        // What this person may act as: the claim and the school's own record must agree for a
        // school staff role (eligible-roles.ts). Exactly one → act as it; otherwise the person
        // chooses on /choose-role, and until then the session has no role at all (§4.8).
        const { eligible } = await resolveEligibleRoles({
          tenantId,
          accountId: resolution.actorId,
          claimRoles,
        });
        token['eligibleRoles'] = [...eligible];
        const only = eligible.length === 1 ? eligible[0] : undefined;
        if (only !== undefined) token['role'] = only;
        else delete token['role'];
      } else if (trigger === 'update') {
        // The chooser's one write. `session` is client-supplied, so it is a request, not a fact:
        // it is honoured only while no role is active yet (no switching without signing in again)
        // and only for a role this token's own server-issued list contains.
        const requested = readRole(
          (session as { role?: unknown } | null | undefined)?.role,
        );
        const allowed = readRoles(token['eligibleRoles']) ?? [];
        if (
          readRole(token['role']) === null &&
          requested !== null &&
          allowed.includes(requested)
        ) {
          token['role'] = requested;
        }
      }
      return token as JWT;
    },
    async session({ session, token }): Promise<Session> {
      // A token without a valid role (issued before this check existed, or malformed) is
      // not a session: next-auth turns a throw here into "signed out" and clears the cookie.
      const role = readRole(token['role']);
      const eligible = readRoles(token['eligibleRoles']);
      // No active role is a session only when the token says the person has yet to choose one.
      if (role === null && eligible === null) {
        throw new Error('Session token carries no recognised role.');
      }
      session.role = role;
      session.eligibleRoles = eligible ?? (role === null ? [] : [role]);
      session.tenantId = (token['tenantId'] as string | undefined) ?? '';
      // Never `token.sub`: a session without a resolved account has no actor (OQ-033).
      session.userId = typeof token['userId'] === 'string' ? token['userId'] : '';
      session.accountOutcome = readOutcome(token['accountOutcome']);
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
};
