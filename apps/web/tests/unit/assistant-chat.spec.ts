import { describe, expect, it, vi } from 'vitest';
import type { AssistantChatRequest } from '@infinite-ai/contracts';

import {
  ASSISTANT_SYSTEM_PROMPT,
  AssistantChatError,
  listAvailableAssistants,
  runAssistantChat,
  scrubConversation,
  type AssistantAuditEntry,
  type AssistantChatDeps,
} from '../../src/lib/assistant-chat.js';

// Security tests (rule 4): free text a teacher types is scrubbed against the school's own
// names BEFORE the gateway sees it, the audit trail never holds the text, and any failure
// along the way refuses rather than sending something unscrubbed.

const TENANT = '10000000-0000-4000-8000-000000000001';
const ACTOR = 'acc00000-0000-4000-8000-000000000001';
const LEXICON = { personNames: ['Nomvula Mahlangu'], schoolNames: ['Benjamin Pine'] };

const completion = {
  id: 'chatcmpl_1',
  model: 'assistant.grok',
  provider: 'xai',
  message: { role: 'assistant', content: 'Try a number line.' },
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  cached: false,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeDeps(overrides: Partial<AssistantChatDeps> = {}) {
  const audits: AssistantAuditEntry[] = [];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    jsonResponse(200, completion),
  );
  const deps: AssistantChatDeps = {
    resolveLexicon: async () => LEXICON,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    gatewayBaseUrl: 'http://gateway.test',
    recordAudit: async (entry) => {
      audits.push(entry);
    },
    ...overrides,
  };
  return { deps, audits, fetchImpl };
}

const request = (content: string, provider: AssistantChatRequest['provider'] = 'grok') =>
  ({
    provider,
    messages: [{ role: 'user', content }],
  }) satisfies AssistantChatRequest;

function sentBody(
  fetchImpl: ReturnType<typeof makeDeps>['fetchImpl'],
): Record<string, unknown> {
  const init = fetchImpl.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('scrubConversation', () => {
  it('removes known names from every turn and totals redactions by kind, counts only', () => {
    const result = scrubConversation(
      [
        { role: 'user', content: 'How is Nomvula Mahlangu doing?' },
        { role: 'assistant', content: 'Tell me more.' },
        { role: 'user', content: 'Email nomvula@example.com about Nomvula Mahlangu' },
      ],
      LEXICON,
    );
    const all = JSON.stringify(result);
    expect(all).not.toContain('Nomvula');
    expect(all).not.toContain('nomvula@example.com');
    expect(result.redactions).toEqual(
      expect.arrayContaining([
        { kind: 'KNOWN_NAME', count: 2 },
        { kind: 'EMAIL', count: 1 },
      ]),
    );
    expect(result.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });
});

describe('runAssistantChat — happy path', () => {
  it('sends only scrubbed text, stamped, to the gateway for the chosen connector', async () => {
    const { deps, fetchImpl } = makeDeps();
    const result = await runAssistantChat(
      {
        tenantId: TENANT,
        actorId: ACTOR,
        request: request('Help Nomvula Mahlangu with fractions'),
      },
      deps,
    );

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'http://gateway.test/v1/chat/completions',
    );
    const body = sentBody(fetchImpl);
    expect(JSON.stringify(body)).not.toContain('Nomvula');
    expect(body['model']).toBe('assistant.grok');
    expect(body['tenantId']).toBe(TENANT);
    expect(body['stream']).toBe(false);
    expect(body['provenance']).toEqual({
      deidentified: true,
      saltVersion: 0,
      dropped: [],
    });
    const messages = body['messages'] as { role: string; content: string }[];
    expect(messages[0]).toEqual({ role: 'system', content: ASSISTANT_SYSTEM_PROMPT });

    expect(result.provider).toBe('grok');
    expect(result.message.content).toBe('Try a number line.');
    expect(result.usage.totalTokens).toBe(15);
    expect(result.redactions).toEqual([{ kind: 'KNOWN_NAME', count: 1 }]);
    expect(result.sent).not.toContain('Nomvula');
  });

  it('routes each provider to its own logical model — never another vendor', async () => {
    for (const [provider, model] of [
      ['claude', 'assistant.claude'],
      ['gemini', 'assistant.gemini'],
      ['copilot', 'assistant.copilot'],
      ['qwen', 'assistant.qwen'],
      ['grok', 'assistant.grok'],
    ] as const) {
      const { deps, fetchImpl } = makeDeps();
      await runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi', provider) },
        deps,
      );
      expect(sentBody(fetchImpl)['model']).toBe(model);
    }
  });

  it('audits an answer with counts and tokens, and never the text or the name', async () => {
    const { deps, audits } = makeDeps();
    await runAssistantChat(
      {
        tenantId: TENANT,
        actorId: ACTOR,
        request: request('Nomvula Mahlangu is struggling'),
      },
      deps,
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenantId: TENANT,
      actorId: ACTOR,
      provider: 'grok',
      outcome: 'answered',
      messageCount: 1,
      totalTokens: 15,
    });
    const serialised = JSON.stringify(audits[0]);
    expect(serialised).not.toContain('Nomvula');
    expect(serialised).not.toContain('struggling');
    expect(serialised).not.toContain('number line');
  });
});

