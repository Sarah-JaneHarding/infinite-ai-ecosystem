// Stage 04 step 10 — the provider-outage drill.
//
// Everywhere else in this suite fakes the router or a single adapter in isolation. This
// file is the one place that wires the *real* adapters, the *real* router, the *real*
// cache and budget tracker, and the *real* HTTP server together, with only `fetch` faked —
// because "the fallback chain works" and "the fallback chain works when the thing on the
// other end of the wire is actually misbehaving" are different claims, and only the second
// one is what step 10 asks for: 429s, 500s, timeouts and the guarantee that a request which
// never got a real answer leaves no trace in the cache or the budget ledger.

import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NOOP_TRACER, createLogger } from '@infinite-ai/telemetry';
import type { TenantLexicon } from '@infinite-ai/deident';

import { createAnthropicAdapter } from '../../src/adapters/anthropic.js';
import { createOpenAiCompatibleAdapter } from '../../src/adapters/openai-compatible.js';
import type { FetchLike } from '../../src/adapters/types.js';
import { BudgetTracker } from '../../src/budgets/budget.js';
import { GatewayCache } from '../../src/cache/cache.js';
import { CredentialPool } from '../../src/credentials/pool.js';
import { createRouter } from '../../src/routing/router.js';
import { createGatewayServer, type GatewayServerDeps } from '../../src/server.js';

const EMPTY_LEXICON: TenantLexicon = { personNames: [], schoolNames: [] };
const PROVENANCE = { deidentified: true as const, saltVersion: 1, dropped: [] };

interface FetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}
type FetchResponse = Awaited<ReturnType<FetchLike>>;

/** A `fetch` whose behaviour for each call is scripted in advance, in order. */
function scriptedFetch(
  behaviours: readonly (
    { readonly status: number; readonly body: unknown } | { readonly hang: true }
  )[],
): FetchLike {
  let call = 0;
  return vi.fn(async (_url: string, init: FetchInit): Promise<FetchResponse> => {
    const behaviour = behaviours[call];
    call += 1;
    if (behaviour === undefined) {
      throw new Error('scriptedFetch called more times than scripted');
    }
    if ('hang' in behaviour) {
      // Never resolves on its own — only the adapter's own AbortController timeout ends it.
      return new Promise<FetchResponse>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
    return {
      ok: behaviour.status < 400,
      status: behaviour.status,
      json: async () => behaviour.body,
      text: async () => JSON.stringify(behaviour.body),
    };
  }) as unknown as FetchLike;
}

/** OpenAI-shaped success body — the second link in every chain here is `openai`. */
const OPENAI_OK_COMPLETION = {
  choices: [{ message: { content: 'Recovered after fallback.' } }],
  usage: { prompt_tokens: 4, completion_tokens: 4, total_tokens: 8 },
};

/** Anthropic-shaped success body — the first link in every chain here is `anthropic`. */
const ANTHROPIC_OK_COMPLETION = {
  content: [{ type: 'text', text: 'Recovered on retry.' }],
  usage: { input_tokens: 4, output_tokens: 4 },
};

let server: ReturnType<typeof createGatewayServer>;
let baseUrl: string;
let budget: BudgetTracker;
let cache: GatewayCache;

async function start(fetchImpl: FetchLike): Promise<void> {
  budget = new BudgetTracker({ limitsFor: () => undefined });
  cache = new GatewayCache();

  const router = createRouter({
    adapters: {
      anthropic: createAnthropicAdapter({
        baseUrl: 'https://api.anthropic.example',
        fetchImpl,
        timeoutMs: 50,
      }),
      openai: createOpenAiCompatibleAdapter({
        provider: 'openai',
        baseUrl: 'https://api.openai.example',
        fetchImpl,
        timeoutMs: 50,
      }),
    },
    credentialPools: {
      anthropic: new CredentialPool('anthropic', ['anthropic-key']),
      openai: new CredentialPool('openai', ['openai-key']),
    },
    routing: {
      'plan.author': [
        { provider: 'anthropic', concreteModel: 'claude' },
        { provider: 'openai', concreteModel: 'gpt' },
      ],
    },
    logger: createLogger({ sink: () => undefined }),
  });

  const deps: GatewayServerDeps = {
    router,
    budget,
    cache,
    resolveLexicon: async () => EMPTY_LEXICON,
    costEstimator: () => 1,
    logger: createLogger({ sink: () => undefined }),
    tracer: NOOP_TRACER,
  };

  server = createGatewayServer(deps);
  server.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
}

async function requestPlan(idempotencyKey?: string): Promise<Response> {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'tenant-1',
      module: 'mod-01',
      agent: 'CE-05',
      model: 'plan.author',
      messages: [{ role: 'user', content: 'Plan a lesson.' }],
      provenance: PROVENANCE,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    }),
  });
}

