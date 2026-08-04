// The Anthropic-family adapter — Stage 04 step 2.
//
// Anthropic's Messages API is not OpenAI-shaped: `system` is a top-level field rather than
// a message with `role: "system"`, and tool calls arrive as typed content blocks rather
// than a `tool_calls` array. This adapter's whole job is translating between that and the
// gateway's internal contract, so nothing above it needs to know which provider answered.

import type { ChatCompletionRequest } from '@infinite-ai/contracts';

import { parseSseDataLines } from './sse.js';
import {
  AdapterError,
  type AdapterChatResult,
  type AdapterEmbeddingsResult,
  type AdapterStreamEvent,
  type FetchLike,
  type ProviderAdapter,
} from './types.js';

export interface AnthropicConfig {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> };

interface AnthropicMessagesResponse {
  content: readonly AnthropicContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
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

/** Embeddings are not part of Anthropic's API. Requesting one is a routing config error. */
async function embedUnsupported(): Promise<AdapterEmbeddingsResult> {
  throw new AdapterError(
    'invalid_request',
    'Anthropic does not offer an embeddings endpoint. This model was routed incorrectly.',
  );
}

function messagesBody(
  request: ChatCompletionRequest,
  concreteModel: string,
  stream: boolean,
): unknown {
  const systemMessages = request.messages.filter((m) => m.role === 'system');
  const conversation = request.messages.filter((m) => m.role !== 'system');
  return {
    model: concreteModel,
    system: systemMessages.map((m) => m.content).join('\n\n') || undefined,
    messages: conversation.map((m) => ({ role: m.role, content: m.content })),
    temperature: request.temperature,
    max_tokens: request.maxOutputTokens ?? 4096,
    stream,
    tools: request.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    })),
  };
}

/**
 * Opens the connection and confirms the status is a success, without reading the body —
 * the one piece `complete()` and the streaming path both need, and the one piece that must
 * happen before a router could still fall back to another link in the chain.
 */
async function openConnection(
  config: AnthropicConfig,
  body: unknown,
  credential: string,
): Promise<Awaited<ReturnType<FetchLike>>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await config.fetchImpl(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': credential,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdapterError('timeout', 'Provider anthropic timed out.');
    }
    throw new AdapterError(
      'unavailable',
      `Provider anthropic unreachable: ${error instanceof Error ? error.message : String(error)}`,
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

type AnthropicStreamPayload =
  | { type: 'message_start'; message: { usage: { input_tokens: number } } }
  | {
      type: 'content_block_start';
      index: number;
      content_block: { type: 'text' } | { type: 'tool_use'; name: string };
    }
  | {
      type: 'content_block_delta';
      index: number;
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string };
    }
  | { type: 'message_delta'; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: string };

async function* streamMessage(
  config: AnthropicConfig,
  request: ChatCompletionRequest,
  concreteModel: string,
  credential: string,
): AsyncGenerator<AdapterStreamEvent, void, void> {
  const response = await openConnection(
    config,
    messagesBody(request, concreteModel, true),
    credential,
  );

  if (response.body === undefined || response.body === null) {
    throw new AdapterError(
      'invalid_request',
      'Provider anthropic returned no stream body.',
    );
  }

  let promptTokens = 0;
  let completionTokens = 0;
  /** Index of the content block currently open as a tool_use, so deltas know its name. */
  const toolBlockNames = new Map<number, string>();

  for await (const line of parseSseDataLines(response.body)) {
    if (line.length === 0) continue;

    let event: AnthropicStreamPayload;
    try {
      event = JSON.parse(line) as AnthropicStreamPayload;
    } catch (error) {
      throw new AdapterError(
        'invalid_request',
        `Provider anthropic sent a stream event this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    switch (event.type) {
      case 'message_start':
        promptTokens = (
          event as Extract<AnthropicStreamPayload, { type: 'message_start' }>
        ).message.usage.input_tokens;
        break;
      case 'content_block_start': {
        const typed = event as Extract<
          AnthropicStreamPayload,
          { type: 'content_block_start' }
        >;
        if (typed.content_block.type === 'tool_use') {
          toolBlockNames.set(typed.index, typed.content_block.name);
          yield {
            type: 'tool_call',
            index: typed.index,
            name: typed.content_block.name,
            argumentsDelta: '',
          };
        }
        break;
      }
      case 'content_block_delta': {
        const typed = event as Extract<
          AnthropicStreamPayload,
          { type: 'content_block_delta' }
        >;
        if (typed.delta.type === 'text_delta') {
          yield { type: 'content', delta: typed.delta.text };
        } else if (typed.delta.type === 'input_json_delta') {
          yield {
            type: 'tool_call',
            index: typed.index,
            name: toolBlockNames.get(typed.index) ?? null,
            argumentsDelta: typed.delta.partial_json,
          };
        }
        break;
      }
      case 'message_delta':
        completionTokens = (
          event as Extract<AnthropicStreamPayload, { type: 'message_delta' }>
        ).usage.output_tokens;
        break;
      default:
        break;
    }
  }

  yield {
    type: 'done',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

export function createAnthropicAdapter(config: AnthropicConfig): ProviderAdapter {
  return {
    provider: 'anthropic',

    async complete(
      request: ChatCompletionRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterChatResult> {
      const response = await openConnection(
        config,
        messagesBody(request, concreteModel, false),
        credential,
      );

      // A 2xx response with an unexpected shape is not this code's bug to crash on — the
      // provider (or a chaos drill standing in for one) sent something that does not look
      // like a Messages response, and the router needs an AdapterError to fall back on,
      // not a bare TypeError it does not know how to classify.
      try {
        const raw = (await response.json()) as AnthropicMessagesResponse;
        const textBlocks = raw.content.filter(
          (block): block is Extract<AnthropicContentBlock, { type: 'text' }> =>
            block.type === 'text',
        );
        const toolBlocks = raw.content.filter(
          (block): block is Extract<AnthropicContentBlock, { type: 'tool_use' }> =>
            block.type === 'tool_use',
        );

        return {
          content: textBlocks.map((block) => block.text).join(''),
          // exactOptionalPropertyTypes: an absent tool call list is *omitted*, not set to
          // undefined — the two are different states to a schema that distinguishes them.
          ...(toolBlocks.length > 0
            ? {
                toolCalls: toolBlocks.map((block) => ({
                  name: block.name,
                  arguments: block.input,
                })),
              }
            : {}),
          usage: {
            promptTokens: raw.usage.input_tokens,
            completionTokens: raw.usage.output_tokens,
            totalTokens: raw.usage.input_tokens + raw.usage.output_tokens,
          },
        };
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError(
          'invalid_request',
          `Provider anthropic returned a response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    embed: embedUnsupported,

    completeStream(request, concreteModel, credential) {
      return streamMessage(config, request, concreteModel, credential);
    },
  };
}
