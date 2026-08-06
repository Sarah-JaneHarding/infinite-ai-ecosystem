// The fallback chain — Stage 04 steps 3 and 4.
//
// A logical model resolves to an ordered list of (provider, concrete model) links. The
// router tries each in order: a retryable `AdapterError` (rate-limited, unavailable,
// timeout) moves to the next link; anything else — an invalid request, an unauthorized
// credential — is not retried, because trying the next provider would not help and would
// hide the real problem. When a link's own credential pool has nothing available, that is
// itself treated as retryable and the router moves on rather than failing the whole chain.
//
// `circuitBreaker` (Stage 06 step 8) is optional: every existing caller that omits it sees
// no change in behaviour. Supplied, it is checked before a link is even attempted — an
// open breaker is treated exactly like "no credential available" (retryable, move to the
// next link) — and reported to after every attempt: a success closes it, a retryable
// failure counts against it. A non-retryable `AdapterError` (`invalid_request`,
// `unauthorized`) is never reported, the same distinction `circuit-breaker.ts`'s own header
// draws between a provider problem and a request or credential one.

import type { ChatCompletionRequest, EmbeddingsRequest } from '@infinite-ai/contracts';
import type { Logger, Span } from '@infinite-ai/telemetry';

import type { CircuitBreaker } from '../circuit-breaker.js';
import {
  type CredentialPool,
  NoCredentialAvailableError,
  type CredentialHandle,
} from '../credentials/pool.js';
import type { RoutingLink } from './config.js';
import {
  AdapterError,
  type AdapterChatResult,
  type AdapterEmbeddingsResult,
  type AdapterStreamEvent,
  type ProviderAdapter,
} from '../adapters/types.js';

export interface RouterDeps {
  readonly adapters: Readonly<Record<string, ProviderAdapter>>;
  readonly credentialPools: Readonly<Record<string, CredentialPool>>;
  readonly routing: Readonly<Record<string, readonly RoutingLink[]>>;
  readonly logger?: Logger;
  readonly circuitBreaker?: CircuitBreaker;
}

export class UnknownLogicalModelError extends Error {
  public override readonly name = 'UnknownLogicalModelError';
  constructor(model: string) {
    super(`No routing entry for logical model "${model}".`);
  }
}

export class AllProvidersUnavailableError extends Error {
  public override readonly name = 'AllProvidersUnavailableError';
  constructor(
    model: string,
    public readonly attempts: readonly { provider: string; reason: string }[],
  ) {
    super(
      `Every provider in the fallback chain for "${model}" failed: ` +
        attempts.map((a) => `${a.provider} (${a.reason})`).join(', '),
    );
  }
}

export interface StreamedChatEvent {
  readonly event: AdapterStreamEvent;
  readonly provider: string;
}

