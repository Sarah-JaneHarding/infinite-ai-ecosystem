import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { createTracer } from '@infinite-ai/telemetry';
import { CircuitBreaker } from '../../src/circuit-breaker.js';
import { CredentialPool } from '../../src/credentials/pool.js';
import {
  AllProvidersUnavailableError,
  UnknownLogicalModelError,
  createRouter,
} from '../../src/routing/router.js';
import {
  AdapterError,
  type AdapterStreamEvent,
  type ProviderAdapter,
} from '../../src/adapters/types.js';

const request: ChatCompletionRequest = {
  tenantId: 'tenant-1',
  module: 'mod-01',
  agent: 'CE-05',
  model: 'plan.author',
  messages: [{ role: 'user', content: 'Plan a lesson.' }],
  temperature: 0,
  stream: false,
};

function adapter(
  provider: string,
  complete: ProviderAdapter['complete'],
): ProviderAdapter {
  return {
    provider,
    complete,
    embed: vi.fn(),
    completeStream: vi.fn(),
  };
}

async function* eventsOf(
  ...events: readonly AdapterStreamEvent[]
): AsyncGenerator<AdapterStreamEvent, void, void> {
  for (const event of events) yield event;
}

/** A stream that fails before producing any event — not a `function*`, so there is no
 *  yield to omit; it just rejects the first `next()` call, which is all this needs. */
function throwingStream(error: Error): AsyncGenerator<AdapterStreamEvent, void, void> {
  return {
    next: () => Promise.reject(error),
    return: () => Promise.resolve({ done: true, value: undefined }),
    throw: (err: unknown) => Promise.reject(err),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

function streamAdapter(
  provider: string,
  completeStream: ProviderAdapter['completeStream'],
): ProviderAdapter {
  return { provider, complete: vi.fn(), embed: vi.fn(), completeStream };
}

async function collect<T>(source: AsyncGenerator<T, void, void>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe('createRouter — fallback chain', () => {
  it('falls through to the next link when the first is retryably unavailable', async () => {
    const failing = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('unavailable', 'down for maintenance')),
    );
    const working = adapter(
      'openai',
      vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    );

    const router = createRouter({
      adapters: { anthropic: failing, openai: working },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
    });

    const { result, provider } = await router.routeChatCompletion(request);
    expect(provider).toBe('openai');
    expect(result.content).toBe('ok');
    expect(failing.complete).toHaveBeenCalledTimes(1);
    expect(working.complete).toHaveBeenCalledTimes(1);
  });

  it('records each fallback attempt as an event on the caller-supplied span (Stage 04 step 8)', async () => {
    const failing = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('rate_limited', 'busy')),
    );
    const working = adapter(
      'openai',
      vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    );

    const router = createRouter({
      adapters: { anthropic: failing, openai: working },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
    });

    const exporter = new InMemorySpanExporter();
    const tracer = createTracer({
      serviceName: 'test-gateway',
      spanProcessor: new SimpleSpanProcessor(exporter),
    });
    const span = tracer.startSpan('gateway.chat_completions');
    await router.routeChatCompletion(request, span);
    span.end();

    const [recorded] = exporter.getFinishedSpans();
    expect(recorded?.events.map((e) => e.name)).toEqual(['gateway.fallback']);
    expect(recorded?.events[0]?.attributes).toEqual({
      provider: 'anthropic',
      reason: 'rate_limited',
    });
  });

  it('stops immediately on a non-retryable error rather than trying the next link', async () => {
    const invalid = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('invalid_request', 'bad request')),
    );
    const neverCalled = adapter('openai', vi.fn());

    const router = createRouter({
      adapters: { anthropic: invalid, openai: neverCalled },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
    });

    await expect(router.routeChatCompletion(request)).rejects.toBeInstanceOf(
      AdapterError,
    );
    expect(neverCalled.complete).not.toHaveBeenCalled();
  });

  it('exhausts the chain and reports every attempt', async () => {
    const a = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('timeout', 'slow')),
    );
    const b = adapter(
      'openai',
      vi.fn().mockRejectedValue(new AdapterError('rate_limited', 'busy')),
    );

    const router = createRouter({
      adapters: { anthropic: a, openai: b },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
    });

    await expect(router.routeChatCompletion(request)).rejects.toBeInstanceOf(
      AllProvidersUnavailableError,
    );
  });

  it('rejects a request for a logical model with no routing entry', async () => {
    const router = createRouter({ adapters: {}, credentialPools: {}, routing: {} });
    await expect(router.routeChatCompletion(request)).rejects.toBeInstanceOf(
      UnknownLogicalModelError,
    );
  });
});

