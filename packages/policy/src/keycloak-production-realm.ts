// Derives the PRODUCTION Keycloak realm file from the development one (OQ-036 / OQ-060).
//
// `infra/keycloak/realm.json` is a development fixture: it defines eleven `*.dev` sign-in users,
// including `admin.dev` (role `admin`) and `platform-admin.dev`, each with an initial password
// taken from an environment variable, and a client redirect to `http://localhost:3000`. OQ-036 said the
// production realm "must be created from this file", and nothing removed those users first, so
// importing the file unchanged would have created real administrator accounts in production.
//
// This function is the rule, in code, so it is not a step someone has to remember:
//
//   - Every user is removed EXCEPT a service account (one with `serviceAccountClientId`). Real people
//     come in through the application's invitation flow, never from a file. The provisioner's service
//     account is kept because it carries the user-management roles the invitation flow depends on.
//   - Loopback redirect URIs and web origins (`localhost`, `127.0.0.1`, `[::1]`) are removed from every
//     client. The real-domain entries stay.
//   - Nothing else changes: the MFA flows, required actions, roles, password policy and clients are
//     carried over untouched, and a test fails if the two files drift apart in anything else.
//
// It refuses (throws) rather than guess when the result would be unusable: no service account to keep,
// or a client whose only redirect URIs were loopback ones. No production domain is invented here.

import { z } from 'zod';

const Client = z.looseObject({
  clientId: z.string(),
  redirectUris: z.array(z.string()).optional(),
  webOrigins: z.array(z.string()).optional(),
});

const User = z.looseObject({
  username: z.string(),
  serviceAccountClientId: z.string().optional(),
});

const RealmFile = z.looseObject({
  users: z.array(User),
  clients: z.array(Client),
});

export class ProductionRealmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionRealmError';
  }
}

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i;

/** True for a loopback URI or origin, which has no place in a production realm. */
export function isLoopbackUri(uri: string): boolean {
  return LOOPBACK.test(uri.trim());
}

export function toProductionRealm(raw: unknown): Record<string, unknown> {
  const realm = RealmFile.parse(raw);

  const serviceAccounts = realm.users.filter(
    (u) => u.serviceAccountClientId !== undefined,
  );
  if (serviceAccounts.length === 0) {
    throw new ProductionRealmError(
      'The realm has no service-account user, so the production realm would lose the ' +
        "provisioner's user-management roles. Refusing to produce it.",
    );
  }

  const clients = realm.clients.map((client) => {
    const hadRedirects = (client.redirectUris ?? []).length > 0;
    const redirectUris = client.redirectUris?.filter((u) => !isLoopbackUri(u));
    const webOrigins = client.webOrigins?.filter((u) => !isLoopbackUri(u));
    if (hadRedirects && (redirectUris?.length ?? 0) === 0) {
      throw new ProductionRealmError(
        `Client "${client.clientId}" has only loopback redirect URIs, so it would have none ` +
          'in production. Add its real redirect URI to the development file first.',
      );
    }
    return {
      ...client,
      ...(redirectUris === undefined ? {} : { redirectUris }),
      ...(webOrigins === undefined ? {} : { webOrigins }),
    };
  });

  return { ...realm, users: serviceAccounts, clients };
}
