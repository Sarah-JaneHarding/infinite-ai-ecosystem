import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TermPlanResult,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE03Executor,
  type CE03GatewayCallFn,
  type WithCE03TenantFn,
} from '../src/ce03-executor.js';
import type {
  ListConstitutionFn,
  StepExecutionContext,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000003';
const PROMPT_BODY = '# ROLE\nCE-03 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce03-1',
    stepId: 'plan-term',
    attempt: 1,
    input: {
      grade: '7',
      subjects: ['Mathematics'],
      termNumber: 1,
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
    model: 'curriculum.plan',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: TermPlanResult = {
  status: 'needs_input',
  grade: '7',
  termNumber: 1,
  missing: [
    {
      documentKind: 'GRADE_FRAMEWORK',
      subjectName: 'Mathematics',
      why: 'No ratified GradeFramework found for Mathematics Grade 7.',
    },
  ],
};

function makeWithTenant(
  stub: (fn: (tx: TenantClient) => Promise<TermPlanResult>) => Promise<TermPlanResult>,
): WithCE03TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE03Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE03GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing termNumber)', async () => {
    const gatewayCall: CE03GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE03TenantFn;

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    const badContext = makeContext({
      input: {
        grade: '7',
        subjects: ['Mathematics'],
        academicYear: 2026,
        tenantId: TENANT_ID,
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE03GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.plan',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match TermPlanResult', async () => {
    const gatewayCall: CE03GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listConstitution', async () => {
    const gatewayCall: CE03GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE03GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: CE03GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE03TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes CAPS_CANON, ATP_CALENDAR, and ASSESSMENT_POLICY rows (excludes other kinds)', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const assessRow = makeRow('ASSESSMENT_POLICY', 'assess-1');
    const otherRow = makeRow('TEMPLATE', 'tpl-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE03GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockResolvedValue([capsRow, atpRow, assessRow, otherRow]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
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
    expect(parsed.context.l0Documents).toHaveLength(3);
    const ids = parsed.context.l0Documents.map((r) => r.id);
    expect(ids).toContain('caps-1');
    expect(ids).toContain('atp-1');
    expect(ids).toContain('assess-1');
    expect(ids).not.toContain('tpl-1');
  });

  it('passes grade, subjects, termNumber, and academicYear from input in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE03GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subjects: ['Physical Sciences'],
          termNumber: 3,
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: {
        grade: string;
        subjects: string[];
        termNumber: number;
        academicYear: number;
      };
    };
    expect(parsed.input.grade).toBe('10');
    expect(parsed.input.subjects).toEqual(['Physical Sciences']);
    expect(parsed.input.termNumber).toBe(3);
    expect(parsed.input.academicYear).toBe(2027);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE03GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-03 test.';

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.plan as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE03GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE03Executor(
      withTenant,
      listConstitution,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.plan');
  });
});
