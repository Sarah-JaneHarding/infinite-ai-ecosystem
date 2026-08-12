import type { AuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { getWebEnv } from './lib/env';
import type { Role } from '@infinite-ai/policy';

/** Extend next-auth types with our domain fields. */
declare module 'next-auth' {
  interface Session {
    role: Role;
    tenantId: string;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    tenantId?: string;
  }
}

const VALID_ROLES: ReadonlySet<string> = new Set([
  'teacher',
  'hod',
  'smt',
  'sbst',
  'admin',
  'guardian',
  'learner',
  'platform_support',
  'platform_admin',
]);

function parseRole(raw: unknown): Role {
  if (typeof raw === 'string' && VALID_ROLES.has(raw)) return raw as Role;
  return 'teacher';
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
    async jwt({ token, account, profile }) {
      if (account) {
        // Map Keycloak realm_access.roles to our Role enum.
        const rawRoles = (profile as Record<string, unknown> | undefined)?.[
          'realm_access'
        ];
        const roles = (rawRoles as { roles?: unknown[] } | undefined)?.roles ?? [];
        const matched = roles.find(
          (r): r is string => typeof r === 'string' && VALID_ROLES.has(r),
        );
        token['role'] = parseRole(matched);
        token['tenantId'] =
          (profile as Record<string, string> | undefined)?.['tenant_id'] ?? '';
      }
      return token as JWT;
    },
    async session({ session, token }): Promise<Session> {
      session.role = parseRole(token['role']);
      session.tenantId = (token['tenantId'] as string | undefined) ?? '';
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
};
