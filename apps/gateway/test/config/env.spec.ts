// Mirrors packages/config/test/env.spec.ts's discipline for the gateway's own,
// narrower loader (see src/config/env.ts for why it is separate).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  GatewayEnvSchema,
  GatewayEnvironmentValidationError,
  parseGatewayEnv,
} from '../../src/config/env.js';

describe('parseGatewayEnv — happy path', () => {
  it('boots with no variables at all, since every field has a safe default', () => {
    const env = parseGatewayEnv({});
    expect(env.GATEWAY_PORT).toBe(8080);
    expect(env.ANTHROPIC_API_KEYS).toBeUndefined();
  });

  it('splits a comma-separated key list and trims whitespace', () => {
    const env = parseGatewayEnv({ ANTHROPIC_API_KEYS: ' key-a, key-b ,key-c' });
    expect(env.ANTHROPIC_API_KEYS).toEqual(['key-a', 'key-b', 'key-c']);
  });
});

describe('parseGatewayEnv — failure paths', () => {
  it('throws when a base URL is malformed', () => {
    expect(() => parseGatewayEnv({ ANTHROPIC_BASE_URL: 'not-a-url' })).toThrow(
      GatewayEnvironmentValidationError,
    );
  });

  it('throws when a key list is present but empty after trimming', () => {
    expect(() => parseGatewayEnv({ OPENAI_API_KEYS: ' , ,' })).toThrow(
      GatewayEnvironmentValidationError,
    );
  });

  it('throws when the port is not a positive integer', () => {
    expect(() => parseGatewayEnv({ GATEWAY_PORT: '-1' })).toThrow(
      GatewayEnvironmentValidationError,
    );
  });
});

describe('apps/gateway/.env.example', () => {
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

  it('documents every variable the gateway schema declares', () => {
    const documented = new Set(lines.map((line) => line.slice(0, line.indexOf('='))));
    for (const name of Object.keys(GatewayEnvSchema.shape)) {
      expect(documented, `${name} is missing from apps/gateway/.env.example`).toContain(
        name,
      );
    }
  });

  it('declares no variable the gateway schema does not know about', () => {
    const declared = new Set(Object.keys(GatewayEnvSchema.shape));
    for (const line of lines) {
      const name = line.slice(0, line.indexOf('='));
      expect(declared, `${name} in .env.example is not in GatewayEnvSchema`).toContain(
        name,
      );
    }
  });
});
