// @infinite-ai/gateway — Model gateway service. The only egress point for model traffic.
//
// Wires the pieces built across Stage 04 into a running service: credential pools and
// adapters from the environment, the routing chain from a config file, budgets and cache
// in memory, and the HTTP surface in `server.ts`.
//
// One thing this boot script still does not invent, because inventing it would be worse
// than leaving it undone: **provider pricing.** Cost estimation defaults to zero per call.
// A school's hard budget limit is real and enforced the moment a real per-model price is
// supplied; until then, zero cost means the budget tracker never refuses on cost grounds,
// which is the safe default — the same shape of decision the retention schedule template
// makes by shipping no periods rather than invented ones.
//
// The tenant lexicon resolver (step 9) *is* wired to `packages/db` below, behind one
// placeholder worth being explicit about: `readTenantLexicon` runs inside `withTenant()`,
// which requires an `actorId` to attribute the read to (Stage 02's audit trail). There is
// no real caller identity on the wire yet — that arrives with Stage 06's agent runtime —
// so `GATEWAY_SERVICE_ACTOR_ID` stands in as a fixed, documented system actor for this one
// read-only lookup. Replacing it with the calling agent's real identity is Stage 06's to
// do, not a gap to paper over here.

import { readFileSync } from 'node:fs';

import { loadEnv } from '@infinite-ai/config';
import { EncryptionKey, readTenantLexicon, withTenant } from '@infinite-ai/db';
import {
  NOOP_TRACER,
  createLogger,
  createTracer,
  parseOtlpHeaders,
  type Tracer,
} from '@infinite-ai/telemetry';
import type { TenantLexicon } from '@infinite-ai/deident';

import { createAnthropicAdapter } from './adapters/anthropic.js';
import { createOpenAiCompatibleAdapter } from './adapters/openai-compatible.js';
import type { FetchLike, ProviderAdapter } from './adapters/types.js';
import { BudgetTracker } from './budgets/budget.js';
import { GatewayCache } from './cache/cache.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { loadGatewayEnv } from './config/env.js';
import { CredentialPool } from './credentials/pool.js';
import {
  DEFAULT_ROUTING_CONFIG,
  parseRoutingConfig,
  type RoutingLink,
} from './routing/config.js';
import { createRouter } from './routing/router.js';
import { createGatewayServer, type CostEstimator } from './server.js';

export const PACKAGE_NAME = '@infinite-ai/gateway' as const;

export function buildAdapters(
  env: ReturnType<typeof loadGatewayEnv>,
  fetchImpl: FetchLike,
): {
  adapters: Record<string, ProviderAdapter>;
  credentialPools: Record<string, CredentialPool>;
} {
  const adapters: Record<string, ProviderAdapter> = {};
  const credentialPools: Record<string, CredentialPool> = {};

  if (env.ANTHROPIC_API_KEYS !== undefined) {
    credentialPools.anthropic = new CredentialPool('anthropic', env.ANTHROPIC_API_KEYS);
    adapters.anthropic = createAnthropicAdapter({
      baseUrl: env.ANTHROPIC_BASE_URL,
      fetchImpl,
    });
  }
  if (env.OPENAI_API_KEYS !== undefined) {
    credentialPools.openai = new CredentialPool('openai', env.OPENAI_API_KEYS);
    adapters.openai = createOpenAiCompatibleAdapter({
      provider: 'openai',
      baseUrl: env.OPENAI_BASE_URL,
      fetchImpl,
    });
  }
  if (env.LOCAL_MODEL_BASE_URL !== undefined && env.LOCAL_MODEL_API_KEYS !== undefined) {
    credentialPools.local = new CredentialPool('local', env.LOCAL_MODEL_API_KEYS);
    adapters.local = createOpenAiCompatibleAdapter({
      provider: 'local',
      baseUrl: env.LOCAL_MODEL_BASE_URL,
      fetchImpl,
    });
  }

  return { adapters, credentialPools };
}

export function loadRouting(
  env: ReturnType<typeof loadGatewayEnv>,
): Record<string, readonly RoutingLink[]> {
  if (env.ROUTING_CONFIG_PATH === undefined) return DEFAULT_ROUTING_CONFIG;
  return parseRoutingConfig(JSON.parse(readFileSync(env.ROUTING_CONFIG_PATH, 'utf8')));
}

export const failClosedLexicon = async (tenantId: string): Promise<TenantLexicon> => {
  throw new Error(
    `No tenant lexicon resolver is configured. Refusing to guess for tenant ${tenantId} — ` +
      'DB_ENCRYPTION_KEY is not set, so the learner-name layer of the PII guard cannot run.',
  );
};

