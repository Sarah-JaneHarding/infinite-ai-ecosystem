// The AI-assistant connector registry — the contract behind "chat with Claude, Gemini,
// Copilot, Qwen or Grok live inside the platform".
//
// A connector is DATA: which logical model a picker entry resolves to, and which gateway
// provider key serves it. Nothing here imports a provider SDK or knows a URL (rule 3) —
// the gateway turns this table into routing, and the web surface only ever sends a
// connector id. Adding a sixth assistant is a row here plus an env block in the gateway,
// not a new code path.
//
// Deliberate: each connector routes to exactly ONE provider, with no cross-provider
// fallback. A staff member who picked Grok must never be silently answered by Claude.
//
// Toqi is intentionally absent: it is a consumer app with no published API, so there is
// nothing to connect to (docs/OPEN_QUESTIONS.md).

import { z } from 'zod';

import { ChatMessage, type LogicalModel } from './chat.js';

export const AssistantProvider = z.enum(['claude', 'gemini', 'copilot', 'qwen', 'grok']);
export type AssistantProvider = z.infer<typeof AssistantProvider>;

export interface AssistantConnector {
  readonly id: AssistantProvider;
  /** What the picker shows. */
  readonly label: string;
  readonly vendor: string;
  /** The logical model callers request from the gateway. */
  readonly logicalModel: LogicalModel;
  /** The gateway adapter-registry key that serves it (the routing file's `provider`). */
  readonly gatewayProvider: 'anthropic' | 'google' | 'azure' | 'qwen' | 'xai';
}

export const ASSISTANT_CONNECTORS: readonly AssistantConnector[] = [
  {
    id: 'claude',
    label: 'Claude',
    vendor: 'Anthropic',
    logicalModel: 'assistant.claude',
    gatewayProvider: 'anthropic',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    vendor: 'Google',
    logicalModel: 'assistant.gemini',
    gatewayProvider: 'google',
  },
  {
    id: 'copilot',
    label: 'Copilot (Azure OpenAI)',
    vendor: 'Microsoft',
    logicalModel: 'assistant.copilot',
    gatewayProvider: 'azure',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    vendor: 'Alibaba Cloud',
    logicalModel: 'assistant.qwen',
    gatewayProvider: 'qwen',
  },
  {
    id: 'grok',
    label: 'Grok',
    vendor: 'xAI',
    logicalModel: 'assistant.grok',
    gatewayProvider: 'xai',
  },
];

export function connectorFor(id: AssistantProvider): AssistantConnector {
  const found = ASSISTANT_CONNECTORS.find((c) => c.id === id);
  if (found === undefined)
    throw new Error(`No assistant connector registered for "${id}".`);
  return found;
}

/**
 * What the browser may send. Only `user` and `assistant` turns: a client-supplied `system`
 * or `tool` message would let a staff member (or a hijacked session) rewrite the
 * platform's instructions. Strict, so a stray `tenantId` or `model` field is refused
 * rather than ignored — tenant and actor come from the verified session, never the body.
 */
export const AssistantChatRequest = z
  .object({
    provider: AssistantProvider,
    messages: z
      .array(ChatMessage.extend({ role: z.enum(['user', 'assistant']) }).strict())
      .min(1)
      .max(40),
  })
  .strict();
export type AssistantChatRequest = z.infer<typeof AssistantChatRequest>;

/** One kind of personal information the scrubber removed, and how many times. Counts only —
 *  never the original text, because this object is logged and audited. */
export const AssistantRedactionSummary = z.object({
  kind: z.string().min(1),
  count: z.number().int().positive(),
});
export type AssistantRedactionSummary = z.infer<typeof AssistantRedactionSummary>;

export const AssistantChatResponse = z.object({
  provider: AssistantProvider,
  message: z.object({ role: z.literal('assistant'), content: z.string() }),
  usage: z.object({ totalTokens: z.number().int().nonnegative() }),
  /** What was removed from the conversation before the model saw it (rule 4). */
  redactions: z.array(AssistantRedactionSummary),
  /** The user's latest message exactly as the model received it — the user sees what left. */
  sent: z.string(),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponse>;

/** `GET /v1/assistants` on the gateway: the connectors this deployment holds credentials for. */
export const AssistantConnectorList = z.object({
  assistants: z.array(z.object({ id: AssistantProvider, label: z.string().min(1) })),
});
export type AssistantConnectorList = z.infer<typeof AssistantConnectorList>;
