// Stage 00 step 4: the app must crash at boot on a missing or malformed variable.
// Definition of Done (§0.4): happy path plus at least two failure paths.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EnvSchema, EnvironmentValidationError, parseEnv } from '../src/env.js';

const VALID = {
  DATABASE_URL: 'postgresql://app_rw@localhost:5432/infinite_ai',
  REDIS_URL: 'redis://localhost:6379',
} as const;

describe('parseEnv — happy path', () => {
  it('accepts the minimum viable environment and applies documented defaults', () => {
    const env = parseEnv({ ...VALID });

    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_REGION).toBe('local');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.GATEWAY_BASE_URL).toBe('http://localhost:8080');
  });

  it('carries the production data-residency region through unchanged', () => {
    const env = parseEnv({ ...VALID, NODE_ENV: 'production', APP_REGION: 'af-south-1' });

    expect(env.NODE_ENV).toBe('production');
    expect(env.APP_REGION).toBe('af-south-1');
  });
});

describe('parseEnv — failure paths', () => {
  it('throws when a required variable is missing rather than falling back', () => {
    expect(() => parseEnv({ REDIS_URL: VALID.REDIS_URL })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('throws when a variable is present but malformed', () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('rejects a region outside the declared residency set', () => {
    expect(() => parseEnv({ ...VALID, APP_REGION: 'eu-west-1' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('reports every offending variable, not just the first', () => {
    try {
      parseEnv({ DATABASE_URL: 'not-a-url', REDIS_URL: 'also-not-a-url' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      const paths = (error as EnvironmentValidationError).issues.map((issue) =>
        issue.path.join('.'),
      );
      expect(paths).toContain('DATABASE_URL');
      expect(paths).toContain('REDIS_URL');
    }
  });
});

describe('.env.example', () => {
  const examplePath = fileURLToPath(new URL('../../../.env.example', import.meta.url));
  const lines = readFileSync(examplePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  it('contains key names with empty values only (rule 7)', () => {
    for (const line of lines) {
      expect(line, `"${line}" must be of the form NAME=`).toMatch(/^[A-Z0-9_]+=$/);
    }
  });

  it('documents every variable the schema declares', () => {
    const documented = new Set(lines.map((line) => line.slice(0, line.indexOf('='))));
    for (const name of Object.keys(EnvSchema.shape)) {
      expect(documented, `${name} is missing from .env.example`).toContain(name);
    }
  });

  it('declares no variable the schema does not know about', () => {
    const declared = new Set(Object.keys(EnvSchema.shape));
    for (const line of lines) {
      const name = line.slice(0, line.indexOf('='));
      expect(declared, `${name} in .env.example is not in EnvSchema`).toContain(name);
    }
  });
});
