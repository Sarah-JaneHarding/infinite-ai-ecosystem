import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseEnv } from '@infinite-ai/config';

import {
  boot,
  buildAdapters,
  buildLexiconResolver,
  failClosedLexicon,
  loadRouting,
} from '../src/index.js';
import { parseGatewayEnv } from '../src/config/env.js';
import { DEFAULT_ROUTING_CONFIG } from '../src/routing/config.js';

const VALID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const noopFetch = (async () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
})) as Parameters<typeof buildAdapters>[1];

describe('buildAdapters', () => {
  it('adds nothing when no provider credentials are configured', () => {
    const { adapters, credentialPools } = buildAdapters(parseGatewayEnv({}), noopFetch);
    expect(Object.keys(adapters)).toEqual([]);
    expect(Object.keys(credentialPools)).toEqual([]);
  });

  it('adds anthropic when its keys are set', () => {
    const env = parseGatewayEnv({ ANTHROPIC_API_KEYS: 'k1,k2' });
    const { adapters, credentialPools } = buildAdapters(env, noopFetch);
    expect(adapters.anthropic?.provider).toBe('anthropic');
    expect(credentialPools.anthropic?.availableCount()).toBe(2);
  });

  it('adds openai when its keys are set', () => {
    const env = parseGatewayEnv({ OPENAI_API_KEYS: 'k1' });
    const { adapters } = buildAdapters(env, noopFetch);
    expect(adapters.openai?.provider).toBe('openai');
  });

  it('adds the local adapter only when both its base URL and its keys are set', () => {
    const missingKeys = buildAdapters(
      parseGatewayEnv({ LOCAL_MODEL_BASE_URL: 'http://localhost:9000' }),
      noopFetch,
    );
    expect(missingKeys.adapters.local).toBeUndefined();

    const complete = buildAdapters(
      parseGatewayEnv({
        LOCAL_MODEL_BASE_URL: 'http://localhost:9000',
        LOCAL_MODEL_API_KEYS: 'k1',
      }),
      noopFetch,
    );
    expect(complete.adapters.local?.provider).toBe('local');
  });
});

describe('loadRouting', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'gateway-routing-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to the built-in default when no path is configured', () => {
    expect(loadRouting(parseGatewayEnv({}))).toEqual(DEFAULT_ROUTING_CONFIG);
  });

  it('loads and validates a routing file from disk when a path is configured', () => {
    const file = path.join(dir, 'routing.json');
    writeFileSync(
      file,
      JSON.stringify({
        'plan.author': [{ provider: 'anthropic', concreteModel: 'claude' }],
      }),
    );
    const routing = loadRouting(parseGatewayEnv({ ROUTING_CONFIG_PATH: file }));
    expect(routing['plan.author']).toEqual([
      { provider: 'anthropic', concreteModel: 'claude' },
    ]);
  });
});

describe('buildLexiconResolver', () => {
  it('fails closed when DB_ENCRYPTION_KEY is not configured', () => {
    const resolver = buildLexiconResolver(
      parseEnv({ DATABASE_URL: 'postgresql://x/y', REDIS_URL: 'redis://x' }),
    );
    expect(resolver).toBe(failClosedLexicon);
  });

  it('builds a real resolver, distinct from the fail-closed default, once a key is configured', () => {
    // Does not invoke the resolver — that opens a real database connection via
    // packages/db's withTenant(), which needs Postgres and belongs in db's own
    // Testcontainers suite (packages/db/test/lexicon.integration.spec.ts), not here.
    const resolver = buildLexiconResolver(
      parseEnv({
        DATABASE_URL: 'postgresql://x/y',
        REDIS_URL: 'redis://x',
        DB_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
      }),
    );
    expect(resolver).not.toBe(failClosedLexicon);
    expect(typeof resolver).toBe('function');
  });
});

describe('boot', () => {
  it('wires a listenable server from an explicitly supplied environment', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://app_rw@localhost:5432/infinite_ai',
      REDIS_URL: 'redis://localhost:6379',
    });
    const gatewayEnv = parseGatewayEnv({ ANTHROPIC_API_KEYS: 'test-key-for-boot' });

    const server = boot(env, gatewayEnv);
    expect(typeof server.listen).toBe('function');
    server.close();
  });
});
