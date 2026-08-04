// The gateway's HTTP surface — Stage 04 step 1.
//
// OpenAI-compatible on purpose: `/v1/chat/completions` and `/v1/embeddings`, so any
// caller that already speaks that wire format works unmodified. Built on Node's own
// `http` rather than a framework — this is one small, tightly-scoped service, and the
// project's own pattern elsewhere (`encryption.ts` on `node:crypto`, the audit ledger on
// `node:crypto`) is to reach for what is already in the tree before adding a dependency.
//
// Every request passes through the same order, and that order is the point:
//   parse and validate → PII egress guard (step 9) → budget check (step 5, before the
//   call) → cache lookup (step 6) → route with fallback (steps 3-4) → cache + budget record
//
// Streaming (step 7) is not implemented by this server yet — a `stream: true` request gets
// a typed `invalid_request` refusal naming that, rather than a response that silently
// ignores the flag and returns a single completion under a streaming client's nose.

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import {
  ChatCompletionRequest,
  EmbeddingsRequest,
  type ChatCompletionResponse,
  type EmbeddingsResponse,
  type GatewayErrorCode,
} from '@infinite-ai/contracts';
import { assertEgressAllowed, PiiEgressError } from '@infinite-ai/guardrails';
import type { TenantLexicon } from '@infinite-ai/deident';
import type { Logger } from '@infinite-ai/telemetry';

import { AdapterError } from './adapters/types.js';
import type { BudgetTracker } from './budgets/budget.js';
import { type GatewayCache, contentKey, idempotencyCacheKey } from './cache/cache.js';
import {
  AllProvidersUnavailableError,
  UnknownLogicalModelError,
  type createRouter,
} from './routing/router.js';

export interface CostEstimator {
  (
    provider: string,
    concreteModel: string,
    usage: { promptTokens: number; completionTokens: number },
  ): number;
}

