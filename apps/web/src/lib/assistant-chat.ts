// The in-app AI assistant: what happens between a staff member pressing Send and a model
// seeing their words.
//
// The order is the point, and each step is a rule from CLAUDE.md:
//   1. the caller is a verified staff session (the route checks the token; tenant and actor
//      never come from the body);
//   2. every turn is scrubbed against the school's own lexicon — free text is where a teacher
//      types a learner's name (rule 4);
//   3. the scrubbed text is stamped `deidentified: true` and sent to the model gateway — never
//      to a provider (rule 3). The gateway re-checks the stamp and the lexicon on its own;
//      scrubbing here is what makes that check pass, not a replacement for it;
//   4. an audit event records that it happened — provider, counts, tokens — and never the text.
//
// Everything with a side effect is a dependency, so the whole flow is testable without a
// network, a database or a session.

import {
  AssistantConnectorList,
  ChatCompletionResponse,
  GatewayErrorBody,
  connectorFor,
  type AssistantChatRequest,
  type AssistantChatResponse,
  type AssistantRedactionSummary,
  type ChatMessage,
} from '@infinite-ai/contracts';
import { scrub, type TenantLexicon } from '@infinite-ai/deident';

/** The module and agent names the gateway attributes assistant spend to (budgets, traces). */
export const ASSISTANT_MODULE = 'assistant';
export const ASSISTANT_AGENT = 'staff-chat';

/**
 * Operator instructions, added by the server — a client can never send a system message
 * (`AssistantChatRequest` refuses one). It tells the model what the scrubber already did, and
 * keeps it from inventing curriculum policy (CLAUDE.md: never invent CAPS, ATP, SIAS or SACE).
 */
export const ASSISTANT_SYSTEM_PROMPT =
  'You are an assistant for staff at a South African primary school. Personal information ' +
  'about learners, guardians and staff has been removed and replaced with placeholders; never ' +
  'ask for it and never try to work out who a placeholder refers to. Do not invent CAPS, ATP, ' +
  'SIAS or SACE rules, assessment weightings or CPTD point values: if you are not sure, say ' +
  'so and point to the official document.';

const MAX_OUTPUT_TOKENS = 1024;
const TEMPERATURE = 0.4;
const GATEWAY_TIMEOUT_MS = 60_000;

export type AssistantRefusalStatus = 400 | 422 | 429 | 502 | 503;

/** A refusal whose message is safe to show the user. Never carries provider or gateway text. */
export class AssistantChatError extends Error {
  public override readonly name = 'AssistantChatError';
  constructor(
    public readonly status: AssistantRefusalStatus,
    message: string,
  ) {
    super(message);
  }
}

export interface AssistantAuditEntry {
  readonly tenantId: string;
  readonly actorId: string;
  readonly provider: AssistantChatRequest['provider'];
  readonly outcome: 'answered' | 'refused';
  /** Why it was refused; absent when answered. A fixed code, never text. */
  readonly reason?: string;
  readonly messageCount: number;
  readonly redactions: readonly AssistantRedactionSummary[];
  readonly totalTokens: number;
}

export interface AssistantChatDeps {
  /** The school's known names. Throws `AssistantChatError` when it cannot be read. */
  readonly resolveLexicon: (tenantId: string, actorId: string) => Promise<TenantLexicon>;
  readonly fetchImpl: typeof fetch;
  readonly gatewayBaseUrl: string;
  readonly recordAudit: (entry: AssistantAuditEntry) => Promise<void>;
}

export interface ScrubbedConversation {
  readonly messages: readonly ChatMessage[];
  readonly redactions: readonly AssistantRedactionSummary[];
}

/** Scrubs every turn and totals what was removed, by kind. Counts only — never the original. */
export function scrubConversation(
  turns: AssistantChatRequest['messages'],
  lexicon: TenantLexicon,
): ScrubbedConversation {
  const totals = new Map<string, number>();
  const messages = turns.map((turn): ChatMessage => {
    const result = scrub(turn.content, lexicon);
    for (const redaction of result.redactions) {
      totals.set(redaction.kind, (totals.get(redaction.kind) ?? 0) + 1);
    }
    return { role: turn.role, content: result.text };
  });
  const redactions = [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => ({ kind, count }));
  return { messages, redactions };
}

