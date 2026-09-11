import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createGoogleAdapter } from '../../src/adapters/google.js';
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

const geminiOkResponse = {
  candidates: [
    {
      content: { role: 'model', parts: [{ text: 'Here is your lesson plan.' }] },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
};

describe('createGoogleAdapter — happy path', () => {
  it('maps system messages to systemInstruction and sends x-goog-api-key', async () => {
    const fetchImpl = fakeFetch({ status: 200, body: geminiOkResponse });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    const result = await adapter.complete(request, 'gemini-2.0-flash', 'goog-key');

    expect(result.content).toBe('Here is your lesson plan.');
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.example/v1beta/models/gemini-2.0-flash:generateContent',
    );
    expect(init.headers['x-goog-api-key']).toBe('goog-key');

    const body = JSON.parse(init.body) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    expect(body.systemInstruction.parts[0]?.text).toBe('You are a CAPS lesson planner.');
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Plan a lesson.' }] },
    ]);
  });

  it('maps assistant role to "model" in outbound contents', async () => {
    const fetchImpl = fakeFetch({ status: 200, body: geminiOkResponse });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    await adapter.complete(
      {
        ...request,
        messages: [
          { role: 'user', content: 'Hello.' },
          { role: 'assistant', content: 'Hi there.' },
          { role: 'user', content: 'Plan a lesson.' },
        ],
      },
      'gemini-2.0-flash',
      'goog-key',
    );

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body) as {
      contents: Array<{ role: string }>;
    };
    expect(body.contents[1]?.role).toBe('model');
  });

  it('translates functionCall parts into tool calls', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'lookup', args: { topic: 'fractions' } } }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    const result = await adapter.complete(request, 'gemini-2.0-flash', 'goog-key');
    expect(result.toolCalls).toEqual([
      { name: 'lookup', arguments: { topic: 'fractions' } },
    ]);
  });

  it('sends tools as functionDeclarations', async () => {
    const fetchImpl = fakeFetch({ status: 200, body: geminiOkResponse });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    await adapter.complete(
      {
        ...request,
        tools: [{ name: 'lookup', description: 'Look up a topic', parameters: {} }],
      },
      'gemini-2.0-flash',
      'goog-key',
    );

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body) as {
      tools: Array<{ functionDeclarations: Array<{ name: string }> }>;
    };
    expect(body.tools?.[0]?.functionDeclarations?.[0]?.name).toBe('lookup');
  });
});

describe('createGoogleAdapter — embeddings', () => {
  it('uses embedContent endpoint for a single input', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { embedding: { values: [0.1, 0.2, 0.3] } },
    });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
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
      'text-embedding-004',
      'goog-key',
    );

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.example/v1beta/models/text-embedding-004:embedContent',
    );
    expect(result.vectors).toEqual([[0.1, 0.2, 0.3]]);
    expect(result.usage.promptTokens).toBe(0);
  });

  it('uses batchEmbedContents endpoint for multiple inputs', async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] },
    });
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    const result = await adapter.embed(
      {
        tenantId: 't',
        module: 'm',
        agent: 'a',
        model: 'embed.default',
        input: ['hello', 'world'],
      },
      'text-embedding-004',
      'goog-key',
    );

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.example/v1beta/models/text-embedding-004:batchEmbedContents',
    );
    expect(result.vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
});

describe('createGoogleAdapter — failure paths', () => {
  it('classifies a 429 as rate_limited', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });
    await expect(
      adapter.complete(request, 'gemini-2.0-flash', 'goog-key'),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('classifies a 401 as unauthorized', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({ status: 401, body: {} }),
    });
    await expect(
      adapter.complete(request, 'gemini-2.0-flash', 'goog-key'),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('classifies a 503 as unavailable', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({ status: 503, body: {} }),
    });
    await expect(
      adapter.complete(request, 'gemini-2.0-flash', 'goog-key'),
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('raises a classified AdapterError on a 2xx body with no candidates', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({
        status: 200,
        body: {
          candidates: [],
          usageMetadata: {
            promptTokenCount: 0,
            candidatesTokenCount: 0,
            totalTokenCount: 0,
          },
        },
      }),
    });
    await expect(
      adapter.complete(request, 'gemini-2.0-flash', 'goog-key'),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });

  it('raises a classified AdapterError on a 2xx body of the wrong shape', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({
        status: 200,
        // An OpenAI-shaped body handed to the Google adapter
        body: { choices: [{ message: { content: 'wrong shape' } }] },
      }),
    });
    await expect(
      adapter.complete(request, 'gemini-2.0-flash', 'goog-key'),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});

describe('createGoogleAdapter — completeStream', () => {
  it('yields content deltas and a done event with usage', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeStreamFetch(
        200,
        JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text: 'Hello' }] } }],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 0,
            totalTokenCount: 12,
          },
        }),
        JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text: ', world' }] } }],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            totalTokenCount: 20,
          },
        }),
      ),
    });

    const events = await collect(
      adapter.completeStream(request, 'gemini-2.0-flash', 'goog-key'),
    );
    expect(events).toEqual([
      { type: 'content', delta: 'Hello' },
      { type: 'content', delta: ', world' },
      { type: 'done', usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 } },
    ]);
  });

  it('uses the streaming endpoint URL', async () => {
    const fetchImpl = fakeStreamFetch(
      200,
      JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [] } }],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      }),
    );
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl,
    });

    await collect(adapter.completeStream(request, 'gemini-2.0-flash', 'goog-key'));

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toContain('streamGenerateContent?alt=sse');
  });

  it('yields a tool_call event for a functionCall part', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeStreamFetch(
        200,
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { functionCall: { name: 'lookup', args: { topic: 'fractions' } } },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        }),
      ),
    });

    const events = await collect(
      adapter.completeStream(request, 'gemini-2.0-flash', 'goog-key'),
    );
    expect(events[0]).toMatchObject({
      type: 'tool_call',
      name: 'lookup',
      argumentsDelta: '{"topic":"fractions"}',
    });
  });

  it('falls back before the first event on a 429', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeFetch({ status: 429, body: {} }),
    });
    await expect(
      collect(adapter.completeStream(request, 'gemini-2.0-flash', 'goog-key')),
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('raises a classified AdapterError on an unparseable stream chunk', async () => {
    const adapter = createGoogleAdapter({
      baseUrl: 'https://generativelanguage.example',
      fetchImpl: fakeStreamFetch(200, 'not json'),
    });
    await expect(
      collect(adapter.completeStream(request, 'gemini-2.0-flash', 'goog-key')),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
