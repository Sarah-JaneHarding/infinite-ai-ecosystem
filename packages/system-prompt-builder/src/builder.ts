// System Prompt Builder — Stage 21.
//
// Composes the complete system message and gateway request from:
//   1. The platform header (identity, tenant context, universal rules)
//   2. The agent's system sections (from @infinite-ai/prompt-builder)
//   3. The platform footer (compliance assertion)
//
// The output is a `ChatCompletionRequest` ready to pass to the gateway.
// This is the final step in the prompt pipeline before an HTTP call is made.

import { type ChatCompletionRequest } from '@infinite-ai/contracts';
import { type BuiltPrompt } from '@infinite-ai/prompt-builder';
import { z } from 'zod';

import { buildPlatformFooter, buildPlatformHeader } from './platform-rails.js';
import { type TenantContext } from './tenant-context.js';

// ─── Request metadata ─────────────────────────────────────────────────────────

/** Per-call metadata that is not part of the prompt itself. */
export const RequestMeta = z.object({
  /** Which module is making this call (for budget attribution). */
  module: z.string().min(1),
  /** Whether to request a streaming response from the gateway. */
  stream: z.boolean().default(false),
  /** Optional idempotency key — prevents double-billing on retries. */
  idempotencyKey: z.string().min(1).optional(),
  /**
   * De-identification provenance stamp. Required before the guardrail will pass
   * the request through; the system-prompt builder carries it transparently since
   * the provenance is attached to the grounding data, not the system prompt.
   */
  provenance: z
    .object({
      deidentified: z.literal(true),
      saltVersion: z.number().int().nonnegative(),
      dropped: z.array(z.string()),
    })
    .optional(),
});
export type RequestMeta = z.infer<typeof RequestMeta>;

// ─── Assembled system message ─────────────────────────────────────────────────

export interface AssembledSystemMessage {
  /** Full system message content: header + agent sections + footer. */
  readonly content: string;
  /** The agent@version this was assembled for, for tracing. */
  readonly source: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assembles the complete system message by wrapping the agent's system sections
 * with platform rails.
 */
export function buildSystemMessage(
  builtPrompt: BuiltPrompt,
  tenant: TenantContext,
): AssembledSystemMessage {
  const header = buildPlatformHeader(tenant);
  const footer = buildPlatformFooter();
  const content = [header, builtPrompt.system, footer].join('\n\n');
  return { content, source: builtPrompt.source };
}

/**
 * Builds a complete `ChatCompletionRequest` ready for the gateway.
 *
 * The request contains:
 * - A `system` message with platform rails + agent system sections.
 * - A `user` message with the agent's GROUNDING and TASK sections.
 */
export function buildChatRequest(
  builtPrompt: BuiltPrompt,
  tenant: TenantContext,
  meta: RequestMeta,
): ChatCompletionRequest {
  const { content: systemContent } = buildSystemMessage(builtPrompt, tenant);

  return {
    tenantId: tenant.tenantId,
    module: meta.module,
    agent: builtPrompt.source,
    model: extractLogicalModel(builtPrompt.source),
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: builtPrompt.userTurn },
    ],
    temperature: 0,
    maxOutputTokens: builtPrompt.maxOutputTokens,
    stream: meta.stream,
    idempotencyKey: meta.idempotencyKey,
    provenance: meta.provenance,
  };
}

/**
 * Derives a gateway logical-model name from a prompt source string.
 *
 * The source format is "<AGENT-ID>@<version>", e.g. "CE-03@1.0.0".
 * The agent id maps to a logical model via a simple normalisation:
 *   CE-* → "curriculum.plan"
 *   AC-* → "analytics.screen"
 *   DW-* → "warehouse.ingest"
 *   TB-* → "toolbox.generate"
 *   PD-* → "pd.brief"
 *   LE-* → "learning.adapt"
 * Unknown agents fall back to "general.complete".
 */
function extractLogicalModel(source: string): string {
  const agentId = source.split('@')[0] ?? source;
  if (agentId.startsWith('CE-')) return 'curriculum.plan';
  if (agentId.startsWith('AC-')) return 'analytics.screen';
  if (agentId.startsWith('DW-')) return 'warehouse.ingest';
  if (agentId.startsWith('TB-')) return 'toolbox.generate';
  if (agentId.startsWith('PD-')) return 'pd.brief';
  if (agentId.startsWith('LE-')) return 'learning.adapt';
  return 'general.complete';
}
