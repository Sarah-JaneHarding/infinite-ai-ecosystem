import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  ProductionRealmError,
  isLoopbackUri,
  toProductionRealm,
} from '../src/keycloak-production-realm.js';

// OQ-060: `infra/keycloak/realm.json` is a development fixture with eleven `*.dev` users (two of them
// administrators) and a localhost redirect. OQ-036 said production "must be created from this file", and
// nothing removed those users first. `realm.production.json` is the file that is safe to import, derived by
// `toProductionRealm`. These tests make that a checked rule, not a step someone has to remember.

interface RealmShape {
  users: { username: string; serviceAccountClientId?: string }[];
  clients: { clientId: string; redirectUris?: string[]; webOrigins?: string[] }[];
  authenticationFlows?: { alias: string }[];
  [key: string]: unknown;
}

const dir = join(__dirname, '..', '..', '..', 'infra', 'keycloak');
const read = (name: string): string => readFileSync(join(dir, name), 'utf8');
const dev = JSON.parse(read('realm.json')) as RealmShape;
const prodText = read('realm.production.json');
const prod = JSON.parse(prodText) as RealmShape;

const isService = (u: { serviceAccountClientId?: string }): boolean =>
  u.serviceAccountClientId !== undefined;

describe('the committed production realm file', () => {
  it('contains no person: only service accounts, and no *.dev user', () => {
    expect(prod.users.length).toBeGreaterThan(0);
    for (const u of prod.users) {
      expect(isService(u), `${u.username} is a person in the production file`).toBe(true);
      expect(u.username.endsWith('.dev')).toBe(false);
    }
  });

  it('keeps the provisioner service account exactly as the dev file defines it', () => {
    const devAccount = dev.users.find(isService);
    expect(devAccount).toBeDefined();
    expect(prod.users).toEqual([devAccount]);
  });

  it('has no loopback redirect URI or web origin on any client, and keeps the real-domain ones', () => {
    for (const c of prod.clients) {
      for (const uri of [...(c.redirectUris ?? []), ...(c.webOrigins ?? [])]) {
        expect(isLoopbackUri(uri), `${c.clientId}: ${uri}`).toBe(false);
      }
    }
    const web = prod.clients.find((c) => c.clientId === 'infinite-ai-web');
    expect(web?.redirectUris?.length ?? 0).toBeGreaterThan(0);
    expect(web?.webOrigins?.length ?? 0).toBeGreaterThan(0);
  });

  it('does not need the dev sign-in password: the placeholder is gone', () => {
    expect(prodText).not.toContain('SEED_USER_PASSWORD');
  });

  it('is identical to the dev file in everything except users and loopback URIs', () => {
    const strip = (r: RealmShape): unknown => ({
      ...r,
      users: [],
      clients: r.clients.map((c) => ({
        ...c,
        redirectUris: undefined,
        webOrigins: undefined,
      })),
    });
    expect(JSON.parse(JSON.stringify(strip(prod)))).toEqual(
      JSON.parse(JSON.stringify(strip(dev))),
    );
  });

  it('still carries every MFA sub-flow the dev realm has, hod included', () => {
    const otp = (r: RealmShape): string[] =>
      (r.authenticationFlows ?? [])
        .map((f) => f.alias)
        .filter((a) => a.startsWith('browser-mfa otp '))
        .sort();
    expect(otp(prod)).toEqual(otp(dev));
    expect(otp(prod)).toContain('browser-mfa otp hod');
  });

  it('is exactly what the generator produces from realm.json today (drift guard)', () => {
    expect(prod).toEqual(JSON.parse(JSON.stringify(toProductionRealm(dev))));
  });
});

describe('toProductionRealm', () => {
  const base = (): RealmShape => ({
    users: [
      { username: 'service-account-x', serviceAccountClientId: 'x' },
      { username: 'alice' },
      { username: 'admin.dev' },
    ],
    clients: [
      {
        clientId: 'web',
        redirectUris: ['http://localhost:3000/*', 'https://app.example.test/*'],
        webOrigins: ['http://localhost:3000', 'https://app.example.test'],
      },
      { clientId: 'svc' },
    ],
    realm: 'r',
  });

  it('removes every person, whatever they are called: the rule is not a name match', () => {
    const out = toProductionRealm(base()) as unknown as RealmShape;
    expect(out.users.map((u) => u.username)).toEqual(['service-account-x']);
  });

  it('removes loopback URIs and origins and keeps the rest, leaving other fields alone', () => {
    const out = toProductionRealm(base()) as unknown as RealmShape;
    expect(out.clients[0]).toEqual({
      clientId: 'web',
      redirectUris: ['https://app.example.test/*'],
      webOrigins: ['https://app.example.test'],
    });
    expect(out.clients[1]).toEqual({ clientId: 'svc' });
    expect(out.realm).toBe('r');
  });

  it('does not change its input, and is idempotent', () => {
    const input = base();
    const snapshot = JSON.stringify(input);
    const once = toProductionRealm(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(toProductionRealm(once)).toEqual(once);
  });

  it('refuses a realm with no service account rather than drop the provisioner roles', () => {
    const input = base();
    input.users = [{ username: 'alice' }];
    expect(() => toProductionRealm(input)).toThrow(ProductionRealmError);
  });

  it('refuses a client whose only redirect URIs are loopback, and invents no domain', () => {
    const input = base();
    input.clients = [{ clientId: 'web', redirectUris: ['http://localhost:3000/*'] }];
    expect(() => toProductionRealm(input)).toThrow(/only loopback redirect URIs/);
  });

  it('rejects input that is not a realm file', () => {
    expect(() => toProductionRealm(null)).toThrow(ZodError);
    expect(() => toProductionRealm({})).toThrow(ZodError);
    expect(() => toProductionRealm({ users: 'x', clients: [] })).toThrow(ZodError);
  });
});

describe('isLoopbackUri', () => {
  it.each([
    'http://localhost:3000/*',
    'https://localhost/cb',
    'http://LOCALHOST:3000',
    'http://127.0.0.1:8080/cb',
    'http://[::1]:3000',
    'http://localhost',
  ])('treats %s as loopback', (uri) => {
    expect(isLoopbackUri(uri)).toBe(true);
  });

  it.each([
    'https://app.infinite-ai.co.za/*',
    'https://*.infinite-ai.co.za',
    'https://localhost.evil.example/cb',
    'https://notlocalhost.example',
    'http://localhost@evil.example/cb',
    'https://127.0.0.1.evil.example',
  ])('does not treat %s as loopback', (uri) => {
    expect(isLoopbackUri(uri)).toBe(false);
  });
});