describe('runAssistantChat — refusals', () => {
  const cases = [
    ['pii_egress_blocked', 422],
    ['budget_exceeded', 429],
    ['all_providers_unavailable', 503],
    ['invalid_request', 502],
  ] as const;

  for (const [code, status] of cases) {
    it(`maps the gateway's ${code} to ${status}, audits it, and never forwards gateway text`, async () => {
      const { deps, audits } = makeDeps({
        fetchImpl: (async () =>
          jsonResponse(status === 422 ? 403 : status, {
            error: { code, message: 'SECRET-PROVIDER-DETAIL sk-live-123' },
          })) as unknown as typeof fetch,
      });
      const failure = await runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi') },
        deps,
      ).catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(AssistantChatError);
      expect((failure as AssistantChatError).status).toBe(status);
      expect((failure as AssistantChatError).message).not.toContain('SECRET');
      expect(audits).toEqual([
        expect.objectContaining({ outcome: 'refused', reason: code }),
      ]);
    });
  }

  it('refuses with 503 when the gateway is unreachable', async () => {
    const { deps, audits } = makeDeps({
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    await expect(
      runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi') },
        deps,
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(audits[0]).toMatchObject({
      outcome: 'refused',
      reason: 'gateway_unreachable',
    });
  });

  it('refuses a 200 whose body is not a completion', async () => {
    const { deps } = makeDeps({
      fetchImpl: (async () =>
        jsonResponse(200, { nonsense: true })) as unknown as typeof fetch,
    });
    await expect(
      runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi') },
        deps,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('fails closed: when the school lexicon cannot be read, nothing is sent', async () => {
    const { deps, fetchImpl, audits } = makeDeps({
      resolveLexicon: async () => {
        throw new AssistantChatError(503, 'Privacy protection is not configured.');
      },
    });
    await expect(
      runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi') },
        deps,
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(audits).toEqual([]);
  });

  it('does not hand back an answer it could not audit', async () => {
    const { deps } = makeDeps({
      recordAudit: async () => {
        throw new Error('audit chain unavailable');
      },
    });
    await expect(
      runAssistantChat(
        { tenantId: TENANT, actorId: ACTOR, request: request('Hi') },
        deps,
      ),
    ).rejects.toThrow('audit chain unavailable');
  });
});

describe('listAvailableAssistants', () => {
  const deps = (fetchImpl: unknown) => ({
    fetchImpl: fetchImpl as typeof fetch,
    gatewayBaseUrl: 'http://gateway.test',
  });

  it('returns what the gateway reports', async () => {
    const list = await listAvailableAssistants(
      deps(async () =>
        jsonResponse(200, { assistants: [{ id: 'grok', label: 'Grok' }] }),
      ),
    );
    expect(list).toEqual([{ id: 'grok', label: 'Grok' }]);
  });

  it('is empty — never an error — when the gateway is down, refuses, or sends junk', async () => {
    expect(
      await listAvailableAssistants(
        deps(async () => {
          throw new Error('down');
        }),
      ),
    ).toEqual([]);
    expect(
      await listAvailableAssistants(deps(async () => jsonResponse(500, {}))),
    ).toEqual([]);
    expect(
      await listAvailableAssistants(
        deps(async () => jsonResponse(200, { assistants: [{ id: 'toqi' }] })),
      ),
    ).toEqual([]);
  });
});
