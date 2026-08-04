// An adapter for any provider that speaks the OpenAI `/chat/completions` and
// `/embeddings` wire format — Stage 04 step 2.
//
// This one factory serves two of the three required adapters: the real OpenAI API, and
// the self-hosted small-model adapter for classification and scrubbing work. Self-hosted
// inference servers (vLLM, Ollama, text-generation-inference) already expose this same
// shape, so "local adapter" and "OpenAI-family adapter" are the same code pointed at a
// different `baseUrl` and credential — not two implementations that happen to agree.

import type { ChatCompletionRequest, EmbeddingsRequest } from '@infinite-ai/contracts';

import { parseSseDataLines } from './sse.js';
import {
  AdapterError,
  type AdapterChatResult,
  type AdapterEmbeddingsResult,
  type AdapterStreamEvent,
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

/**
 * Opens the connection and confirms the status is a success, without reading the body —
 * the one piece `post()` and the streaming path both need, and the one piece that must
 * happen before a router could still fall back to another link in the chain.
 */
async function openConnection(
  config: OpenAiCompatibleConfig,
  path: string,
  body: unknown,
  credential: string,
): Promise<Awaited<ReturnType<FetchLike>>> {
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
  return response;
}

async function post(
  config: OpenAiCompatibleConfig,
  path: string,
  body: unknown,
  credential: string,
): Promise<unknown> {
  const response = await openConnection(config, path, body, credential);
  return response.json();
}

interface OpenAiStreamChunk {
  choices?: readonly {
    delta: {
      content?: string | null;
      tool_calls?: readonly {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

async function* streamChatCompletion(
  config: OpenAiCompatibleConfig,
  concreteModel: string,
  request: ChatCompletionRequest,
  credential: string,
): AsyncGenerator<AdapterStreamEvent, void, void> {
  const response = await openConnection(
    config,
    '/chat/completions',
    {
      model: concreteModel,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
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
  );

  if (response.body === undefined || response.body === null) {
    throw new AdapterError(
      'invalid_request',
      `Provider ${config.provider} returned no stream body.`,
    );
  }

  let usage: AdapterStreamEvent & { type: 'done' } = {
    type: 'done',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };

  for await (const line of parseSseDataLines(response.body)) {
    if (line === '[DONE]') break;
    if (line.length === 0) continue;

    let chunk: OpenAiStreamChunk;
    try {
      chunk = JSON.parse(line) as OpenAiStreamChunk;
    } catch (error) {
      throw new AdapterError(
        'invalid_request',
        `Provider ${config.provider} sent a stream chunk this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (chunk.usage != null) {
      usage = {
        type: 'done',
        usage: {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        },
      };
    }

    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content != null && delta.content.length > 0) {
      yield { type: 'content', delta: delta.content };
    }
    for (const call of delta?.tool_calls ?? []) {
      yield {
        type: 'tool_call',
        index: call.index,
        name: call.function?.name ?? null,
        argumentsDelta: call.function?.arguments ?? '',
      };
    }
  }

  yield usage;
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

    completeStream(request, concreteModel, credential) {
      return streamChatCompletion(config, concreteModel, request, credential);
    },
  };
}
