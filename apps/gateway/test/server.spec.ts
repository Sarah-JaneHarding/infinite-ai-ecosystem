// Exercises the exit-gate properties end to end over real HTTP, with the router faked so
// each test controls exactly what "the provider" does — the router's own fallback logic
// is proven separately in test/routing/router.spec.ts.

import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '@infinite-ai/telemetry';
import type { TenantLexicon } from '@infinite-ai/deident';

import { BudgetTracker } from '../src/budgets/budget.js';
import { GatewayCache } from '../src/cache/cache.js';
import { createGatewayServer, type GatewayServerDeps } from '../src/server.js';
import { AllProvidersUnavailableError } from '../src/routing/router.js';

const EMPTY_LEXICON: TenantLexicon = { personNames: [], schoolNames: [] };

const PROVENANCE = { deidentified: true as const, saltVersion: 1, dropped: [] };

function baseRequestBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: 'tenant-1',
    module: 'mod-01',
    agent: 'CE-05',
    model: 'plan.author',
    messages: [{ role: 'user', content: 'Plan a lesson on fractions.' }],
    provenance: PROVENANCE,
    ...overrides,
  };
}

let server: ReturnType<typeof createGatewayServer>;
let baseUrl: string;
let routeChatCompletion: ReturnType<typeof vi.fn>;
let routeEmbeddings: ReturnType<typeof vi.fn>;

function start(overrides: Partial<GatewayServerDeps> = {}): void {
  routeChatCompletion = vi.fn().mockResolvedValue({
    result: {
      content: 'A lesson plan.',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    },
    provider: 'anthropic',
  });
  routeEmbeddings = vi.fn().mockResolvedValue({
    result: { vectors: [[0.1, 0.2]], usage: { promptTokens: 2 } },
    provider: 'openai',
  });

  const deps: GatewayServerDeps = {
    router: { routeChatCompletion, routeEmbeddings },
    budget: new BudgetTracker({ limitsFor: () => undefined }),
    cache: new GatewayCache(),
    resolveLexicon: async () => EMPTY_LEXICON,
    costEstimator: () => 1,
    logger: createLogger({ sink: () => undefined }),
    ...overrides,
  };

  server = createGatewayServer(deps);
  server.listen(0);
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function startAndWait(overrides: Partial<GatewayServerDeps> = {}): Promise<void> {
  start(overrides);
  await new Promise<void>((resolve) => {
    server.once('listening', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

beforeEach(async () => {
  await startAndWait();
});

afterEach(() => {
  server.close();
});

describe('GET /health', () => {
  it('reports ok without touching the router', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /v1/chat/completions — happy path', () => {
  it('routes, returns a completion, and records a cache miss', async () => {
    const res = await post('/v1/chat/completions', baseRequestBody());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cached: boolean; message: { content: string } };
    expect(body.cached).toBe(false);
    expect(body.message.content).toBe('A lesson plan.');
    expect(routeChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('serves an identical request from the cache without calling the router again', async () => {
    const request = baseRequestBody();
    await post('/v1/chat/completions', request);
    const second = await post('/v1/chat/completions', request);

    expect(second.status).toBe(200);
    const body = (await second.json()) as { cached: boolean };
    expect(body.cached).toBe(true);
    expect(routeChatCompletion).toHaveBeenCalledTimes(1);
  });
});

describe('POST /v1/chat/completions — the PII guard runs before anything else', () => {
  it('blocks a request with no de-identification provenance, and never reaches the router', async () => {
    const res = await post(
      '/v1/chat/completions',
      baseRequestBody({ provenance: undefined }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('pii_egress_blocked');
    expect(routeChatCompletion).not.toHaveBeenCalled();
  });

  it('blocks a stamped payload that still contains a raw identifier', async () => {
    const res = await post(
      '/v1/chat/completions',
      baseRequestBody({
        messages: [{ role: 'user', content: 'Learner ID 7501015800086 needs help.' }],
      }),
    );
    expect(res.status).toBe(403);
    expect(routeChatCompletion).not.toHaveBeenCalled();
  });
});

describe('POST /v1/chat/completions — budget is enforced before the call, not after', () => {
  it('refuses once the hard limit is already spent, without invoking the router', async () => {
    server.close();
    const budget = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 1 }) });
    budget.record({ tenantId: 'tenant-1', module: 'mod-01', agent: 'CE-05' }, 1);
    await startAndWait({ budget });

    const res = await post('/v1/chat/completions', baseRequestBody());
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('budget_exceeded');
    expect(routeChatCompletion).not.toHaveBeenCalled();
  });
});

describe('POST /v1/chat/completions — fallback exhaustion and refusals', () => {
  it('reports 503 all_providers_unavailable when the router exhausts its chain', async () => {
    routeChatCompletion.mockRejectedValueOnce(
      new AllProvidersUnavailableError('plan.author', [
        { provider: 'anthropic', reason: 'timeout' },
      ]),
    );
    const res = await post('/v1/chat/completions', baseRequestBody());
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'all_providers_unavailable',
    );
  });

  it('refuses a streaming request with a typed error rather than silently ignoring it', async () => {
    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'invalid_request',
    );
    expect(routeChatCompletion).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a body that fails schema validation', async () => {
    const res = await post('/v1/chat/completions', { tenantId: 'tenant-1' });
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/embeddings', () => {
  it('routes and returns vectors on the happy path', async () => {
    const res = await post('/v1/embeddings', {
      tenantId: 'tenant-1',
      module: 'mod-03',
      agent: 'DW-06',
      model: 'embed.default',
      input: ['fractions', 'decimals'],
      provenance: PROVENANCE,
    });
    expect(res.status).toBe(200);
    expect(routeEmbeddings).toHaveBeenCalledTimes(1);
  });

  it('blocks an embeddings request with no provenance', async () => {
    const res = await post('/v1/embeddings', {
      tenantId: 'tenant-1',
      module: 'mod-03',
      agent: 'DW-06',
      model: 'embed.default',
      input: ['some text'],
    });
    expect(res.status).toBe(403);
    expect(routeEmbeddings).not.toHaveBeenCalled();
  });
});

describe('unknown routes', () => {
  it('returns 404 for a route that does not exist', async () => {
    const res = await fetch(`${baseUrl}/v1/nonsense`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
