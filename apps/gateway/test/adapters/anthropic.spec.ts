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
});
