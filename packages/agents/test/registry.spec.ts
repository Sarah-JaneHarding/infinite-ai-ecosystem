import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AgentContractError } from '../src/contract.js';
import { AgentRegistry, AgentRegistryError, bootAgentRegistry } from '../src/registry.js';

function contract(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'CE-05',
    version: '1.0.0',
    module: 'MOD-01',
    purpose: 'planning',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ plan: z.string() }),
    promptRef: { agent: 'CE-05', version: '1.0.0' },
    model: 'plan.author',
    tools: [],
    guardrails: ['pii_guard'],
    budget: { maxTokens: 4000, maxCostUsd: 0.05 },
    evalSetRef: 'ce-05-eval-set',
    requiresApproval: true,
    writesToBrain: true,
    ...overrides,
  };
}

describe('AgentRegistry', () => {
  it('registers a valid contract and makes it retrievable', () => {
    const registry = new AgentRegistry();
    const registered = registry.register(contract());

    expect(registered.id).toBe('CE-05');
    expect(registry.has('CE-05')).toBe(true);
    expect(registry.get('CE-05')).toEqual(registered);
    expect(registry.list()).toEqual([registered]);
  });

  it('registers multiple distinct agents', () => {
    const registry = new AgentRegistry();
    registry.register(contract());
    registry.register(contract({ id: 'CE-06' }));

    expect(
      registry
        .list()
        .map((a) => a.id)
        .sort(),
    ).toEqual(['CE-05', 'CE-06']);
  });

  it('refuses a duplicate id, even with a different version', () => {
    const registry = new AgentRegistry();
    registry.register(contract());

    expect(() => registry.register(contract({ version: '2.0.0' }))).toThrow(
      AgentRegistryError,
    );
    expect(registry.list()).toHaveLength(1);
  });

  it('propagates a structurally invalid contract as AgentContractError, and registers nothing', () => {
    const registry = new AgentRegistry();

    expect(() => registry.register(contract({ module: 'CURRICULUM' }))).toThrow(
      AgentContractError,
    );
    expect(registry.list()).toHaveLength(0);
  });

  it('assumes a referenced prompt and eval set exist when no checker is supplied', () => {
    const registry = new AgentRegistry();
    expect(() => registry.register(contract())).not.toThrow();
  });

  it('refuses an unknown prompt ref when a checker says it does not exist', () => {
    const registry = new AgentRegistry({ promptExists: () => false });

    expect(() => registry.register(contract())).toThrow(AgentRegistryError);
  });

  it('refuses a missing eval set when a checker says it does not exist', () => {
    const registry = new AgentRegistry({ evalSetExists: () => false });

    expect(() => registry.register(contract())).toThrow(AgentRegistryError);
  });

  it('passes the declared promptRef through to the checker', () => {
    let seen: unknown;
    const registry = new AgentRegistry({
      promptExists: (ref) => {
        seen = ref;
        return true;
      },
    });
    registry.register(contract());

    expect(seen).toEqual({ agent: 'CE-05', version: '1.0.0' });
  });
});

describe('bootAgentRegistry', () => {
  it('registers every candidate and returns a working registry', () => {
    const registry = bootAgentRegistry([contract(), contract({ id: 'CE-06' })]);

    expect(registry.list()).toHaveLength(2);
  });

  it('throws on the first invalid candidate — a boot failure, not a partial success', () => {
    expect(() =>
      bootAgentRegistry([contract(), contract({ id: 'CE-06', budget: undefined })]),
    ).toThrow(AgentContractError);
  });
});
