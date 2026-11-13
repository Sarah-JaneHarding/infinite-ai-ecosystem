// The identity-provider client for this deployment, or `null` when none is configured (OQ-033 step 7).
// `null` is a supported state, not an error: it is the pilot's by-hand path, where the application never
// touches Keycloak and invitations are never opted in. Both variables must be present; one alone is
// treated as not configured rather than half-configured.

import { getWebEnv } from '@/lib/env';

import { createKeycloakAdmin } from './keycloak-admin';
import type { IdentityProviderAdmin } from './port';

let cached: { readonly key: string; readonly client: IdentityProviderAdmin } | undefined;

export function getIdentityProvider(): IdentityProviderAdmin | null {
  const env = getWebEnv();
  const clientId = env.KEYCLOAK_PROVISIONER_CLIENT_ID;
  const clientSecret = env.KEYCLOAK_PROVISIONER_CLIENT_SECRET;
  if (clientId === undefined || clientSecret === undefined) return null;
  const key = `${env.AUTH_KEYCLOAK_ISSUER}|${clientId}|${clientSecret.length}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: createKeycloakAdmin({
        issuerUrl: env.AUTH_KEYCLOAK_ISSUER,
        clientId,
        clientSecret,
      }),
    };
  }
  return cached.client;
}

export const isIdentityProviderConfigured = (): boolean => getIdentityProvider() !== null;
