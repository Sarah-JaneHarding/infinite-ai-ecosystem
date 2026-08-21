import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  UnitBlueprintResult,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE04Executor,
  type CE04GatewayCallFn,
  type GetTermPlanFn,
  type WithCE04TenantFn,
} from '../src/ce04-executor.js';
import type {
  ListConstitutionFn,
  StepExecutionContext,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000004';
const PROMPT_BODY = '# ROLE\nCE-04 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce04-1',
    stepId: 'design-unit',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      termNumber: 1,
      contentArea: 'Numbers, Operations and Relationships',
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
    model: 'curriculum.design',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: UnitBlueprintResult = {
  status: 'needs_input',
  grade: '7',
  subject: 'Mathematics',
  contentArea: 'Numbers, Operations and Relationships',
  missing: [
    {
      documentKind: 'GRADE_FRAMEWORK',
      subjectName: 'Mathematics',
      why: 'No ratified GradeFramework found for Mathematics Grade 7.',
    },
  ],
};

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<UnitBlueprintResult>,
  ) => Promise<UnitBlueprintResult>,
): WithCE04TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE04Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE04GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing contentArea)', async () => {
    const gatewayCall: CE04GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE04TenantFn;

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const badContext = makeContext({
      input: {
        grade: '7',
        subject: 'Mathematics',
        termNumber: 1,
        academicYear: 2026,
        tenantId: TENANT_ID,
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.design',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match UnitBlueprintResult', async () => {
    const gatewayCall: CE04GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listConstitution', async () => {
    const gatewayCall: CE04GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const getTermPlan: GetTermPlanFn = vi.fn();
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from getTermPlan', async () => {
    const gatewayCall: CE04GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('brain read failed');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE04GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: CE04GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE04TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes only CAPS_CANON rows as l0Documents (excludes ATP_CALENDAR and others)', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const assessRow = makeRow('ASSESSMENT_POLICY', 'assess-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockResolvedValue([capsRow, atpRow, assessRow]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
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
    expect(parsed.context.l0Documents).toHaveLength(1);
    expect(parsed.context.l0Documents[0]?.id).toBe('caps-1');
  });

  it('passes the termPlan from getTermPlan in the context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const fakeTermPlan = {
      grade: '7',
      termNumber: 1,
      academicYear: 2026,
      subjects: [],
      assessmentCalendar: [],
      sourceDocuments: [],
      ratifiedAt: '2026-02-01T00:00:00.000Z',
    };
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(fakeTermPlan);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { termPlan: unknown };
    };
    expect(parsed.context.termPlan).toEqual(fakeTermPlan);
  });

  it('passes null termPlan when getTermPlan returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { termPlan: unknown };
    };
    expect(parsed.context.termPlan).toBeNull();
  });

  it('passes grade, subject, termNumber, contentArea, and academicYear in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subject: 'Physical Sciences',
          termNumber: 2,
          contentArea: 'Waves, Sound and Light',
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
        subject: string;
        termNumber: number;
        contentArea: string;
        academicYear: number;
      };
    };
    expect(parsed.input.grade).toBe('10');
    expect(parsed.input.subject).toBe('Physical Sciences');
    expect(parsed.input.termNumber).toBe(2);
    expect(parsed.input.contentArea).toBe('Waves, Sound and Light');
    expect(parsed.input.academicYear).toBe(2027);
  });

  it('calls getTermPlan with grade, termNumber, and academicYear from input', async () => {
    const gatewayCall: CE04GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const capturedParams: Array<{
      grade: string;
      termNumber: number;
      academicYear: number;
    }> = [];
    const getTermPlan: GetTermPlanFn = vi.fn().mockImplementation((_tx, params) => {
      capturedParams.push(params);
      return Promise.resolve(null);
    });
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Life Sciences',
          termNumber: 4,
          contentArea: 'Biodiversity',
          academicYear: 2028,
          tenantId: TENANT_ID,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '9', termNumber: 4, academicYear: 2028 });
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-04 test.';

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.design as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE04GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE04Executor(
      withTenant,
      listConstitution,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.design');
  });
});
