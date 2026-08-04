// The Anthropic-family adapter — Stage 04 step 2.
//
// Anthropic's Messages API is not OpenAI-shaped: `system` is a top-level field rather than
// a message with `role: "system"`, and tool calls arrive as typed content blocks rather
// than a `tool_calls` array. This adapter's whole job is translating between that and the
// gateway's internal contract, so nothing above it needs to know which provider answered.

import type { ChatCompletionRequest } from '@infinite-ai/contracts';

import {
  AdapterError,
  type AdapterChatResult,
  type AdapterEmbeddingsResult,
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

export function createAnthropicAdapter(config: AnthropicConfig): ProviderAdapter {
  return {
    provider: 'anthropic',

    async complete(
      request: ChatCompletionRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterChatResult> {
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      const conversation = request.messages.filter((m) => m.role !== 'system');

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
          body: JSON.stringify({
            model: concreteModel,
            system: systemMessages.map((m) => m.content).join('\n\n') || undefined,
            messages: conversation.map((m) => ({ role: m.role, content: m.content })),
            temperature: request.temperature,
            max_tokens: request.maxOutputTokens ?? 4096,
            tools: request.tools?.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
            })),
          }),
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
    },

    embed: embedUnsupported,
  };
}
