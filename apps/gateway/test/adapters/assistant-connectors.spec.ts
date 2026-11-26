import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { buildAdapters } from '../../src/index.js';
import { parseGatewayEnv } from '../../src/config/env.js';
import { buildAssistantRouting } from '../../src/routing/assistants.js';
import { AdapterError, type FetchLike } from '../../src/adapters/types.js';

const request: ChatCompletionRequest = {
  tenantId: 'tenant-1',
  module: 'assistant',
  agent: 'staff-chat',
  model: 'assistant.copilot',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0,
  stream: false,
};

const okBody = {
  choices: [{ message: { content: 'hi' } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

function recordingFetch(status = 200) {
  return vi.fn(async (_url: string, _init: { headers: Record<string, string> }) => ({
    ok: status < 400,
    status,
    json: async () => okBody,
    text: async () => '',
  }));
}

const asFetch = (f: ReturnType<typeof recordingFetch>): FetchLike =>
  f as unknown as FetchLike;

describe('assistant connectors — adapter registry', () => {
  it('registers nothing without credentials (a Claude-only school gets no Grok)', () => {
    const { adapters } = buildAdapters(parseGatewayEnv({}), asFetch(recordingFetch()));
    expect(Object.keys(adapters)).toEqual([]);
  });

  it('registers qwen, xai and azure only when their credentials are present', () => {
    const env = parseGatewayEnv({
      DASHSCOPE_API_KEYS: 'q1',
      XAI_API_KEYS: 'x1',
      AZURE_OPENAI_API_KEYS: 'a1',
      AZURE_OPENAI_ENDPOINT: 'https://res.openai.azure.example/',
    });
    const { adapters, credentialPools } = buildAdapters(env, asFetch(recordingFetch()));
    expect(Object.keys(adapters).sort()).toEqual(['azure', 'qwen', 'xai']);
    expect(Object.keys(credentialPools).sort()).toEqual(['azure', 'qwen', 'xai']);
  });

  it('does not register azure when only the key is set — no endpoint to call', () => {
    const env = parseGatewayEnv({ AZURE_OPENAI_API_KEYS: 'a1' });
    expect(buildAdapters(env, asFetch(recordingFetch())).adapters.azure).toBeUndefined();
  });

  it('Grok calls xAI with a bearer key', async () => {
    const fetchImpl = recordingFetch();
    const { adapters } = buildAdapters(
      parseGatewayEnv({ XAI_API_KEYS: 'x1' }),
      asFetch(fetchImpl),
    );
    await adapters.xai!.complete(request, 'grok-4', 'xai-secret');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer xai-secret');
  });

  it('Copilot calls the Azure deployment URL with api-version and an api-key header', async () => {
    const fetchImpl = recordingFetch();
    const { adapters } = buildAdapters(
      parseGatewayEnv({
        AZURE_OPENAI_API_KEYS: 'a1',
        AZURE_OPENAI_ENDPOINT: 'https://res.openai.azure.example/',
        AZURE_OPENAI_API_VERSION: '2024-08-01-preview',
      }),
      asFetch(fetchImpl),
    );
    await adapters.azure!.complete(request, 'my deploy', 'az-secret');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://res.openai.azure.example/openai/deployments/my%20deploy/chat/completions?api-version=2024-08-01-preview',
    );
    expect(init.headers['api-key']).toBe('az-secret');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('a rejected Copilot key is non-retryable, so the router never rotates blindly', async () => {
    const { adapters } = buildAdapters(
      parseGatewayEnv({
        AZURE_OPENAI_API_KEYS: 'a1',
        AZURE_OPENAI_ENDPOINT: 'https://res.openai.azure.example',
      }),
      asFetch(recordingFetch(401)),
    );
    await expect(adapters.azure!.complete(request, 'd', 'bad')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    await expect(adapters.azure!.complete(request, 'd', 'bad')).rejects.toBeInstanceOf(
      AdapterError,
    );
  });
});

describe('buildAssistantRouting', () => {
  const env = parseGatewayEnv({});
  const stub = {
    provider: 'x',
    complete: vi.fn(),
    embed: vi.fn(),
    completeStream: vi.fn(),
  };

  it('routes each configured connector to exactly one provider — no cross-vendor fallback', () => {
    const routing = buildAssistantRouting(env, { anthropic: stub, xai: stub });
    expect(Object.keys(routing).sort()).toEqual(['assistant.claude', 'assistant.grok']);
    expect(routing['assistant.grok']).toEqual([
      { provider: 'xai', concreteModel: env.GROK_MODEL_ID },
    ]);
    expect(routing['assistant.claude']).toHaveLength(1);
  });

  it('produces no routes when no provider is configured', () => {
    expect(buildAssistantRouting(env, {})).toEqual({});
  });

  it('uses the Azure deployment name as the Copilot concrete model', () => {
    const routing = buildAssistantRouting(
      parseGatewayEnv({ AZURE_OPENAI_DEPLOYMENT: 'school-gpt' }),
      { azure: stub },
    );
    expect(routing['assistant.copilot']).toEqual([
      { provider: 'azure', concreteModel: 'school-gpt' },
    ]);
  });
});
