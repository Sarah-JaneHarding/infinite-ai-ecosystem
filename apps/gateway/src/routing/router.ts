// The fallback chain — Stage 04 steps 3 and 4.
//
// A logical model resolves to an ordered list of (provider, concrete model) links. The
// router tries each in order: a retryable `AdapterError` (rate-limited, unavailable,
// timeout) moves to the next link; anything else — an invalid request, an unauthorized
// credential — is not retried, because trying the next provider would not help and would
// hide the real problem. When a link's own credential pool has nothing available, that is
// itself treated as retryable and the router moves on rather than failing the whole chain.

import type { ChatCompletionRequest, EmbeddingsRequest } from '@infinite-ai/contracts';
import type { Logger } from '@infinite-ai/telemetry';

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
  type ProviderAdapter,
} from '../adapters/types.js';

export interface RouterDeps {
  readonly adapters: Readonly<Record<string, ProviderAdapter>>;
  readonly credentialPools: Readonly<Record<string, CredentialPool>>;
  readonly routing: Readonly<Record<string, readonly RoutingLink[]>>;
  readonly logger?: Logger;
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

/** Validates every routing entry references a configured adapter and pool — a boot check. */
export function createRouter(deps: RouterDeps): {
  routeChatCompletion: (request: ChatCompletionRequest) => Promise<{
    result: AdapterChatResult;
    provider: string;
  }>;
  routeEmbeddings: (request: EmbeddingsRequest) => Promise<{
    result: AdapterEmbeddingsResult;
    provider: string;
  }>;
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
  ): Promise<{ result: Result; provider: string }> {
    const chain = deps.routing[logicalModel];
    if (chain === undefined) throw new UnknownLogicalModelError(logicalModel);

    const attempts: { provider: string; reason: string }[] = [];

    for (const link of chain) {
      const adapter = deps.adapters[link.provider]!;
      const pool = deps.credentialPools[link.provider]!;

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
          continue;
        }
        throw error;
      }

      try {
        const result = await call(adapter, link, credentialHandle.reveal());
        return { result, provider: link.provider };
      } catch (error) {
        if (error instanceof AdapterError) {
          if (error.kind === 'rate_limited') pool.reportRateLimited(credentialHandle);
          attempts.push({ provider: link.provider, reason: error.kind });
          deps.logger?.warn('gateway.fallback', {
            logicalModel,
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

  return {
    routeChatCompletion: (request) =>
      attemptChain(request.model, (adapter, link, credential) =>
        adapter.complete(request, link.concreteModel, credential),
      ),
    routeEmbeddings: (request) =>
      attemptChain(request.model, (adapter, link, credential) =>
        adapter.embed(request, link.concreteModel, credential),
      ),
  };
}
