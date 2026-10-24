import type { AuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { getWebEnv } from './lib/env';
import type { Role } from '@infinite-ai/policy';
import { resolveActorId } from './lib/actor-resolution';
import { readRole, roleFromProfile } from './lib/session-role';

/** Extend next-auth types with our domain fields. */
declare module 'next-auth' {
  interface Session {
    role: Role;
    tenantId: string;
    /**
     * The tenant's own `user_account.id` — the `actorId` for tenant-scoped database reads
     * and the identity a human-gate decision is recorded under (OQ-033). `''` when this
     * person has no active account at their school: pages then show nothing and routes
     * refuse to act. It is never the OIDC `sub`.
     */
    userId: string;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    tenantId?: string;
    /** The resolved `user_account.id`; `''` if none. See `Session.userId`. */
    userId?: string;
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
      return roleFromProfile(profile) !== null;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        // Map Keycloak realm_access.roles to our Role enum. `signIn` has already refused
        // an account without one, so a missing role here is a bug, not a user to default.
        const role = roleFromProfile(profile);
        if (role === null) throw new Error('Signed in without a recognised role.');
        token['role'] = role;
        const tenantId =
          (profile as Record<string, string> | undefined)?.['tenant_id'] ?? '';
        token['tenantId'] = tenantId;
        // The OIDC `sub` proves who signed in; the actor is the school's own account for
        // that subject, resolved once here (OQ-033). No account → '' → fail closed.
        token['userId'] = await resolveActorId({
          tenantId,
          subject: profile?.sub ?? token.sub ?? '',
        });
      }
      return token as JWT;
    },
    async session({ session, token }): Promise<Session> {
      // A token without a valid role (issued before this check existed, or malformed) is
      // not a session: next-auth turns a throw here into "signed out" and clears the cookie.
      const role = readRole(token['role']);
      if (role === null) throw new Error('Session token carries no recognised role.');
      session.role = role;
      session.tenantId = (token['tenantId'] as string | undefined) ?? '';
      // Never `token.sub`: a session without a resolved account has no actor (OQ-033).
      session.userId = typeof token['userId'] === 'string' ? token['userId'] : '';
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
};
