import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { CredentialPool } from '../../src/credentials/pool.js';
import { parseRoutingConfig } from '../../src/routing/config.js';
import { createRouter } from '../../src/routing/router.js';
import type { ProviderAdapter } from '../../src/adapters/types.js';

// `routing.anthropic.json` is NOT an independent routing policy: it is `routing.json`
// reduced to its Anthropic links, so a deployment that only has an Anthropic credential
// can boot the gateway (which refuses to start unless every provider named in its routing
// file has credentials) and so a calibration run measures Claude on every route instead of
// whichever provider happens to be first in a chain. JSON cannot carry a comment, so this
// test is what keeps the two files from drifting apart.
const readRouting = (
  name: string,
): Record<string, readonly { provider: string; concreteModel: string }[]> =>
  parseRoutingConfig(
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../${name}`, import.meta.url)), 'utf8'),
    ),
  );

const shipped = readRouting('routing.json');
const anthropicOnly = readRouting('routing.anthropic.json');

const JUDGE = 'guardrail.age_appropriateness';

function adapter(
  provider: string,
  complete: ProviderAdapter['complete'],
): ProviderAdapter {
  return { provider, complete, embed: vi.fn(), completeStream: vi.fn() };
}

describe('shipped routing files — validity', () => {
  it('routing.json is a valid routing config', () => {
    expect(Object.keys(shipped).length).toBeGreaterThan(0);
  });

  it('routing.anthropic.json is a valid routing config', () => {
    expect(Object.keys(anthropicOnly).length).toBeGreaterThan(0);
  });
});

describe('routing.anthropic.json — derived from routing.json, never independent', () => {
  it('is exactly routing.json reduced to its Anthropic links, in the same order', () => {
    const expected = Object.fromEntries(
      Object.entries(shipped)
        .map(
          ([model, chain]) =>
            [model, chain.filter((l) => l.provider === 'anthropic')] as const,
        )
        .filter(([, chain]) => chain.length > 0),
    );

    expect(anthropicOnly).toEqual(expected);
  });

  it('names no provider other than anthropic and has no empty chain', () => {
    for (const [model, chain] of Object.entries(anthropicOnly)) {
      expect(chain.length, model).toBeGreaterThan(0);
      for (const link of chain) expect(link.provider, model).toBe('anthropic');
    }
  });

  it('drops only the routes Anthropic cannot serve — a new gap must be a deliberate decision', () => {
    const dropped = Object.keys(shipped).filter((model) => !(model in anthropicOnly));

    // Anthropic has no embeddings API. Nothing but tests references this route today, and the
    // age-appropriateness judge reads its clauses with `recall({ vectorK: 0 })`, i.e. no vector search.
    expect(dropped).toEqual(['embedding.encode']);
  });

  it('routes the age-appropriateness judge to Claude alone', () => {
    expect(anthropicOnly[JUDGE]).toHaveLength(1);
    expect(anthropicOnly[JUDGE]).toEqual(
      shipped[JUDGE]?.filter((l) => l.provider === 'anthropic'),
    );
  });
});

describe('gateway boot check against the shipped routing files', () => {
  const claude = (): ProviderAdapter => adapter('anthropic', vi.fn());
  const onlyAnthropic = (): {
    adapters: Record<string, ProviderAdapter>;
    credentialPools: Record<string, CredentialPool>;
  } => ({
    adapters: { anthropic: claude() },
    credentialPools: { anthropic: new CredentialPool('anthropic', ['k1']) },
  });

  it('boots with only an Anthropic adapter and credential when given the reduced file', () => {
    expect(() =>
      createRouter({ ...onlyAnthropic(), routing: anthropicOnly }),
    ).not.toThrow();
  });

  it('refuses the full file when only Anthropic is configured, naming the missing provider', () => {
    expect(() => createRouter({ ...onlyAnthropic(), routing: shipped })).toThrow(
      /references unknown provider "(openai|google|local)"/,
    );
  });

  it('sends the judge model to the Anthropic adapter with the Anthropic model id', async () => {
    const complete = vi.fn().mockResolvedValue({
      content: '{}',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    const router = createRouter({
      adapters: { anthropic: adapter('anthropic', complete) },
      credentialPools: { anthropic: new CredentialPool('anthropic', ['k1']) },
      routing: anthropicOnly,
    });

    const { provider } = await router.routeChatCompletion({
      tenantId: 'tenant-1',
      module: 'mod-01',
      agent: 'AGE-APPROPRIATENESS-JUDGE',
      model: JUDGE,
      messages: [{ role: 'user', content: 'Judge this.' }],
      temperature: 0,
      stream: false,
    });

    expect(provider).toBe('anthropic');
    expect(complete).toHaveBeenCalledTimes(1);
    const calls = complete.mock.calls as unknown[][];
    expect(JSON.stringify(calls[0])).toContain(
      anthropicOnly[JUDGE]?.[0]?.concreteModel ?? 'missing',
    );
  });
});