describe('createRouter — routeChatCompletionStream', () => {
  const routing = {
    'plan.author': [
      { provider: 'anthropic', concreteModel: 'claude' },
      { provider: 'openai', concreteModel: 'gpt' },
    ],
  };
  const pools = () => ({
    anthropic: new CredentialPool('anthropic', ['k1']),
    openai: new CredentialPool('openai', ['k2']),
  });

  it('falls back before the first event, exactly like the non-streaming path', async () => {
    const failing = streamAdapter('anthropic', () =>
      throwingStream(new AdapterError('unavailable', 'down')),
    );
    const working = streamAdapter('openai', () =>
      eventsOf(
        { type: 'content', delta: 'hi' },
        { type: 'done', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      ),
    );

    const router = createRouter({
      adapters: { anthropic: failing, openai: working },
      credentialPools: pools(),
      routing,
    });

    const events = await collect(router.routeChatCompletionStream(request));
    expect(events.map((e) => e.provider)).toEqual(['openai', 'openai']);
    expect(events[0]?.event).toEqual({ type: 'content', delta: 'hi' });
  });

  it('does not fall back once the first event has been yielded', async () => {
    async function* startsThenFails(): AsyncGenerator<AdapterStreamEvent, void, void> {
      yield { type: 'content', delta: 'partial' };
      throw new AdapterError('unavailable', 'dropped mid-stream');
    }
    const first = streamAdapter('anthropic', startsThenFails);
    const neverCalled = streamAdapter('openai', vi.fn());

    const router = createRouter({
      adapters: { anthropic: first, openai: neverCalled },
      credentialPools: pools(),
      routing,
    });

    const generator = router.routeChatCompletionStream(request);
    const firstResult = await generator.next();
    expect(firstResult.value).toEqual({
      event: { type: 'content', delta: 'partial' },
      provider: 'anthropic',
    });
    await expect(generator.next()).rejects.toBeInstanceOf(AdapterError);
    expect(neverCalled.completeStream).not.toHaveBeenCalled();
  });

  it('exhausts the chain and throws AllProvidersUnavailableError when every link fails before its first event', async () => {
    const a = streamAdapter('anthropic', () =>
      throwingStream(new AdapterError('timeout', 'slow')),
    );
    const b = streamAdapter('openai', () =>
      throwingStream(new AdapterError('rate_limited', 'busy')),
    );

    const router = createRouter({
      adapters: { anthropic: a, openai: b },
      credentialPools: pools(),
      routing,
    });

    await expect(
      collect(router.routeChatCompletionStream(request)),
    ).rejects.toBeInstanceOf(AllProvidersUnavailableError);
  });
});

describe('createRouter — circuit breaker (Stage 06 step 8)', () => {
  it('records a retryable failure against the breaker, and closes it on success', async () => {
    const failing = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('unavailable', 'down')),
    );
    const working = adapter(
      'openai',
      vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    );
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 60_000,
    });

    const router = createRouter({
      adapters: { anthropic: failing, openai: working },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
      circuitBreaker,
    });

    await router.routeChatCompletion(request);
    expect(circuitBreaker.stateOf('anthropic')).toBe('open'); // one failure, threshold 1
    expect(circuitBreaker.stateOf('openai')).toBe('closed'); // the success closed it
  });

  it('skips a link outright once its breaker is open, without ever calling its adapter', async () => {
    const neverCalled = adapter('anthropic', vi.fn());
    const working = adapter(
      'openai',
      vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    );
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 60_000,
    });
    circuitBreaker.recordFailure('anthropic'); // already open before the router is even called

    const router = createRouter({
      adapters: { anthropic: neverCalled, openai: working },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [
          { provider: 'anthropic', concreteModel: 'claude' },
          { provider: 'openai', concreteModel: 'gpt' },
        ],
      },
      circuitBreaker,
    });

    const { provider } = await router.routeChatCompletion(request);
    expect(provider).toBe('openai');
    expect(neverCalled.complete).not.toHaveBeenCalled();
  });

  it('does not open the breaker on a non-retryable error', async () => {
    const invalid = adapter(
      'anthropic',
      vi.fn().mockRejectedValue(new AdapterError('invalid_request', 'bad request')),
    );
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 60_000,
    });

    const router = createRouter({
      adapters: { anthropic: invalid, openai: adapter('openai', vi.fn()) },
      credentialPools: {
        anthropic: new CredentialPool('anthropic', ['k1']),
        openai: new CredentialPool('openai', ['k2']),
      },
      routing: {
        'plan.author': [{ provider: 'anthropic', concreteModel: 'claude' }],
      },
      circuitBreaker,
    });

    await expect(router.routeChatCompletion(request)).rejects.toBeInstanceOf(
      AdapterError,
    );
    expect(circuitBreaker.stateOf('anthropic')).toBe('closed');
  });

  it('behaves exactly as before when no circuit breaker is supplied', async () => {
    const working = adapter(
      'anthropic',
      vi.fn().mockResolvedValue({
        content: 'ok',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    );
    const router = createRouter({
      adapters: { anthropic: working },
      credentialPools: { anthropic: new CredentialPool('anthropic', ['k1']) },
      routing: { 'plan.author': [{ provider: 'anthropic', concreteModel: 'claude' }] },
    });
    const { provider } = await router.routeChatCompletion(request);
    expect(provider).toBe('anthropic');
  });
});

describe('createRouter — boot validation', () => {
  it('refuses to construct when routing references an unconfigured provider', () => {
    expect(() =>
      createRouter({
        adapters: {},
        credentialPools: {},
        routing: { 'plan.author': [{ provider: 'anthropic', concreteModel: 'claude' }] },
      }),
    ).toThrow(/unknown provider "anthropic"/);
  });

  it('refuses to construct when a provider has no credential pool', () => {
    const stub = adapter('anthropic', vi.fn());
    expect(() =>
      createRouter({
        adapters: { anthropic: stub },
        credentialPools: {},
        routing: { 'plan.author': [{ provider: 'anthropic', concreteModel: 'claude' }] },
      }),
    ).toThrow(/no credential pool/);
  });
});
