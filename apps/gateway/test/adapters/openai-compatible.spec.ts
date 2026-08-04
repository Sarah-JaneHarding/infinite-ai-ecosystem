import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createOpenAiCompatibleAdapter } from '../../src/adapters/openai-compatible.js';
import { AdapterError } from '../../src/adapters/types.js';

const baseRequest: ChatCompletionRequest = {
  tenantId: 'tenant-1',
  module: 'mod-01',
  agent: 'CE-05',
  model: 'plan.author',
  messages: [{ role: 'user', content: 'Plan a lesson.' }],
  temperature: 0,
  stream: false,
};

interface FetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

function fakeFetch(response: { status: number; body: unknown }) {
  return vi.fn(async (_url: string, _init: FetchInit) => ({
    ok: response.status < 400,
    status: response.status,
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  }));
}

async function* sseChunks(
  ...lines: readonly string[]
): AsyncGenerator<Uint8Array, void, void> {
  const encoder = new TextEncoder();
  for (const line of lines) yield encoder.encode(`data: ${line}\n\n`);
}

function fakeStreamFetch(status: number, ...lines: readonly string[]) {
  return vi.fn(async (_url: string, _init: FetchInit) => ({
    ok: status < 400,
    status,
    json: async () => ({}),
    text: async () => '',
    body: sseChunks(...lines),
  }));
}

async function collect<T>(source: AsyncGenerator<T, void, void>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe('createOpenAiCompatibleAdapter — happy path', () => {
  it('shapes the request and parses a completion, passing the given credential', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: {
        choices: [{ message: { content: 'Here is your lesson plan.' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    });
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl,
    });

    const result = await adapter.complete(baseRequest, 'gpt-test', 'cred-xyz');

    expect(result.content).toBe('Here is your lesson plan.');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.openai.example/chat/completions');
    expect(init.headers.authorization).toBe('Bearer cred-xyz');
    expect(JSON.parse(init.body).model).toBe('gpt-test');
  });

  it('parses tool calls out of the response', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { function: { name: 'lookup', arguments: '{"topic":"fractions"}' } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    });
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl,
    });

    const result = await adapter.complete(baseRequest, 'gpt-test', 'cred');
    expect(result.content).toBe('');
    expect(result.toolCalls).toEqual([
      { name: 'lookup', arguments: { topic: 'fractions' } },
    ]);
  });

  it('embeds text', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { data: [{ embedding: [0.1, 0.2] }], usage: { prompt_tokens: 3 } },
    });
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'local',
      baseUrl: 'http://localhost:9000',
      fetchImpl,
    });

    const result = await adapter.embed(
      {
        tenantId: 't',
        module: 'm',
        agent: 'a',
        model: 'embed.default',
        input: ['hello'],
      },
      'local-embed',
      'cred',
    );
    expect(result.vectors).toEqual([[0.1, 0.2]]);
    expect(result.usage).toEqual({ promptTokens: 3 });
  });
});

describe('createOpenAiCompatibleAdapter — failure paths', () => {
  it('classifies a 429 as rate_limited and retryable', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });
    await expect(adapter.complete(baseRequest, 'gpt-test', 'cred')).rejects.toMatchObject(
      {
        kind: 'rate_limited',
        retryable: true,
      },
    );
  });

  it('classifies a 401 as unauthorized and not retryable', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({ status: 401, body: {} }),
    });
    await expect(adapter.complete(baseRequest, 'gpt-test', 'cred')).rejects.toMatchObject(
      {
        kind: 'unauthorized',
        retryable: false,
      },
    );
  });

  it('classifies a 500 as unavailable and retryable', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({ status: 500, body: {} }),
    });
    await expect(adapter.complete(baseRequest, 'gpt-test', 'cred')).rejects.toMatchObject(
      {
        kind: 'unavailable',
        retryable: true,
      },
    );
  });

  it('classifies a network abort as a timeout', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: { signal?: AbortSignal }) => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl,
    });
    await expect(adapter.complete(baseRequest, 'gpt-test', 'cred')).rejects.toMatchObject(
      {
        kind: 'timeout',
      },
    );
  });

  it('raises AdapterError with invalid_request when the response has no choices', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({
        status: 200,
        body: {
          choices: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
      }),
    });
    await expect(
      adapter.complete(baseRequest, 'gpt-test', 'cred'),
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('raises a classified AdapterError, not a raw TypeError, for a 2xx body of the wrong shape', async () => {
    // Stage 04 step 10: an Anthropic-shaped body handed to the OpenAI-family adapter has
    // no `choices` array at all — a chaos drill or a genuinely misbehaving provider must
    // not crash this adapter with an unhandled TypeError.
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({
        status: 200,
        body: { content: [{ type: 'text', text: 'wrong shape' }] },
      }),
    });
    await expect(adapter.complete(baseRequest, 'gpt-test', 'cred')).rejects.toMatchObject(
      {
        kind: 'invalid_request',
      },
    );
  });
});

describe('createOpenAiCompatibleAdapter — completeStream', () => {
  it('yields content deltas, then a done event carrying the final usage', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeStreamFetch(
        200,
        '{"choices":[{"delta":{"content":"Hello"}}]}',
        '{"choices":[{"delta":{"content":", world"}}]}',
        '{"choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}',
        '[DONE]',
      ),
    });

    const events = await collect(adapter.completeStream(baseRequest, 'gpt-test', 'cred'));
    expect(events).toEqual([
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ', world' },
      {
        type: 'done',
        usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      },
    ]);
  });

  it('yields tool_call deltas by index', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeStreamFetch(
        200,
        '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"lookup","arguments":""}}]}}]}',
        '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\":1}"}}]}}]}',
        '[DONE]',
      ),
    });

    const events = await collect(adapter.completeStream(baseRequest, 'gpt-test', 'cred'));
    expect(events[0]).toEqual({
      type: 'tool_call',
      index: 0,
      name: 'lookup',
      argumentsDelta: '',
    });
    expect(events[1]).toEqual({
      type: 'tool_call',
      index: 0,
      name: null,
      argumentsDelta: '{"a":1}',
    });
  });

  it('falls back before the first event on a 429, same as the non-streaming path', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });

    await expect(
      collect(adapter.completeStream(baseRequest, 'gpt-test', 'cred')),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('raises a classified AdapterError on an unparseable stream chunk', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.example',
      fetchImpl: fakeStreamFetch(200, 'not json'),
    });

    await expect(
      collect(adapter.completeStream(baseRequest, 'gpt-test', 'cred')),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
