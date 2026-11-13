import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ env: vi.fn(), create: vi.fn() }));
vi.mock('../../src/lib/env', () => ({ getWebEnv: h.env }));
vi.mock('../../src/lib/idp/keycloak-admin', () => ({ createKeycloakAdmin: h.create }));

import {
  getIdentityProvider,
  isIdentityProviderConfigured,
} from '../../src/lib/idp/provider';

const ISSUER = 'https://id.example/realms/infinite-ai';
const base = { AUTH_KEYCLOAK_ISSUER: ISSUER };

beforeEach(() => {
  h.env.mockReset();
  h.create.mockReset();
  h.create.mockImplementation(() => ({ client: Symbol('client') }));
});

describe('getIdentityProvider', () => {
  it.each([
    ['neither variable', {}],
    ['only the id', { KEYCLOAK_PROVISIONER_CLIENT_ID: 'infinite-ai-provisioner' }],
    ['only the secret', { KEYCLOAK_PROVISIONER_CLIENT_SECRET: 'a-secret-value' }],
  ])('is not configured with %s — half a configuration is none', (_label, extra) => {
    h.env.mockReturnValue({ ...base, ...extra });
    expect(getIdentityProvider()).toBeNull();
    expect(isIdentityProviderConfigured()).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('builds one client for the realm issuer and reuses it', () => {
    h.env.mockReturnValue({
      ...base,
      KEYCLOAK_PROVISIONER_CLIENT_ID: 'infinite-ai-provisioner',
      KEYCLOAK_PROVISIONER_CLIENT_SECRET: 'secret-one-value',
    });
    const first = getIdentityProvider();
    expect(first).not.toBeNull();
    expect(getIdentityProvider()).toBe(first);
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create).toHaveBeenCalledWith({
      issuerUrl: ISSUER,
      clientId: 'infinite-ai-provisioner',
      clientSecret: 'secret-one-value',
    });
  });

  it('builds a new client when the client changes', () => {
    h.env.mockReturnValue({
      ...base,
      KEYCLOAK_PROVISIONER_CLIENT_ID: 'another-client',
      KEYCLOAK_PROVISIONER_CLIENT_SECRET: 'secret-one-value',
    });
    getIdentityProvider();
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0]?.[0]).toMatchObject({ clientId: 'another-client' });
  });
});