const REFUSAL_MESSAGES = {
  pii: 'Your message still seems to contain personal information (an ID number, phone number, email or a name). Remove it and try again.',
  budget: "Your school's AI budget for this period has been used up.",
  unavailable: 'That assistant is unavailable right now. Try another one.',
  failed: 'That assistant could not answer this request. Try again, or try another one.',
} as const;

async function refuse(
  deps: AssistantChatDeps,
  base: Omit<AssistantAuditEntry, 'outcome' | 'reason' | 'totalTokens'>,
  reason: string,
  error: AssistantChatError,
): Promise<never> {
  await deps.recordAudit({ ...base, outcome: 'refused', reason, totalTokens: 0 });
  throw error;
}

export async function runAssistantChat(
  input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly request: AssistantChatRequest;
  },
  deps: AssistantChatDeps,
): Promise<AssistantChatResponse> {
  const { tenantId, actorId, request } = input;
  const connector = connectorFor(request.provider);

  const lexicon = await deps.resolveLexicon(tenantId, actorId);
  const scrubbed = scrubConversation(request.messages, lexicon);
  const auditBase = {
    tenantId,
    actorId,
    provider: request.provider,
    messageCount: request.messages.length,
    redactions: scrubbed.redactions,
  } as const;

  let response: Response;
  try {
    response = await deps.fetchImpl(`${deps.gatewayBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      body: JSON.stringify({
        tenantId,
        module: ASSISTANT_MODULE,
        agent: ASSISTANT_AGENT,
        model: connector.logicalModel,
        messages: [
          { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
          ...scrubbed.messages,
        ],
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        stream: false,
        provenance: { deidentified: true, saltVersion: 0, dropped: [] },
      }),
    });
  } catch {
    return refuse(
      deps,
      auditBase,
      'gateway_unreachable',
      new AssistantChatError(503, REFUSAL_MESSAGES.unavailable),
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = GatewayErrorBody.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : 'invalid_request';
    switch (code) {
      case 'pii_egress_blocked':
        return refuse(
          deps,
          auditBase,
          code,
          new AssistantChatError(422, REFUSAL_MESSAGES.pii),
        );
      case 'budget_exceeded':
        return refuse(
          deps,
          auditBase,
          code,
          new AssistantChatError(429, REFUSAL_MESSAGES.budget),
        );
      case 'all_providers_unavailable':
        return refuse(
          deps,
          auditBase,
          code,
          new AssistantChatError(503, REFUSAL_MESSAGES.unavailable),
        );
      case 'invalid_request':
        return refuse(
          deps,
          auditBase,
          code,
          new AssistantChatError(502, REFUSAL_MESSAGES.failed),
        );
    }
  }

  const completion = ChatCompletionResponse.safeParse(body);
  if (!completion.success) {
    return refuse(
      deps,
      auditBase,
      'malformed_gateway_response',
      new AssistantChatError(502, REFUSAL_MESSAGES.failed),
    );
  }

  const totalTokens = completion.data.usage.totalTokens;
  await deps.recordAudit({ ...auditBase, outcome: 'answered', totalTokens });

  const lastUserTurn = [...scrubbed.messages].reverse().find((m) => m.role === 'user');
  return {
    provider: request.provider,
    message: { role: 'assistant', content: completion.data.message.content },
    usage: { totalTokens },
    redactions: [...scrubbed.redactions],
    sent: lastUserTurn?.content ?? '',
  };
}

/** The assistants the gateway holds credentials for — the picker's contents. Never throws:
 *  an unreachable or malformed gateway is "none available", which the page says plainly. */
export async function listAvailableAssistants(
  deps: Pick<AssistantChatDeps, 'fetchImpl' | 'gatewayBaseUrl'>,
): Promise<AssistantConnectorList['assistants']> {
  try {
    const response = await deps.fetchImpl(`${deps.gatewayBaseUrl}/v1/assistants`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const parsed = AssistantConnectorList.safeParse(await response.json());
    return parsed.success ? parsed.data.assistants : [];
  } catch {
    return [];
  }
}
