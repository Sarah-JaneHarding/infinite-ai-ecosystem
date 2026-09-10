// The Google Gemini adapter — a third provider family for the gateway.
//
// Gemini's wire format differs from both Anthropic and OpenAI in three ways that matter:
//   1. System messages are a top-level `systemInstruction` field, not part of `contents`.
//   2. The assistant role is called "model", not "assistant".
//   3. Auth travels as the `x-goog-api-key` header, not `Authorization: Bearer`.
//   4. Tool responses are typed `functionCall` parts, not a `tool_calls` array.
//   5. The embeddings API is separate (`embedContent` / `batchEmbedContents`) and does not
//      report token counts — `usage.promptTokens` is always 0 for embeddings.
//
// Streaming uses the same JSON structure as non-streaming, delivered over SSE, with the
// endpoint suffix `?alt=sse`. Each SSE data line is a full (partial) candidate object, so
// the parser accumulates `usageMetadata` until the final event rather than pulling it from
// a dedicated `done` event as Anthropic does.

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

export interface GoogleConfig {
  readonly baseUrl: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
}

type GeminiRole = 'user' | 'model';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: { role: string; parts: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiEmbeddingResponse {
  embedding: { values: number[] };
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{ values: number[] }>;
}

function classifyStatus(status: number): AdapterError | null {
  if (status === 429) return new AdapterError('rate_limited', 'Provider rate limit hit.');
  if (status === 401 || status === 403) {
    return new AdapterError('unauthorized', 'Provider rejected the credential.');
  }
  if (status >= 500) return new AdapterError('unavailable', `Provider returned ${status}.`);
  if (status >= 400) return new AdapterError('invalid_request', `Provider returned ${status}.`);
  return null;
}

/** Common HTTP POST to any Google endpoint — sets the API key header and maps errors. */
async function googlePost(
  config: GoogleConfig,
  url: string,
  body: unknown,
  credential: string,
): Promise<Awaited<ReturnType<FetchLike>>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await config.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': credential,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdapterError('timeout', 'Provider google timed out.');
    }
    throw new AdapterError(
      'unavailable',
      `Provider google unreachable: ${error instanceof Error ? error.message : String(error)}`,
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

function buildGeminiRequest(request: ChatCompletionRequest): GeminiRequest {
  const systemMessages = request.messages.filter((m) => m.role === 'system');
  const conversation = request.messages.filter((m) => m.role !== 'system');

  const body: GeminiRequest = {
    contents: conversation.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: request.temperature,
      ...(request.maxOutputTokens !== undefined
        ? { maxOutputTokens: request.maxOutputTokens }
        : {}),
    },
  };

  if (systemMessages.length > 0) {
    body.systemInstruction = {
      parts: systemMessages.map((m) => ({ text: m.content })),
    };
  }

  if (request.tools !== undefined && request.tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }

  return body;
}

function extractChatResult(raw: GeminiResponse): AdapterChatResult {
  const candidate = raw.candidates[0];
  if (candidate === undefined) {
    throw new AdapterError('invalid_request', 'Provider google returned no candidates.');
  }

  const textParts = candidate.content.parts.filter(
    (p): p is { text: string } => p.text !== undefined,
  );
  const functionParts = candidate.content.parts.filter(
    (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
      p.functionCall !== undefined,
  );

  return {
    content: textParts.map((p) => p.text).join(''),
    ...(functionParts.length > 0
      ? {
          toolCalls: functionParts.map((p) => ({
            name: p.functionCall.name,
            arguments: p.functionCall.args,
          })),
        }
      : {}),
    usage: {
      promptTokens: raw.usageMetadata.promptTokenCount,
      completionTokens: raw.usageMetadata.candidatesTokenCount,
      totalTokens: raw.usageMetadata.totalTokenCount,
    },
  };
}

async function* streamGenerate(
  config: GoogleConfig,
  request: ChatCompletionRequest,
  concreteModel: string,
  credential: string,
): AsyncGenerator<AdapterStreamEvent, void, void> {
  const url = `${config.baseUrl}/v1beta/models/${concreteModel}:streamGenerateContent?alt=sse`;
  const response = await googlePost(config, url, buildGeminiRequest(request), credential);

  if (response.body === undefined || response.body === null) {
    throw new AdapterError('invalid_request', 'Provider google returned no stream body.');
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  for await (const line of parseSseDataLines(response.body)) {
    if (line.length === 0) continue;

    let chunk: GeminiResponse;
    try {
      chunk = JSON.parse(line) as GeminiResponse;
    } catch (error) {
      throw new AdapterError(
        'invalid_request',
        `Provider google sent a stream chunk this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // usageMetadata accumulates across events; the last non-undefined value wins.
    if (chunk.usageMetadata !== undefined) {
      promptTokens = chunk.usageMetadata.promptTokenCount;
      completionTokens = chunk.usageMetadata.candidatesTokenCount;
      totalTokens = chunk.usageMetadata.totalTokenCount;
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.text !== undefined && part.text.length > 0) {
        yield { type: 'content', delta: part.text };
      }
      if (part.functionCall !== undefined) {
        // Gemini delivers a complete functionCall in one part, not streamed argument deltas.
        // We emit it as a single tool_call event with the full JSON in argumentsDelta.
        yield {
          type: 'tool_call',
          index: 0,
          name: part.functionCall.name,
          argumentsDelta: JSON.stringify(part.functionCall.args),
        };
      }
    }
  }

  yield { type: 'done', usage: { promptTokens, completionTokens, totalTokens } };
}

export function createGoogleAdapter(config: GoogleConfig): ProviderAdapter {
  return {
    provider: 'google',

    async complete(
      request: ChatCompletionRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterChatResult> {
      const url = `${config.baseUrl}/v1beta/models/${concreteModel}:generateContent`;
      const response = await googlePost(
        config,
        url,
        buildGeminiRequest(request),
        credential,
      );

      try {
        const raw = (await response.json()) as GeminiResponse;
        return extractChatResult(raw);
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError(
          'invalid_request',
          `Provider google returned a response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    async embed(
      request: EmbeddingsRequest,
      concreteModel: string,
      credential: string,
    ): Promise<AdapterEmbeddingsResult> {
      if (request.input.length === 1) {
        const url = `${config.baseUrl}/v1beta/models/${concreteModel}:embedContent`;
        const response = await googlePost(
          config,
          url,
          { content: { parts: [{ text: request.input[0] }] } },
          credential,
        );

        try {
          const raw = (await response.json()) as GeminiEmbeddingResponse;
          // Gemini embeddings API does not report token counts.
          return { vectors: [raw.embedding.values], usage: { promptTokens: 0 } };
        } catch (error) {
          if (error instanceof AdapterError) throw error;
          throw new AdapterError(
            'invalid_request',
            `Provider google returned an embedding response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Multiple inputs → batch endpoint
      const url = `${config.baseUrl}/v1beta/models/${concreteModel}:batchEmbedContents`;
      const response = await googlePost(
        config,
        url,
        {
          requests: request.input.map((text) => ({
            model: `models/${concreteModel}`,
            content: { parts: [{ text }] },
          })),
        },
        credential,
      );

      try {
        const raw = (await response.json()) as GeminiBatchEmbeddingResponse;
        return { vectors: raw.embeddings.map((e) => e.values), usage: { promptTokens: 0 } };
      } catch (error) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError(
          'invalid_request',
          `Provider google returned a batch embedding response this adapter could not parse: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    completeStream(request, concreteModel, credential) {
      return streamGenerate(config, request, concreteModel, credential);
    },
  };
}
