// Exercises the exit-gate properties end to end over real HTTP, with the router faked so
// each test controls exactly what "the provider" does — the router's own fallback logic
// is proven separately in test/routing/router.spec.ts.

import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { createLogger, createTracer, type Span } from '@infinite-ai/telemetry';
import type { TenantLexicon } from '@infinite-ai/deident';

import { BudgetTracker } from '../src/budgets/budget.js';
import { GatewayCache } from '../src/cache/cache.js';
import { createGatewayServer, type GatewayServerDeps } from '../src/server.js';
import {
  AllProvidersUnavailableError,
  type StreamedChatEvent,
} from '../src/routing/router.js';

async function* defaultStream(): AsyncGenerator<StreamedChatEvent, void, void> {
  yield { event: { type: 'content', delta: 'A lesson plan.' }, provider: 'anthropic' };
  yield {
    event: {
      type: 'done',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    },
    provider: 'anthropic',
  };
}

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
let routeChatCompletionStream: ReturnType<typeof vi.fn>;
let spanExporter: InMemorySpanExporter;

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
  routeChatCompletionStream = vi.fn().mockImplementation(() => defaultStream());

  spanExporter = new InMemorySpanExporter();
  const tracer = createTracer({
    serviceName: 'test-gateway',
    spanProcessor: new SimpleSpanProcessor(spanExporter),
  });

  const deps: GatewayServerDeps = {
    router: { routeChatCompletion, routeEmbeddings, routeChatCompletionStream },
    budget: new BudgetTracker({ limitsFor: () => undefined }),
    cache: new GatewayCache(),
    resolveLexicon: async () => EMPTY_LEXICON,
    costEstimator: () => 1,
    logger: createLogger({ sink: () => undefined }),
    tracer,
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

describe('POST /v1/chat/completions — streaming', () => {
  it('streams content and done events as Server-Sent Events, then [DONE]', async () => {
    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    const body = await res.text();
    const dataLines = body
      .split('\n\n')
      .filter((chunk) => chunk.startsWith('data:'))
      .map((chunk) => chunk.slice('data:'.length).trim());

    expect(dataLines[dataLines.length - 1]).toBe('[DONE]');
    const events = dataLines
      .slice(0, -1)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'content',
        delta: 'A lesson plan.',
        provider: 'anthropic',
      }),
      expect.objectContaining({
        type: 'done',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      }),
    ]);
    // Every event on one stream shares the same id, so a client can correlate them.
    const ids = new Set(events.map((e) => e.id));
    expect(ids.size).toBe(1);
  });

  it('records budget spend only once the done event reveals usage', async () => {
    const budget = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 1 }) });
    server.close();
    await startAndWait({ budget });

    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    expect(res.status).toBe(200);
    await res.text();

    // costEstimator returns 1 per call in these tests; the done event's usage should have
    // pushed spend to the hard limit.
    expect(
      budget.check({ tenantId: 'tenant-1', module: 'mod-01', agent: 'CE-05' }).allowed,
    ).toBe(false);
  });

  it('reports a typed HTTP error, not an SSE stream, when every provider fails before the first event', async () => {
    const error = new AllProvidersUnavailableError('plan.author', [
      { provider: 'anthropic', reason: 'timeout' },
    ]);
    // Not a `function*`: this stream fails before any event, so there is nothing to
    // yield — it just rejects the first `next()` call.
    routeChatCompletionStream.mockImplementation(
      (): AsyncGenerator<StreamedChatEvent, void, void> => ({
        next: () => Promise.reject(error),
        return: () => Promise.resolve({ done: true, value: undefined }),
        throw: (err: unknown) => Promise.reject(err),
        [Symbol.asyncIterator]() {
          return this;
        },
      }),
    );

    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).not.toBe('text/event-stream');
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'all_providers_unavailable',
    );
  });

  it('reports an in-stream error event when a failure happens after the first event', async () => {
    routeChatCompletionStream.mockImplementation(() => {
      return (async function* (): AsyncGenerator<StreamedChatEvent, void, void> {
        yield { event: { type: 'content', delta: 'partial' }, provider: 'anthropic' };
        throw new Error('provider connection dropped');
      })();
    });

    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    expect(res.status).toBe(200);
    const body = await res.text();
    const dataLines = body
      .split('\n\n')
      .filter((chunk) => chunk.startsWith('data:'))
      .map((chunk) => chunk.slice('data:'.length).trim());
    const events = dataLines
      .slice(0, -1)
      .map((line) => JSON.parse(line) as { type: string });
    expect(events.some((e) => e.type === 'error')).toBe(true);
    expect(dataLines[dataLines.length - 1]).toBe('[DONE]');
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

describe('POST /v1/chat/completions — tracing (Stage 04 step 8)', () => {
  it('records tenant, model, provider, token counts, cost and a cache miss on the span', async () => {
    const res = await post('/v1/chat/completions', baseRequestBody());
    expect(res.status).toBe(200);

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.name).toBe('gateway.chat_completions');
    expect(span?.attributes['tenant.id']).toBe('tenant-1');
    expect(span?.attributes['gateway.model']).toBe('plan.author');
    expect(span?.attributes['gateway.provider']).toBe('anthropic');
    expect(span?.attributes['gateway.cache_hit']).toBe(false);
    expect(span?.attributes['llm.usage.prompt_tokens']).toBe(5);
    expect(span?.attributes['llm.usage.completion_tokens']).toBe(5);
    expect(span?.attributes['gateway.cost_estimate']).toBe(1);
  });

  it('marks the second, cached request as a cache hit on its own span', async () => {
    const request = baseRequestBody();
    await post('/v1/chat/completions', request);
    await post('/v1/chat/completions', request);

    const spans = spanExporter.getFinishedSpans();
    expect(spans[1]?.attributes['gateway.cache_hit']).toBe(true);
  });

  it('records the refusal reason on the span when the PII guard blocks a request', async () => {
    await post('/v1/chat/completions', baseRequestBody({ provenance: undefined }));

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.attributes['gateway.refusal_reason']).toBe('pii_egress_blocked');
  });

  it('records the refusal reason on the span when the budget is exhausted', async () => {
    server.close();
    const budget = new BudgetTracker({ limitsFor: () => ({ hardDailyLimit: 1 }) });
    budget.record({ tenantId: 'tenant-1', module: 'mod-01', agent: 'CE-05' }, 1);
    await startAndWait({ budget });

    await post('/v1/chat/completions', baseRequestBody());

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.attributes['gateway.refusal_reason']).toBe('budget_exceeded');
  });

  it('passes the request span through to the router, so fallback events land on the trace', async () => {
    routeChatCompletion.mockImplementation(
      async (_request: unknown, span?: Span): Promise<unknown> => {
        span?.addEvent('gateway.fallback', {
          provider: 'anthropic',
          reason: 'rate_limited',
        });
        return {
          result: {
            content: 'A lesson plan.',
            usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
          },
          provider: 'openai',
        };
      },
    );

    await post('/v1/chat/completions', baseRequestBody());

    const [span] = spanExporter.getFinishedSpans();
    expect(span?.events.map((e) => e.name)).toEqual(['gateway.fallback']);
    expect(span?.events[0]?.attributes?.provider).toBe('anthropic');
  });

  it('ends exactly one span per streamed request, carrying its final usage and provider', async () => {
    const res = await post('/v1/chat/completions', baseRequestBody({ stream: true }));
    await res.text();

    const spans = spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.attributes['gateway.stream']).toBe(true);
    expect(spans[0]?.attributes['gateway.provider']).toBe('anthropic');
    expect(spans[0]?.attributes['llm.usage.prompt_tokens']).toBe(5);
  });
});

describe('unknown routes', () => {
  it('returns 404 for a route that does not exist', async () => {
    const res = await fetch(`${baseUrl}/v1/nonsense`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
