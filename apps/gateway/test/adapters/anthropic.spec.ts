import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createAnthropicAdapter } from '../../src/adapters/anthropic.js';
import { AdapterError } from '../../src/adapters/types.js';

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

const request: ChatCompletionRequest = {
  tenantId: 'tenant-1',
  module: 'mod-01',
  agent: 'CE-05',
  model: 'plan.author',
  messages: [
    { role: 'system', content: 'You are a CAPS lesson planner.' },
    { role: 'user', content: 'Plan a lesson.' },
  ],
  temperature: 0,
  stream: false,
};

describe('createAnthropicAdapter — happy path', () => {
  it('lifts system messages out of the conversation and uses the given credential', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: {
        content: [{ type: 'text', text: 'Here is your lesson plan.' }],
        usage: { input_tokens: 12, output_tokens: 8 },
      },
    });
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl,
    });

    const result = await adapter.complete(request, 'claude-test', 'cred-xyz');

    expect(result.content).toBe('Here is your lesson plan.');
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.example/v1/messages');
    expect(init.headers['x-api-key']).toBe('cred-xyz');
    const body = JSON.parse(init.body) as { system: string; messages: unknown[] };
    expect(body.system).toBe('You are a CAPS lesson planner.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Plan a lesson.' }]);
  });

  it('translates tool_use content blocks into tool calls', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: {
        content: [
          { type: 'text', text: '' },
          { type: 'tool_use', name: 'lookup', input: { topic: 'fractions' } },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl,
    });

    const result = await adapter.complete(request, 'claude-test', 'cred');
    expect(result.toolCalls).toEqual([
      { name: 'lookup', arguments: { topic: 'fractions' } },
    ]);
  });

  it('refuses to embed, since Anthropic has no embeddings endpoint', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeFetch({ status: 200, body: {} }),
    });
    await expect(
      adapter.embed(
        { tenantId: 't', module: 'm', agent: 'a', model: 'embed.default', input: ['x'] },
        'x',
        'cred',
      ),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});

describe('createAnthropicAdapter — failure paths', () => {
  it('classifies a 429 as rate_limited', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });
    await expect(adapter.complete(request, 'claude-test', 'cred')).rejects.toMatchObject({
      kind: 'rate_limited',
    });
  });

  it('classifies a 503 as unavailable', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeFetch({ status: 503, body: {} }),
    });
    await expect(adapter.complete(request, 'claude-test', 'cred')).rejects.toBeInstanceOf(
      AdapterError,
    );
  });

  it('raises a classified AdapterError, not a raw TypeError, for a 2xx body of the wrong shape', async () => {
    // Stage 04 step 10: an OpenAI-shaped body handed to the Anthropic adapter has no
    // `content` array at all — must not crash this adapter with an unhandled TypeError.
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeFetch({
        status: 200,
        body: { choices: [{ message: { content: 'wrong shape' } }] },
      }),
    });
    await expect(adapter.complete(request, 'claude-test', 'cred')).rejects.toMatchObject({
      kind: 'invalid_request',
    });
  });
});

describe('createAnthropicAdapter — completeStream', () => {
  it('yields content deltas from text_delta events, then a done event with usage', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeStreamFetch(
        200,
        '{"type":"message_start","message":{"usage":{"input_tokens":12}}}',
        '{"type":"content_block_start","index":0,"content_block":{"type":"text"}}',
        '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
        '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":", world"}}',
        '{"type":"message_delta","usage":{"output_tokens":8}}',
        '{"type":"message_stop"}',
      ),
    });

    const events = await collect(adapter.completeStream(request, 'claude-test', 'cred'));
    expect(events).toEqual([
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ', world' },
      { type: 'done', usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 } },
    ]);
  });

  it('yields a tool_call event on content_block_start and streams its arguments as input_json_delta', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeStreamFetch(
        200,
        '{"type":"message_start","message":{"usage":{"input_tokens":1}}}',
        '{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"lookup"}}',
        '{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}',
        '{"type":"message_delta","usage":{"output_tokens":1}}',
        '{"type":"message_stop"}',
      ),
    });

    const events = await collect(adapter.completeStream(request, 'claude-test', 'cred'));
    expect(events[0]).toEqual({
      type: 'tool_call',
      index: 0,
      name: 'lookup',
      argumentsDelta: '',
    });
    expect(events[1]).toEqual({
      type: 'tool_call',
      index: 0,
      name: 'lookup',
      argumentsDelta: '{"a":1}',
    });
  });

  it('falls back before the first event on a 429, same as the non-streaming path', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });

    await expect(
      collect(adapter.completeStream(request, 'claude-test', 'cred')),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('raises a classified AdapterError on an unparseable stream event', async () => {
    const adapter = createAnthropicAdapter({
      baseUrl: 'https://api.anthropic.example',
      fetchImpl: fakeStreamFetch(200, 'not json'),
    });

    await expect(
      collect(adapter.completeStream(request, 'claude-test', 'cred')),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
