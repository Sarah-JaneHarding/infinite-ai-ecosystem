import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach } from 'vitest';
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
