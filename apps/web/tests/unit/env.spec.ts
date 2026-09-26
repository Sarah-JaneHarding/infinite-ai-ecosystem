import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetEnvCacheForTesting, getWebEnv, WebEnvSchema } from '../../src/lib/env.js';

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

// The real validation boundary — Stage 8 (repository audit follow-through, Task 15).
//
// getWebEnv() short-circuits to a fixed TEST_ENV whenever NODE_ENV==='test' (see
// src/lib/env.ts), which every other test in this file relies on and which is exactly why
// none of them ever reach WebEnvSchema.safeParse(process.env). That leaves the schema's own
// constraints (NEXTAUTH_SECRET's min(32), the two .url() fields, the NODE_ENV enum) and the
// production throw-on-invalid-env path with zero coverage — the same "business logic well
// tested, validation boundary untested" gap found in packages/compliance.
describe('WebEnvSchema', () => {
  it('rejects a NEXTAUTH_SECRET shorter than 32 characters', () => {
    const result = WebEnvSchema.safeParse({ NEXTAUTH_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed NEXTAUTH_URL', () => {
    const result = WebEnvSchema.safeParse({
      NEXTAUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed AUTH_KEYCLOAK_ISSUER', () => {
    const result = WebEnvSchema.safeParse({
      NEXTAUTH_SECRET: 'a'.repeat(32),
      AUTH_KEYCLOAK_ISSUER: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a NODE_ENV value outside development/test/production', () => {
    const result = WebEnvSchema.safeParse({
      NEXTAUTH_SECRET: 'a'.repeat(32),
      NODE_ENV: 'staging',
    });
    expect(result.success).toBe(false);
  });

  it('accepts the minimum valid input (secret only, everything else defaulted)', () => {
    const result = WebEnvSchema.safeParse({ NEXTAUTH_SECRET: 'a'.repeat(32) });
    expect(result.success).toBe(true);
  });
});

describe('getWebEnv (production validation-failure path)', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalSecret === undefined) {
      delete process.env['NEXTAUTH_SECRET'];
    } else {
      process.env['NEXTAUTH_SECRET'] = originalSecret;
    }
    resetEnvCacheForTesting();
  });

  it('throws a descriptive error when the environment fails schema validation', () => {
    resetEnvCacheForTesting();
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env['NEXTAUTH_SECRET'];
    expect(() => getWebEnv()).toThrow(/Web environment invalid/);
  });
});

describe('apps/web/.env.example', () => {
  const examplePath = fileURLToPath(new URL('../../.env.example', import.meta.url));
  const lines = readFileSync(examplePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  it('contains key names with empty values only (rule 7)', () => {
    for (const line of lines) {
      expect(line, `"${line}" must be of the form NAME=`).toMatch(/^[A-Z0-9_]+=$/);
    }
  });

  it('documents every variable the web schema declares', () => {
    const documented = new Set(lines.map((line) => line.slice(0, line.indexOf('='))));
    for (const name of Object.keys(WebEnvSchema.shape)) {
      expect(documented, `${name} is missing from apps/web/.env.example`).toContain(name);
    }
  });

  it('declares no variable the web schema does not know about', () => {
    const declared = new Set(Object.keys(WebEnvSchema.shape));
    for (const line of lines) {
      const name = line.slice(0, line.indexOf('='));
      expect(declared, `${name} in .env.example is not in WebEnvSchema`).toContain(name);
    }
  });
});
