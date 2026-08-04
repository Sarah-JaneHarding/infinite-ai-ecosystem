// The Model Gateway's external contract — Stage 04 step 1.
//
// `apps/gateway` exposes an OpenAI-compatible surface so any first-party caller (an agent,
// a guardrail, a later module) and any third-party client library that already speaks that
// wire format can use it unmodified. The schemas live here rather than in `apps/gateway`
// itself because callers on both sides of the HTTP boundary — the gateway and every agent
// that will call it from Stage 06 onward — need to agree on the same shape, and a contract
// two packages both import is how they are kept honest with each other rather than with
// prose.
//
// This is deliberately a *subset* of the OpenAI API: enough to route, budget, cache and
// fall back correctly. Fields no caller in this system emits are not modelled.

import { z } from 'zod';

/**
 * A named logical model, e.g. `plan.author` or `screen.classify` (manual §Stage 04 step 4).
 * Callers ask for a logical model, never a concrete provider model — that indirection is
 * what lets routing, fallback and provider changes happen in configuration.
 */
export const LogicalModel = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/, {
    message: 'logical model names look like "domain.action", e.g. "plan.author"',
  });
export type LogicalModel = z.infer<typeof LogicalModel>;

export const ChatRole = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatRole = z.infer<typeof ChatRole>;

export const ChatMessage = z.object({
  role: ChatRole,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ToolDefinition = z.object({
  name: z.string().min(1),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});
export type ToolDefinition = z.infer<typeof ToolDefinition>;

/**
 * The de-identification provenance stamp from `packages/guardrails`' egress guard
 * (Stage 03 step 5), reproduced here as a Zod schema so it can travel over HTTP. A request
 * with no stamp is not an error at the contract level — it is refused at the guard, which
 * is where rule 4 says that decision belongs.
 */
export const DeidentificationProvenance = z.object({
  deidentified: z.literal(true),
  saltVersion: z.number().int().nonnegative(),
  dropped: z.array(z.string()),
});
export type DeidentificationProvenance = z.infer<typeof DeidentificationProvenance>;

/**
 * `tenantId` is required, not inferred from an auth header, so the router, cache and
 * budget tracker all key on the same explicit value a caller cannot forget to pass —
 * mirroring rule 5's insistence that a tenant-scoped operation take its scope as data.
 */
export const ChatCompletionRequest = z.object({
  tenantId: z.string().min(1),
  /** Which module/agent is calling, for budget attribution (step 5). */
  module: z.string().min(1),
  agent: z.string().min(1),
  model: LogicalModel,
  messages: z.array(ChatMessage).min(1),
  tools: z.array(ToolDefinition).optional(),
  temperature: z.number().min(0).max(2).default(0),
  maxOutputTokens: z.number().int().positive().optional(),
  stream: z.boolean().default(false),
  /** Prevents a retried request from being charged or cached twice (step 6). */
  idempotencyKey: z.string().min(1).optional(),
  /**
   * The de-identification stamp for the text in `messages` (Stage 04 step 9). Optional at
   * the schema level because its absence is meaningful — the inbound guard rejects it —
   * rather than a validation failure indistinguishable from a malformed request.
   */
  provenance: DeidentificationProvenance.optional(),
});
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequest>;

export const ChatCompletionUsage = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type ChatCompletionUsage = z.infer<typeof ChatCompletionUsage>;

export const ToolCall = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCall>;

export const ChatCompletionResponse = z.object({
  id: z.string().min(1),
  model: LogicalModel,
  provider: z.string().min(1),
  message: z.object({
    role: z.literal('assistant'),
    content: z.string(),
    toolCalls: z.array(ToolCall).optional(),
  }),
  usage: ChatCompletionUsage,
  /** Whether this response came from the cache rather than a provider call (step 6). */
  cached: z.boolean(),
});
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponse>;

export const EmbeddingsRequest = z.object({
  tenantId: z.string().min(1),
  module: z.string().min(1),
  agent: z.string().min(1),
  model: LogicalModel,
  input: z.array(z.string().min(1)).min(1),
  idempotencyKey: z.string().min(1).optional(),
  /** Same guard, same reasoning as `ChatCompletionRequest.provenance` — an embedding is a
   *  model call too, and rule 4 draws no distinction between the two. */
  provenance: DeidentificationProvenance.optional(),
});
export type EmbeddingsRequest = z.infer<typeof EmbeddingsRequest>;

export const EmbeddingsResponse = z.object({
  model: LogicalModel,
  provider: z.string().min(1),
  vectors: z.array(z.array(z.number())).min(1),
  usage: z.object({ promptTokens: z.number().int().nonnegative() }),
  cached: z.boolean(),
});
export type EmbeddingsResponse = z.infer<typeof EmbeddingsResponse>;

/** A typed refusal from the gateway. Never an HTTP 200 with an error string inside it. */
export const GatewayErrorCode = z.enum([
  'budget_exceeded',
  'all_providers_unavailable',
  'invalid_request',
  'pii_egress_blocked',
]);
export type GatewayErrorCode = z.infer<typeof GatewayErrorCode>;

export const GatewayErrorBody = z.object({
  error: z.object({
    code: GatewayErrorCode,
    message: z.string(),
  }),
});
export type GatewayErrorBody = z.infer<typeof GatewayErrorBody>;
