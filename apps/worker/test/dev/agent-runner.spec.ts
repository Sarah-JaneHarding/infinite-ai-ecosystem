import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CE01Contract } from '@infinite-ai/agents';
import { PASSED, refuse } from '@infinite-ai/guardrails';
import { describe, expect, it, vi } from 'vitest';

import { AgentRunnerError, runAgentLive } from '../../src/dev/agent-runner.js';
import { templateFor } from '../../src/dev/schema-template.js';

const PROMPTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/prompts/src',
);
const contracts = new Map([[CE01Contract.id, CE01Contract]]);
const validInput = templateFor(CE01Contract.inputSchema);

const reply = (content: string): Response =>
  new Response(
    JSON.stringify({
      id: 'r1',
      model: CE01Contract.model,
      provider: 'local',
      message: { role: 'assistant', content },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    }),
    { status: 200 },
  );

const deps = (fetchImpl: typeof fetch) => ({
  contracts,
  promptsRoot: PROMPTS_ROOT,
  gatewayBaseUrl: 'http://gateway.test',
  tenantId: '10000000-0000-4000-8000-000000000001',
  fetchImpl,
});

describe('runAgentLive', () => {
  it('keeps the raw reply, usage, provider and parsed output on success', async () => {
    const fetchImpl = vi.fn(async () => reply('{"status":"needs_input"}'));
    const record = await runAgentLive(deps(fetchImpl), 'CE-01', validInput, 'case-1');
    expect(record.outcome).toBe('ok');
    expect(record.rawContent).toBe('{"status":"needs_input"}');
    expect(record.output).toEqual({ status: 'needs_input' });
    expect(record.provider).toBe('local');
    expect(record.usage?.totalTokens).toBe(15);
    expect(record.promptVersion).toBe(CE01Contract.promptRef.version);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('keeps the full text of a reply that is not JSON', async () => {
    const text = 'Sure! Here is the plan: '.padEnd(400, 'x');
    const record = await runAgentLive(
      deps(vi.fn(async () => reply(text))),
      'CE-01',
      validInput,
      'c',
    );
    expect(record.outcome).toBe('non_json');
    expect(record.rawContent).toBe(text);
  });

  it('reports a gateway HTTP error without a reply', async () => {
    const record = await runAgentLive(
      deps(vi.fn(async () => new Response('boom', { status: 500 }))),
      'CE-01',
      validInput,
      'c',
    );
    expect(record.outcome).toBe('gateway_error');
    expect(record.gatewayStatus).toBe(500);
    expect(record.rawContent).toBeNull();
  });

  it('reports an unreachable gateway as a gateway error', async () => {
    const record = await runAgentLive(
      deps(vi.fn(async () => Promise.reject(new Error('ECONNREFUSED')))),
      'CE-01',
      validInput,
      'c',
    );
    expect(record.outcome).toBe('gateway_error');
    expect(record.error).toMatch(/ECONNREFUSED/);
  });

  it('makes no model call for an input that fails the schema, and says why', async () => {
    const fetchImpl = vi.fn(async () => reply('{}'));
    const record = await runAgentLive(deps(fetchImpl), 'CE-01', { nonsense: true }, 'c');
    expect(record.outcome).toBe('invalid_input');
    expect(record.inputIssues.length).toBeGreaterThan(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends an invalid input when explicitly told to', async () => {
    const fetchImpl = vi.fn(async () => reply('{"status":"x"}'));
    const record = await runAgentLive(
      { ...deps(fetchImpl), sendInvalidInput: true },
      'CE-01',
      { nonsense: true },
      'c',
    );
    expect(record.outcome).toBe('ok');
    expect(record.inputIssues.length).toBeGreaterThan(0);
  });

  it('records a guardrail refusal with the model reply that caused it', async () => {
    const refusing = async () => refuse('age_inappropriate', 'too advanced', null);
    const record = await runAgentLive(
      {
        ...deps(vi.fn(async () => reply('{"status":"ok"}'))),
        ageAppropriatenessChecker: refusing,
      },
      'CE-01',
      validInput,
      'c',
    );
    expect(record.outcome).toBe('guardrail_refused');
    expect(record.rawContent).toBe('{"status":"ok"}');
  });

  it('passes a checker that approves', async () => {
    const record = await runAgentLive(
      {
        ...deps(vi.fn(async () => reply('{"status":"ok"}'))),
        ageAppropriatenessChecker: async () => PASSED,
      },
      'CE-01',
      validInput,
      'c',
    );
    expect(record.outcome).toBe('ok');
  });

  it('refuses an agent id that has no contract', async () => {
    await expect(runAgentLive(deps(vi.fn()), 'NOPE-99', {}, 'c')).rejects.toThrow(
      AgentRunnerError,
    );
  });
});
