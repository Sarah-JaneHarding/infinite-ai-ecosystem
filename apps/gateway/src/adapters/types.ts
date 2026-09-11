// The one internal interface every provider integrates against — Stage 04 step 2.
//
// Nothing outside this directory may import a provider SDK or call a provider's HTTP API
// directly (rule 3; enforced by the ESLint exemption scoped to exactly this folder, plus
// `test/no-provider-sdk-outside-gateway.spec.ts`). The router, the budget tracker and the
// cache all talk to a `ProviderAdapter`, never to Anthropic or OpenAI by name — that
// indirection is what makes routing configuration rather than code (step 4).

import type { ChatCompletionRequest, EmbeddingsRequest } from '@infinite-ai/contracts';

/**
 * Why a call failed, at the granularity the router needs to decide what to do next.
 * Deliberately coarser than an HTTP status: the router does not care whether a provider
 * returned 429 or 503, only whether trying the next link in the chain could help.
 */
export type AdapterErrorKind =
  'rate_limited' | 'unavailable' | 'timeout' | 'invalid_request' | 'unauthorized';

/** The only channel a provider's raw error may travel through — never a bare `Error`. */
export class AdapterError extends Error {
  public override readonly name = 'AdapterError';
  /** Whether the router should try the next credential or the next model in the chain. */
  public readonly retryable: boolean;

  constructor(
    public readonly kind: AdapterErrorKind,
    message: string,
  ) {
    super(message);
    this.retryable =
      kind === 'rate_limited' || kind === 'unavailable' || kind === 'timeout';
  }
}

export interface AdapterChatResult {
  readonly content: string;
  readonly toolCalls?: readonly { name: string; arguments: Record<string, unknown> }[];
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

export interface AdapterEmbeddingsResult {
  readonly vectors: readonly (readonly number[])[];
  readonly usage: { readonly promptTokens: number };
}

/**
 * One incremental piece of a streaming completion — Stage 04 step 7.
 *
 * A tagged union rather than one object with optional fields, so a consumer's `switch`
 * cannot forget a case: content deltas, tool-call deltas and the terminal `done` event
 * (carrying the usage no provider reveals until the stream ends) are different things to
 * do, not different shades of the same thing.
 */
export type AdapterStreamEvent =
  | { readonly type: 'content'; readonly delta: string }
  | {
      readonly type: 'tool_call';
      readonly index: number;
      readonly name: string | null;
      readonly argumentsDelta: string;
    }
  | {
      readonly type: 'done';
      readonly usage: {
        readonly promptTokens: number;
        readonly completionTokens: number;
        readonly totalTokens: number;
      };
    };

/**
 * One concrete model behind one provider account. The router resolves a `LogicalModel` to
 * an ordered list of these (step 4) before calling in.
 */
export interface ProviderAdapter {
  /** The provider family this adapter speaks for, e.g. `"anthropic"`, `"openai"`. */
  readonly provider: string;
  /**
   * `credential` is supplied per call, by the router, from a `CredentialPool` — never
   * baked into the adapter at construction. A pool round-robins across several keys for
   * the same provider and base URL, so the adapter must accept whichever one it is handed.
   */
  complete: (
    request: ChatCompletionRequest,
    concreteModel: string,
    credential: string,
  ) => Promise<AdapterChatResult>;
  embed: (
    request: EmbeddingsRequest,
    concreteModel: string,
    credential: string,
  ) => Promise<AdapterEmbeddingsResult>;
  /**
   * Streams a completion. The connection is opened and the response status checked
   * *before* the first event is yielded, so a router can still fall back to the next link
   * in the chain on a retryable `AdapterError` — the same guarantee `complete()` offers.
   * Once the first `content` or `tool_call` event has been yielded, a caller has already
   * forwarded bytes to its own caller and fallback is no longer possible; an error from
   * this point on ends the stream rather than being retried.
   */
  completeStream: (
    request: ChatCompletionRequest,
    concreteModel: string,
    credential: string,
  ) => AsyncGenerator<AdapterStreamEvent, void, void>;
}

interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
  readonly text: () => Promise<string>;
  /** Present for a streaming response; `null` for a provider that has no body to stream. */
  readonly body?: AsyncIterable<Uint8Array> | null;
}

/** The subset of `fetch` an adapter needs — injected so tests never touch the network. */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;
