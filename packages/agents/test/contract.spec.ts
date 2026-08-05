import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AgentContractError,
  AgentModule,
  validateAgentContract,
} from '../src/contract.js';

function validContract(overrides: Record<string, unknown> = {}): unknown {
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

describe('validateAgentContract', () => {
  it('accepts a fully-declared contract and returns it parsed', () => {
    const parsed = validateAgentContract(validContract());
    expect(parsed.id).toBe('CE-05');
    expect(parsed.module).toBe('MOD-01');
    expect(parsed.tools).toEqual([]);
  });

  it('accepts a contract with a tool declared', () => {
    const parsed = validateAgentContract(
      validContract({
        tools: [
          {
            name: 'lookup_caps_code',
            purpose: 'Resolve a CAPS clause ID to its text.',
            inputSchema: z.object({ code: z.string() }),
            idempotent: true,
            sideEffect: 'read',
          },
        ],
      }),
    );
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0]?.sideEffect).toBe('read');
  });

  it('throws when a required field is missing entirely', () => {
    const { budget: _omitted, ...withoutBudget } = validContract() as Record<
      string,
      unknown
    >;
    expect(() => validateAgentContract(withoutBudget)).toThrow(AgentContractError);
  });

  it('throws when module does not match "MOD-NN" or "LE"', () => {
    expect(() => validateAgentContract(validContract({ module: 'CURRICULUM' }))).toThrow(
      AgentContractError,
    );
  });

  it('throws when version is not a semver string', () => {
    expect(() => validateAgentContract(validContract({ version: 'v1' }))).toThrow(
      AgentContractError,
    );
  });

  it('throws when purpose is not one of the declared taxonomy values', () => {
    expect(() => validateAgentContract(validContract({ purpose: 'marketing' }))).toThrow(
      AgentContractError,
    );
  });

  it('throws when inputSchema is not an actual Zod schema instance', () => {
    expect(() =>
      validateAgentContract(validContract({ inputSchema: { type: 'object' } })),
    ).toThrow(AgentContractError);
  });

  it('throws when a declared tool is missing its own inputSchema', () => {
    expect(() =>
      validateAgentContract(
        validContract({
          tools: [
            {
              name: 'lookup_caps_code',
              purpose: 'Resolve a CAPS clause ID to its text.',
              idempotent: true,
              sideEffect: 'read',
            },
          ],
        }),
      ),
    ).toThrow(AgentContractError);
  });

  it('throws when a declared tool has an unrecognised side-effect classification', () => {
    expect(() =>
      validateAgentContract(
        validContract({
          tools: [
            {
              name: 'lookup_caps_code',
              purpose: 'Resolve a CAPS clause ID to its text.',
              inputSchema: z.object({ code: z.string() }),
              idempotent: true,
              sideEffect: 'destructive',
            },
          ],
        }),
      ),
    ).toThrow(AgentContractError);
  });

  it('throws when budget is missing its own required fields', () => {
    expect(() =>
      validateAgentContract(validContract({ budget: { maxTokens: 4000 } })),
    ).toThrow(AgentContractError);
  });
});

describe('AgentModule', () => {
  it.each(['MOD-01', 'MOD-05', 'MOD-99', 'LE'])('accepts %s', (value) => {
    expect(AgentModule.safeParse(value).success).toBe(true);
  });

  it.each(['MOD-1', 'mod-01', 'MOD01', 'CURRICULUM', ''])('rejects %s', (value) => {
    expect(AgentModule.safeParse(value).success).toBe(false);
  });
});