/** Validates every routing entry references a configured adapter and pool — a boot check. */
export function createRouter(deps: RouterDeps): {
  routeChatCompletion: (
    request: ChatCompletionRequest,
    span?: Span,
  ) => Promise<{
    result: AdapterChatResult;
    provider: string;
  }>;
  routeEmbeddings: (
    request: EmbeddingsRequest,
    span?: Span,
  ) => Promise<{
    result: AdapterEmbeddingsResult;
    provider: string;
  }>;
  routeChatCompletionStream: (
    request: ChatCompletionRequest,
    span?: Span,
  ) => AsyncGenerator<StreamedChatEvent, void, void>;
} {
  for (const [model, chain] of Object.entries(deps.routing)) {
    for (const link of chain) {
      if (deps.adapters[link.provider] === undefined) {
        throw new Error(
          `Routing config for "${model}" references unknown provider "${link.provider}".`,
        );
      }
      if (deps.credentialPools[link.provider] === undefined) {
        throw new Error(
          `Routing config for "${model}" references provider "${link.provider}" with no ` +
            'credential pool.',
        );
      }
    }
  }

  async function attemptChain<Result>(
    logicalModel: string,
    call: (
      adapter: ProviderAdapter,
      link: RoutingLink,
      credential: string,
    ) => Promise<Result>,
    span?: Span,
  ): Promise<{ result: Result; provider: string }> {
    const chain = deps.routing[logicalModel];
    if (chain === undefined) throw new UnknownLogicalModelError(logicalModel);

    const attempts: { provider: string; reason: string }[] = [];

    for (const link of chain) {
      const adapter = deps.adapters[link.provider]!;
      const pool = deps.credentialPools[link.provider]!;

      if (deps.circuitBreaker?.allowsRequest(link.provider) === false) {
        attempts.push({ provider: link.provider, reason: 'circuit open' });
        deps.logger?.warn('gateway.fallback', {
          logicalModel,
          provider: link.provider,
          reason: 'circuit_open',
        });
        span?.addEvent('gateway.fallback', {
          provider: link.provider,
          reason: 'circuit_open',
        });
        continue;
      }

      let credentialHandle: CredentialHandle;
      try {
        credentialHandle = pool.take();
      } catch (error) {
        if (error instanceof NoCredentialAvailableError) {
          attempts.push({ provider: link.provider, reason: 'no credential available' });
          deps.logger?.warn('gateway.fallback', {
            logicalModel,
            provider: link.provider,
            reason: 'no_credential',
          });
          span?.addEvent('gateway.fallback', {
            provider: link.provider,
            reason: 'no_credential',
          });
          continue;
        }
        throw error;
      }

      try {
        const result = await call(adapter, link, credentialHandle.reveal());
        deps.circuitBreaker?.recordSuccess(link.provider);
        return { result, provider: link.provider };
      } catch (error) {
        if (error instanceof AdapterError) {
          if (error.kind === 'rate_limited') pool.reportRateLimited(credentialHandle);
          if (error.retryable) deps.circuitBreaker?.recordFailure(link.provider);
          attempts.push({ provider: link.provider, reason: error.kind });
          deps.logger?.warn('gateway.fallback', {
            logicalModel,
            provider: link.provider,
            reason: error.kind,
          });
          span?.addEvent('gateway.fallback', {
            provider: link.provider,
            reason: error.kind,
          });
          if (error.retryable) continue;
        }
        throw error;
      }
    }

    throw new AllProvidersUnavailableError(logicalModel, attempts);
  }

  /**
   * The streaming counterpart of `attemptChain`. Fallback is only possible up to the
   * *first* event a link yields — once one event has left this generator, a caller has
   * already forwarded bytes to its own caller, and switching providers mid-stream would
   * mean either duplicating or silently losing content. So each link's generator is primed
   * with exactly one `next()` call before anything is yielded; a retryable failure there
   * moves to the next link exactly like the non-streaming path, and everything after that
   * first successful event is passed through unconditionally.
   */
  async function* attemptStreamChain(
    logicalModel: string,
    call: (
      adapter: ProviderAdapter,
      link: RoutingLink,
      credential: string,
    ) => AsyncGenerator<AdapterStreamEvent, void, void>,
    span?: Span,
  ): AsyncGenerator<StreamedChatEvent, void, void> {
    const chain = deps.routing[logicalModel];
    if (chain === undefined) throw new UnknownLogicalModelError(logicalModel);

    const attempts: { provider: string; reason: string }[] = [];

    for (const link of chain) {
      const adapter = deps.adapters[link.provider]!;
      const pool = deps.credentialPools[link.provider]!;

      if (deps.circuitBreaker?.allowsRequest(link.provider) === false) {
        attempts.push({ provider: link.provider, reason: 'circuit open' });
        span?.addEvent('gateway.fallback', {
          provider: link.provider,
          reason: 'circuit_open',
        });
        continue;
      }

      let credentialHandle: CredentialHandle;
      try {
        credentialHandle = pool.take();
      } catch (error) {
        if (error instanceof NoCredentialAvailableError) {
          attempts.push({ provider: link.provider, reason: 'no credential available' });
          span?.addEvent('gateway.fallback', {
            provider: link.provider,
            reason: 'no_credential',
          });
          continue;
        }
        throw error;
      }

      const generator = call(adapter, link, credentialHandle.reveal());
      let first: IteratorResult<AdapterStreamEvent, void>;
      try {
        first = await generator.next();
      } catch (error) {
        if (error instanceof AdapterError) {
          if (error.kind === 'rate_limited') pool.reportRateLimited(credentialHandle);
          if (error.retryable) deps.circuitBreaker?.recordFailure(link.provider);
          attempts.push({ provider: link.provider, reason: error.kind });
          deps.logger?.warn('gateway.fallback', {
            logicalModel,
            provider: link.provider,
            reason: error.kind,
          });
          span?.addEvent('gateway.fallback', {
            provider: link.provider,
            reason: error.kind,
          });
          if (error.retryable) continue;
        }
        throw error;
      }

      // Committed to this link now — no further fallback is possible.
      deps.circuitBreaker?.recordSuccess(link.provider);
      if (!first.done) yield { event: first.value, provider: link.provider };
      for await (const event of generator) {
        yield { event, provider: link.provider };
      }
      return;
    }

    throw new AllProvidersUnavailableError(logicalModel, attempts);
  }

  return {
    routeChatCompletion: (request, span) =>
      attemptChain(
        request.model,
        (adapter, link, credential) =>
          adapter.complete(request, link.concreteModel, credential),
        span,
      ),
    routeEmbeddings: (request, span) =>
      attemptChain(
        request.model,
        (adapter, link, credential) =>
          adapter.embed(request, link.concreteModel, credential),
        span,
      ),
    routeChatCompletionStream: (request, span) =>
      attemptStreamChain(
        request.model,
        (adapter, link, credential) =>
          adapter.completeStream(request, link.concreteModel, credential),
        span,
      ),
  };
}
