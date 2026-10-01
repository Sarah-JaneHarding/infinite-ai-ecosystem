import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseEnv } from '@infinite-ai/config';
import { InvalidTenantContextError } from '@infinite-ai/db';
import { NOOP_TRACER } from '@infinite-ai/telemetry';

import {
  boot,
  buildAdapters,
  buildLexiconResolver,
  buildTracer,
  failClosedLexicon,
  GATEWAY_SERVICE_ACTOR_ID,
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

  it('adds google when its keys are set', () => {
    const env = parseGatewayEnv({ GOOGLE_API_KEYS: 'k1' });
    const { adapters, credentialPools } = buildAdapters(env, noopFetch);
    expect(adapters.google?.provider).toBe('google');
    expect(credentialPools.google?.availableCount()).toBe(1);
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

describe('buildLexiconResolver — the real tenant-scoped read', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // `withTenant` validates the tenant and actor ids BEFORE it touches the database, so the
  // real resolver can be exercised here without Postgres. This is the check the mocked
  // resolvers elsewhere could not make: with an actor id that is not a valid UUID, every
  // lexicon lookup — and therefore every gateway request — died before reaching a provider.
  it('uses a service actor id that withTenant accepts', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://nobody:none@127.0.0.1:1/none');
    const resolver = buildLexiconResolver(
      parseEnv({
        DATABASE_URL: 'postgresql://nobody:none@127.0.0.1:1/none',
        REDIS_URL: 'redis://x',
        DB_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
      }),
    );

    const failure = await resolver('10000000-0000-4000-8000-000000000001').then(
      () => undefined,
      (error: unknown) => error,
    );

    // It may fail — nothing is listening on that port — but never on its own identity.
    expect(failure).not.toBeInstanceOf(InvalidTenantContextError);
  }, 30_000);

  it('rejects a tenant id that is not a UUID, before any database access', async () => {
    const resolver = buildLexiconResolver(
      parseEnv({
        DATABASE_URL: 'postgresql://x/y',
        REDIS_URL: 'redis://x',
        DB_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
      }),
    );

    await expect(resolver("1' OR '1'='1")).rejects.toBeInstanceOf(
      InvalidTenantContextError,
    );
  });

  it('keeps the service actor id in the RFC UUID shape', () => {
    expect(GATEWAY_SERVICE_ACTOR_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('buildTracer', () => {
  it('returns the no-op tracer when OTEL_EXPORTER_OTLP_ENDPOINT is not configured', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://x/y',
      REDIS_URL: 'redis://x',
    });
    expect(buildTracer(env)).toBe(NOOP_TRACER);
  });

  it('builds a real, exporting tracer once an OTLP endpoint is configured', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://x/y',
      REDIS_URL: 'redis://x',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://langfuse.example/api/public/otel',
      OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Basic abc123',
    });
    const tracer = buildTracer(env);
    expect(tracer).not.toBe(NOOP_TRACER);
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