export interface GatewayServerDeps {
  readonly router: ReturnType<typeof createRouter>;
  readonly budget: BudgetTracker;
  readonly cache: GatewayCache;
  readonly resolveLexicon: (tenantId: string) => Promise<TenantLexicon>;
  readonly costEstimator: CostEstimator;
  readonly logger: Logger;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

function sendError(
  res: ServerResponse,
  status: number,
  code: GatewayErrorCode,
  message: string,
): void {
  sendJson(res, status, { error: { code, message } });
}

/**
 * Turns a routing failure into a typed HTTP response, or returns `false` for anything it
 * does not recognise so the caller can fall back to a generic 500 rather than lying about
 * what happened.
 *
 * `AdapterError` reaching here means the router stopped the chain on a non-retryable
 * failure (step 10: a caller must never see a bare 500 for a provider that rejected the
 * request or the credential — that is exactly the "clear typed error" the drill requires).
 */
function sendRoutingError(res: ServerResponse, error: unknown): boolean {
  if (error instanceof AllProvidersUnavailableError) {
    sendError(res, 503, 'all_providers_unavailable', error.message);
    return true;
  }
  if (error instanceof UnknownLogicalModelError) {
    sendError(res, 400, 'invalid_request', error.message);
    return true;
  }
  if (error instanceof AdapterError) {
    sendError(res, 502, 'all_providers_unavailable', error.message);
    return true;
  }
  return false;
}

/**
 * exactOptionalPropertyTypes treats `{ idempotency: undefined }` as distinct from
 * `{ idempotency omitted }`, and `CacheStore`'s key type wants the latter.
 */
function buildCacheKeys(
  content: string,
  idempotencyKeyValue: string | undefined,
  tenantId: string,
): { readonly content: string; readonly idempotency?: string } {
  return idempotencyKeyValue === undefined
    ? { content }
    : { content, idempotency: idempotencyCacheKey(tenantId, idempotencyKeyValue) };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length === 0 ? {} : JSON.parse(raw);
}

async function handleChatCompletions(
  req: IncomingMessage,
  res: ServerResponse,
  deps: GatewayServerDeps,
): Promise<void> {
  let candidate: unknown;
  try {
    candidate = await readBody(req);
  } catch {
    sendError(res, 400, 'invalid_request', 'Request body is not valid JSON.');
    return;
  }

  const parsed = ChatCompletionRequest.safeParse(candidate);
  if (!parsed.success) {
    sendError(
      res,
      400,
      'invalid_request',
      parsed.error.issues.map((i) => i.message).join('; '),
    );
    return;
  }
  const request = parsed.data;

  if (request.stream) {
    sendError(
      res,
      400,
      'invalid_request',
      'Streaming is not yet implemented by this gateway deployment (Stage 04 step 7).',
    );
    return;
  }

  try {
    const lexicon = await deps.resolveLexicon(request.tenantId);
    assertEgressAllowed(
      {
        tenantId: request.tenantId,
        texts: request.messages.map((m) => m.content),
        provenance: request.provenance,
      },
      lexicon,
    );
  } catch (error) {
    if (error instanceof PiiEgressError) {
      sendError(res, 403, 'pii_egress_blocked', error.message);
      return;
    }
    throw error;
  }

  const scope = {
    tenantId: request.tenantId,
    module: request.module,
    agent: request.agent,
  };
  const budgetVerdict = deps.budget.check(scope);
  if (!budgetVerdict.allowed) {
    sendError(res, 429, 'budget_exceeded', budgetVerdict.reason);
    return;
  }
  if (budgetVerdict.warning !== null) {
    deps.logger.warn('gateway.budget_warning', {
      ...scope,
      warning: budgetVerdict.warning,
    });
  }

  const keys = buildCacheKeys(
    contentKey(request.tenantId, request.model, {
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
    }),
    request.idempotencyKey,
    request.tenantId,
  );

  const cached = deps.cache.lookup<ChatCompletionResponse>(keys);
  if (cached !== undefined) {
    sendJson(res, 200, { ...cached, cached: true });
    return;
  }

  try {
    const { result, provider } = await deps.router.routeChatCompletion(request);
    const response: ChatCompletionResponse = {
      id: `chatcmpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      model: request.model,
      provider,
      message: {
        role: 'assistant',
        content: result.content,
        ...(result.toolCalls !== undefined
          ? { toolCalls: result.toolCalls.map((call) => ({ ...call })) }
          : {}),
      },
      usage: result.usage,
      cached: false,
    };
    deps.cache.record(keys, response);
    deps.budget.record(scope, deps.costEstimator(provider, request.model, result.usage));
    sendJson(res, 200, response);
  } catch (error) {
    if (sendRoutingError(res, error)) return;
    throw error;
  }
}

async function handleEmbeddings(
  req: IncomingMessage,
  res: ServerResponse,
  deps: GatewayServerDeps,
): Promise<void> {
  let candidate: unknown;
  try {
    candidate = await readBody(req);
  } catch {
    sendError(res, 400, 'invalid_request', 'Request body is not valid JSON.');
    return;
  }

  const parsed = EmbeddingsRequest.safeParse(candidate);
  if (!parsed.success) {
    sendError(
      res,
      400,
      'invalid_request',
      parsed.error.issues.map((i) => i.message).join('; '),
    );
    return;
  }
  const request = parsed.data;

  try {
    const lexicon = await deps.resolveLexicon(request.tenantId);
    assertEgressAllowed(
      {
        tenantId: request.tenantId,
        texts: request.input,
        provenance: request.provenance,
      },
      lexicon,
    );
  } catch (error) {
    if (error instanceof PiiEgressError) {
      sendError(res, 403, 'pii_egress_blocked', error.message);
      return;
    }
    throw error;
  }

  const scope = {
    tenantId: request.tenantId,
    module: request.module,
    agent: request.agent,
  };
  const budgetVerdict = deps.budget.check(scope);
  if (!budgetVerdict.allowed) {
    sendError(res, 429, 'budget_exceeded', budgetVerdict.reason);
    return;
  }

  const keys = buildCacheKeys(
    contentKey(request.tenantId, request.model, { input: request.input }),
    request.idempotencyKey,
    request.tenantId,
  );

  const cached = deps.cache.lookup<EmbeddingsResponse>(keys);
  if (cached !== undefined) {
    sendJson(res, 200, { ...cached, cached: true });
    return;
  }

  try {
    const { result, provider } = await deps.router.routeEmbeddings(request);
    const response: EmbeddingsResponse = {
      model: request.model,
      provider,
      vectors: result.vectors.map((vector) => [...vector]),
      usage: result.usage,
      cached: false,
    };
    deps.cache.record(keys, response);
    deps.budget.record(
      scope,
      deps.costEstimator(provider, request.model, {
        promptTokens: result.usage.promptTokens,
        completionTokens: 0,
      }),
    );
    sendJson(res, 200, response);
  } catch (error) {
    if (sendRoutingError(res, error)) return;
    throw error;
  }
}

export function createGatewayServer(
  deps: GatewayServerDeps,
): ReturnType<typeof createHttpServer> {
  return createHttpServer((req, res) => {
    void (async () => {
      try {
        if (req.method === 'GET' && req.url === '/health') {
          sendJson(res, 200, { status: 'ok' });
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/chat/completions') {
          await handleChatCompletions(req, res, deps);
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/embeddings') {
          await handleEmbeddings(req, res, deps);
          return;
        }
        sendError(
          res,
          404,
          'invalid_request',
          `No route for ${req.method ?? 'GET'} ${req.url ?? '/'}.`,
        );
      } catch (error) {
        deps.logger.error('gateway.unhandled_error', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        sendError(res, 500, 'invalid_request', 'Internal gateway error.');
      }
    })();
  });
}
