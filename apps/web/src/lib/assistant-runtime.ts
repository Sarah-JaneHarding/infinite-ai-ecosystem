// The real dependencies behind the assistant: the tenant lexicon from the database, the audit
// chain, and the gateway over HTTP. Kept apart from `assistant-chat.ts` so the flow itself is
// tested without any of them (rule 5: every database read and write goes through `withTenant`).

import {
  EncryptionKey,
  appendAuditEvent,
  readTenantLexicon,
  withTenant,
} from '@infinite-ai/db';

import {
  AssistantChatError,
  type AssistantAuditEntry,
  type AssistantChatDeps,
} from '@/lib/assistant-chat';
import { getWebEnv } from '@/lib/env';

/** Reads the school's names with the deployment's key, or refuses. There is no fallback to an
 *  empty lexicon: scrubbing against nothing would let a teacher's "Nomvula" straight through. */
async function resolveLexicon(tenantId: string, actorId: string) {
  const env = getWebEnv();
  if (env.DB_ENCRYPTION_KEY === undefined) {
    throw new AssistantChatError(
      503,
      'The assistant is switched off until privacy protection is configured for this deployment.',
    );
  }
  const key = EncryptionKey.fromBase64(
    env.DB_ENCRYPTION_KEY,
    env.DB_ENCRYPTION_KEY_VERSION,
  );
  return withTenant({ tenantId, actorId }, (tx) => readTenantLexicon(tx, key));
}

async function recordAudit(entry: AssistantAuditEntry): Promise<void> {
  await withTenant({ tenantId: entry.tenantId, actorId: entry.actorId }, (tx) =>
    appendAuditEvent(tx, {
      actorId: entry.actorId,
      action: 'assistant.chat',
      resourceType: 'assistant_connector',
      resourceId: entry.provider,
      purpose: null,
      traceId: null,
      // Counts and codes only — never a message, a name, or a redacted value.
      diff: {
        outcome: entry.outcome,
        ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
        messageCount: entry.messageCount,
        redactions: entry.redactions,
        totalTokens: entry.totalTokens,
      },
      at: new Date(),
      createdBy: entry.actorId,
    }),
  );
}

export function assistantDeps(): AssistantChatDeps {
  return {
    resolveLexicon,
    fetchImpl: fetch,
    gatewayBaseUrl: getWebEnv().GATEWAY_BASE_URL.replace(/\/+$/, ''),
    recordAudit,
  };
}
