import { describe, expect, it, vi } from 'vitest';

import type {
  ATPResult,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE02Executor,
  type CE02GatewayCallFn,
  type WithCE02TenantFn,
} from '../src/ce02-executor.js';
import type {
  ListConstitutionFn,
  StepExecutionContext,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000002';
const PROMPT_BODY = '# ROLE\nCE-02 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce02-1',
    stepId: 'sequence-atp',
    attempt: 1,
    input: {
      grade: '7',
      subjects: ['Mathematics'],
      academicYear: 2026,
      tenantId: TENANT_ID,
    },
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
    model: 'curriculum.sequence',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: ATPResult = {
  status: 'needs_input',
  grade: '7',
  missing: [
    {
      documentKind: 'ATP',
      subjectName: 'Mathematics',
      why: 'No ratified ATP document found for Mathematics Grade 7.',
    },
  ],
};

function makeWithTenant(
  stub: (fn: (tx: TenantClient) => Promise<ATPResult>) => Promise<ATPResult>,
): WithCE02TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE02Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE02GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('throws CurriculumSeedError for invalid input', async () => {
    const gatewayCall: CE02GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE02TenantFn;

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    // missing academicYear
    const badContext = makeContext({
      input: { grade: '7', subjects: ['Maths'], tenantId: TENANT_ID },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.sequence',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match ATPResult', async () => {
    const gatewayCall: CE02GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listConstitution', async () => {
    const gatewayCall: CE02GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE02GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: CE02GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE02TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes both CAPS_CANON and ATP_CALENDAR rows as l0Documents (excludes other kinds)', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const otherRow = makeRow('TEMPLATE', 'tpl-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockResolvedValue([capsRow, atpRow, otherRow]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests).toHaveLength(1);
    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { l0Documents: ConstitutionRow[] };
    };
    expect(parsed.context.l0Documents).toHaveLength(2);
    const ids = parsed.context.l0Documents.map((r) => r.id);
    expect(ids).toContain('caps-1');
    expect(ids).toContain('atp-1');
    expect(ids).not.toContain('tpl-1');
  });

  it('passes grade, subjects, academicYear and tenantId from input in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '5',
          subjects: ['Natural Sciences'],
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: { grade: string; subjects: string[]; academicYear: number };
    };
    expect(parsed.input.grade).toBe('5');
    expect(parsed.input.subjects).toEqual(['Natural Sciences']);
    expect(parsed.input.academicYear).toBe(2027);
  });

  it('includes schoolCalendar in the user message when provided', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const schoolCalendar = [
      {
        kind: 'holiday' as const,
        startDate: '2026-03-23',
        endDate: '2026-04-04',
        label: 'Term 1 break',
      },
    ];

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '7',
          subjects: ['Mathematics'],
          academicYear: 2026,
          tenantId: TENANT_ID,
          schoolCalendar,
        },
      }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: { schoolCalendar: typeof schoolCalendar };
    };
    expect(parsed.input.schoolCalendar).toEqual(schoolCalendar);
  });

  it('omits schoolCalendar from the user message when not provided', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as Record<
      string,
      Record<string, unknown>
    >;
    expect(parsed.input).not.toHaveProperty('schoolCalendar');
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-02 test.';

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.sequence as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE02GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE02Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.sequence');
  });
});
