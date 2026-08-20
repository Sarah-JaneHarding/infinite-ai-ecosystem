import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  FrameworkResult,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE01Executor,
  type GatewayCallFn,
  type ListCapsFn,
  type WithCE01TenantFn,
} from '../src/ce01-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const PROMPT_BODY = '# ROLE\nCE-01 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce01-1',
    stepId: 'build-topic-graph',
    attempt: 1,
    input: { grade: '7', subjects: ['Mathematics'], tenantId: TENANT_ID },
    ...overrides,
  };
}

function makeRow(kind: ConstitutionRow['kind'], id: string): ConstitutionRow {
  return {
    id,
    key: `${kind}:${id}`,
    kind,
    version: 1,
    content: { documentKind: kind },
    ratifiedAt: new Date('2026-01-01'),
  };
}

function makeGatewayResponse(outputJson: unknown): ChatCompletionResponse {
  return {
    id: 'chatcmpl-test',
    model: 'curriculum.map',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT = {
  status: 'needs_input',
  grade: '7',
  missing: [
    {
      documentKind: 'CAPS_SUBJECT_STATEMENT',
      subjectName: 'Mathematics',
      why: 'No ratified CAPS subject statement found for Mathematics Grade 7.',
    },
  ],
};

function makeWithTenant(
  stub: (fn: (tx: TenantClient) => Promise<FrameworkResult>) => Promise<FrameworkResult>,
): WithCE01TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE01Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('throws CurriculumSeedError for invalid input', async () => {
    const gatewayCall: GatewayCallFn = vi.fn();
    const listCaps: ListCapsFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE01TenantFn;

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);
    const badContext = makeContext({ input: { tenantId: TENANT_ID } }); // missing grade/subjects

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.map',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match FrameworkResult', async () => {
    const gatewayCall: GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listCaps', async () => {
    const gatewayCall: GatewayCallFn = vi.fn();
    const listCaps: ListCapsFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE01TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('only passes CAPS_CANON rows (not ATP_CALENDAR) as l0Documents to the gateway', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([capsRow, atpRow]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);
    await executor(makeContext());

    expect(capturedRequests).toHaveLength(1);
    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { l0Documents: ConstitutionRow[] };
    };
    expect(parsed.context.l0Documents).toHaveLength(1);
    expect(parsed.context.l0Documents[0]?.id).toBe('caps-1');
  });

  it('passes grade and subjects from input in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, PROMPT_BODY);
    await executor(
      makeContext({ input: { grade: '4', subjects: ['Science'], tenantId: TENANT_ID } }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: { grade: string; subjects: string[] };
    };
    expect(parsed.input.grade).toBe('4');
    expect(parsed.input.subjects).toEqual(['Science']);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listCaps: ListCapsFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-01 test.';

    const executor = makeCE01Executor(withTenant, listCaps, gatewayCall, customPrompt);
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });
});
