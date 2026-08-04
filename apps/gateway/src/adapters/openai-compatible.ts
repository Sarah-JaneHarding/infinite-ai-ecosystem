// An adapter for any provider that speaks the OpenAI `/chat/completions` and
// `/embeddings` wire format — Stage 04 step 2.
//
// This one factory serves two of the three required adapters: the real OpenAI API, and
// the self-hosted small-model adapter for classification and scrubbing work. Self-hosted
// inference servers (vLLM, Ollama, text-generation-inference) already expose this same
// shape, so "local adapter" and "OpenAI-family adapter" are the same code pointed at a
// different `baseUrl` and credential — not two implementations that happen to agree.

import type { ChatCompletionRequest, EmbeddingsRequest } from '@infinite-ai/contracts';

import {
  AdapterError,
  type AdapterChatResult,
  type AdapterEmbeddingsResult,
  type FetchLike,
  type ProviderAdapter,
} from './types.js';

export interface OpenAiCompatibleConfig {
  readonly provider: string;
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
}

interface OpenAiChatResponse {
  choices: readonly {
    message: {
      content: string | null;
      tool_calls?: readonly { function: { name: string; arguments: string } }[];
    };
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAiEmbeddingsResponse {
  data: readonly { embedding: readonly number[] }[];
  usage: { prompt_tokens: number };
}

function classifyStatus(status: number): AdapterError | null {
  if (status === 429) return new AdapterError('rate_limited', 'Provider rate limit hit.');
  if (status === 401 || status === 403) {
    return new AdapterError('unauthorized', 'Provider rejected the credential.');
  }
  if (status >= 500)
    return new AdapterError('unavailable', `Provider returned ${status}.`);
  if (status >= 400)
    return new AdapterError('invalid_request', `Provider returned ${status}.`);
  return null;
}

async function post(
  config: OpenAiCompatibleConfig,
  path: string,
  body: unknown,
  credential: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await config.fetchImpl(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdapterError('timeout', `Provider ${config.provider} timed out.`);
    }
    throw new AdapterError(
      'unavailable',
      `Provider ${config.provider} unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw (
      classifyStatus(response.status) ??
      new AdapterError('unavailable', `Provider returned ${response.status}.`)
    );
  }
  return response.json();
}

export function createOpenAiCompatibleAdapter(
  config: OpenAiCompatibleConfig,
): ProviderAdapter {
  return {
    provider: config.provider,

    async complete(
      request: ChatCompletionRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterChatResult> {
      const raw = (await post(
        config,
        '/chat/completions',
        {
          model: concreteModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          tools: request.tools?.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
        },
        credential,
      )) as OpenAiChatResponse;

      // A 2xx response with an unexpected shape is not this code's bug to crash on — see
      // the matching note in adapters/anthropic.ts.
      try {
        const choice = raw.choices[0];
        if (choice === undefined) {
          throw new AdapterError('invalid_request', 'Provider returned no choices.');
        }
        const toolCalls = choice.message.tool_calls?.map((call) => ({
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
        }));
        return {
          content: choice.message.content ?? '',
          // exactOptionalPropertyTypes: an absent tool call list is *omitted*, not set to
          // undefined — the two are different states to a schema that distinguishes them.
          ...(toolCalls !== undefined ? { toolCalls } : {}),
          usage: {
            promptTokens: raw.usage.prompt_tokens,
            completionTokens: raw.usage.completion_tokens,
            totalTokens: raw.usage.total_tokens,
          },
        };
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError(
          'invalid_request',
          `Provider ${config.provider} returned a response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    async embed(
      request: EmbeddingsRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterEmbeddingsResult> {
      const raw = (await post(
        config,
        '/embeddings',
        { model: concreteModel, input: request.input },
        credential,
      )) as OpenAiEmbeddingsResponse;

      try {
        return {
          vectors: raw.data.map((item) => item.embedding),
          usage: { promptTokens: raw.usage.prompt_tokens },
        };
      } catch (error) {
        throw new AdapterError(
          'invalid_request',
          `Provider ${config.provider} returned a response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