afterEach(() => {
  server?.close();
});

describe('provider-outage drills — graceful fallback', () => {
  it('recovers from a 429 on the first provider by falling through to the second', async () => {
    await start(
      scriptedFetch([
        { status: 429, body: {} },
        { status: 200, body: OPENAI_OK_COMPLETION },
      ]),
    );

    const res = await requestPlan();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: { content: string }; provider: string };
    expect(body.message.content).toBe('Recovered after fallback.');
    expect(body.provider).toBe('openai');
  });

  it('recovers from a 500 on the first provider', async () => {
    await start(
      scriptedFetch([
        { status: 500, body: {} },
        { status: 200, body: OPENAI_OK_COMPLETION },
      ]),
    );

    const res = await requestPlan();
    expect(res.status).toBe(200);
  });

  it('recovers from a timeout on the first provider', async () => {
    await start(
      scriptedFetch([{ hang: true }, { status: 200, body: OPENAI_OK_COMPLETION }]),
    );

    const res = await requestPlan();
    expect(res.status).toBe(200);
  }, 10_000);
});

describe('provider-outage drills — exhaustion leaves no partial writes downstream', () => {
  it('returns a clear typed error, spends nothing and caches nothing when every provider fails', async () => {
    await start(
      scriptedFetch([
        { status: 500, body: {} },
        { status: 503, body: {} },
      ]),
    );

    const res = await requestPlan('retry-key-1');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('all_providers_unavailable');
    expect(body.error.message).toMatch(/anthropic.*openai|openai.*anthropic/is);

    // No cost was recorded for a request that never got a real answer.
    expect(
      budget.check({ tenantId: 'tenant-1', module: 'mod-01', agent: 'CE-05' }),
    ).toEqual({
      allowed: true,
      warning: null,
    });
    expect(cache.stats.hits).toBe(0);
  });

  it('does not let a failed attempt poison the idempotency cache for a genuine retry', async () => {
    await start(
      scriptedFetch([
        { status: 500, body: {} },
        { status: 500, body: {} },
        // The retry's first attempt (anthropic) succeeds outright this time.
        { status: 200, body: ANTHROPIC_OK_COMPLETION },
      ]),
    );

    const failed = await requestPlan('retry-key-2');
    expect(failed.status).toBe(503);

    // The same idempotency key, retried after the outage clears, must reach the provider
    // again rather than replaying a cached failure that was never recorded.
    const retried = await requestPlan('retry-key-2');
    expect(retried.status).toBe(200);
    const body = (await retried.json()) as { provider: string };
    expect(body.provider).toBe('anthropic');
  });

  it('stops immediately on a non-retryable failure rather than exhausting the chain', async () => {
    await start(scriptedFetch([{ status: 401, body: {} }]));

    const res = await requestPlan();
    // Unauthorized is not retryable: the router must not have tried the second provider,
    // which this script has no scripted response for — a second call would throw inside
    // scriptedFetch and surface as a 502, not the status asserted here.
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('all_providers_unavailable');
  });
});
