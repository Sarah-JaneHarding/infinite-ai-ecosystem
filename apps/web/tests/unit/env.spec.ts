import { describe, it, expect, beforeEach } from 'vitest';
import { resetEnvCacheForTesting, getWebEnv } from '../../src/lib/env.js';

describe('getWebEnv', () => {
  beforeEach(() => {
    resetEnvCacheForTesting();
    // Vitest already sets NODE_ENV=test; no assignment needed.
  });

  it('returns a valid env object in test mode', () => {
    const env = getWebEnv();
    expect(env.NEXTAUTH_SECRET).toBeTruthy();
    expect(env.AUTH_KEYCLOAK_ISSUER).toMatch(/^http/);
  });

  it('caches the result across calls', () => {
    const first = getWebEnv();
    const second = getWebEnv();
    expect(first).toBe(second);
  });

  it('returns fresh object after cache reset', () => {
    const first = getWebEnv();
    resetEnvCacheForTesting();
    const second = getWebEnv();
    expect(first).not.toBe(second);
  });
});