/** A fixed system actor for the gateway's own read-only lexicon lookups — see the file
 *  header note on why this stands in for real caller identity until Stage 06. */
export const GATEWAY_SERVICE_ACTOR_ID = '00000000-0000-0000-0000-000000000004';

/**
 * Builds the real resolver when `DB_ENCRYPTION_KEY` is configured, or `failClosedLexicon`
 * when it is not — a missing key is exactly the case `packages/config`'s own comment on
 * the field describes ("the services that never touch learner identifiers should not be
 * made to carry it"), except the gateway *does* need it for this one purpose, so its
 * absence here is a real, visible refusal rather than a silently disabled guard.
 */
export function buildLexiconResolver(
  env: ReturnType<typeof loadEnv>,
): (tenantId: string) => Promise<TenantLexicon> {
  if (env.DB_ENCRYPTION_KEY === undefined) return failClosedLexicon;
  const key = EncryptionKey.fromBase64(
    env.DB_ENCRYPTION_KEY,
    env.DB_ENCRYPTION_KEY_VERSION,
  );
  return (tenantId) =>
    withTenant({ tenantId, actorId: GATEWAY_SERVICE_ACTOR_ID }, (tx) =>
      readTenantLexicon(tx, key),
    );
}

const zeroCost: CostEstimator = () => 0;

/**
 * Builds the gateway's tracer from the shared environment — `OTEL_EXPORTER_OTLP_ENDPOINT`
 * and `OTEL_EXPORTER_OTLP_HEADERS` are shared config (see `packages/config`'s comment on
 * them), not gateway-only, since every future service that ships traces uses the same
 * exporter. No endpoint configured means `createTracer` returns the no-op tracer — see
 * `packages/telemetry/src/tracing.ts`'s file header for why that fails open rather than
 * closed, unlike the PII guard or the budget check.
 */
export function buildTracer(env: ReturnType<typeof loadEnv>): Tracer {
  const otlpHeaders = parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
  return createTracer({
    serviceName: 'infinite-ai-gateway',
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined
      ? { otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }
      : {}),
    ...(otlpHeaders !== undefined ? { otlpHeaders } : {}),
  });
}

/**
 * `env`/`gatewayEnv` are optional and default to the real, cached, `process.env`-backed
 * loaders. Accepting them as parameters — rather than calling the loaders unconditionally
 * — means a test can supply an explicit environment without touching `process.env` at
 * all, the same reason `parseEnv`/`parseGatewayEnv` exist alongside `loadEnv`/
 * `loadGatewayEnv`.
 */
export function boot(
  env: ReturnType<typeof loadEnv> = loadEnv(),
  gatewayEnv: ReturnType<typeof loadGatewayEnv> = loadGatewayEnv(),
): ReturnType<typeof createGatewayServer> {
  const logger = createLogger({ level: env.LOG_LEVEL });

  const { adapters, credentialPools } = buildAdapters(gatewayEnv, fetch as FetchLike);
  for (const pool of Object.values(credentialPools)) {
    for (const s of pool.secrets()) logger.redact(s);
  }
  if (Object.keys(adapters).length === 0) {
    logger.warn('gateway.boot', {
      message: 'No provider credentials configured. Every route will fail at the router.',
    });
  }
  const resolveLexicon = buildLexiconResolver(env);
  if (resolveLexicon === failClosedLexicon) {
    logger.warn('gateway.boot', {
      message:
        'DB_ENCRYPTION_KEY not set. The PII guard will fail closed on every request.',
    });
  }

  // Five consecutive provider-health failures open the breaker for 30s before a single
  // half-open trial — a sane starting default, not a ratified SLO; tune once real traffic
  // gives this something to tune against (Stage 06 step 8).
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    openDurationMs: 30_000,
  });

  const router = createRouter({
    adapters,
    credentialPools,
    routing: loadRouting(gatewayEnv),
    logger,
    circuitBreaker,
  });

  const tracer = buildTracer(env);
  if (tracer === NOOP_TRACER) {
    logger.warn('gateway.boot', {
      message: 'OTEL_EXPORTER_OTLP_ENDPOINT not set. No LLM traces will reach Langfuse.',
    });
  }

  return createGatewayServer({
    router,
    budget: new BudgetTracker({ limitsFor: () => undefined }),
    cache: new GatewayCache(),
    resolveLexicon,
    costEstimator: zeroCost,
    logger,
    tracer,
  });
}
