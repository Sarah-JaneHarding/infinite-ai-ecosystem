// loadDatabaseUrl reads DATABASE_URL alone, for the database package's driver adapter and the
// seeds, which must not be made to carry every other variable loadEnv requires.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadDatabaseUrl } from '../src/env.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadDatabaseUrl', () => {
  it('returns a valid PostgreSQL URL without needing any other variable', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://app_rw@localhost:5432/infinite_ai');
    vi.stubEnv('REDIS_URL', '');
    expect(loadDatabaseUrl()).toBe('postgresql://app_rw@localhost:5432/infinite_ai');
  });

  it('throws when DATABASE_URL is not set', () => {
    vi.stubEnv('DATABASE_URL', undefined as unknown as string);
    expect(() => loadDatabaseUrl()).toThrow();
  });

  it('throws for a value that is not a PostgreSQL connection string', () => {
    vi.stubEnv('DATABASE_URL', 'mysql://root@localhost/db');
    expect(() => loadDatabaseUrl()).toThrow(/PostgreSQL/);
  });

  it('throws for an empty value rather than treating it as unset', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(() => loadDatabaseUrl()).toThrow();
  });
});
