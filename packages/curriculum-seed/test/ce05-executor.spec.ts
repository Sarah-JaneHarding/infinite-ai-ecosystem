import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LessonPlanResult,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE05Executor,
  type CE05GatewayCallFn,
  type GetUnitBlueprintFn,
  type WithCE05TenantFn,
} from '../src/ce05-executor.js';
import type {
  ListConstitutionFn,
  StepExecutionContext,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000005';
const PROMPT_BODY = '# ROLE\nCE-05 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce05-1',
    stepId: 'generate-lesson-plan',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      weekNumber: 3,
      termNumber: 1,
      academicYear: 2026,
      tenantId: TENANT_ID,
      templateId: 'lesson-plan-v1',
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
    model: 'curriculum.lessons',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: LessonPlanResult = {
  status: 'needs_input',
  grade: '7',
  subject: 'Mathematics',
  weekNumber: 3,
  missing: [
    {
      documentKind: 'UNIT_BLUEPRINT',
      detail: null,
      why: 'No ratified UnitBlueprint found for Mathematics Grade 7 Term 1.',
    },
  ],
};

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<LessonPlanResult>,
  ) => Promise<LessonPlanResult>,
): WithCE05TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE05Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE05GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing templateId)', async () => {
    const gatewayCall: CE05GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn();
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE05TenantFn;

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    const badContext = makeContext({
      input: {
        grade: '7',
        subject: 'Mathematics',
        weekNumber: 3,
        termNumber: 1,
        academicYear: 2026,
        tenantId: TENANT_ID,
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.lessons',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match LessonPlanResult', async () => {
    const gatewayCall: CE05GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listConstitution', async () => {
    const gatewayCall: CE05GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn();
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from getUnitBlueprint', async () => {
    const gatewayCall: CE05GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('brain read failed');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE05GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: CE05GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE05TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
  });

  it('passes CAPS_CANON and TEMPLATE rows (excludes ATP_CALENDAR and ASSESSMENT_POLICY)', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const tplRow = makeRow('TEMPLATE', 'tpl-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const assessRow = makeRow('ASSESSMENT_POLICY', 'assess-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockResolvedValue([capsRow, tplRow, atpRow, assessRow]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
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
    expect(ids).toContain('tpl-1');
    expect(ids).not.toContain('atp-1');
    expect(ids).not.toContain('assess-1');
  });

  it('passes the unitBlueprint from getUnitBlueprint in the context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const fakeBlueprint = {
      grade: '7',
      subject: 'Mathematics',
      contentArea: 'Numbers, Operations and Relationships',
      termNumber: 1,
      bigIdeas: [],
      successCriteria: [],
      evidence: [],
      sourceDocuments: [],
      ratifiedAt: '2026-02-01T00:00:00.000Z',
    };
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(fakeBlueprint);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { unitBlueprint: unknown };
    };
    expect(parsed.context.unitBlueprint).toEqual(fakeBlueprint);
  });

  it('passes null unitBlueprint when getUnitBlueprint returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { unitBlueprint: unknown };
    };
    expect(parsed.context.unitBlueprint).toBeNull();
  });

  it('calls getUnitBlueprint with correct parameters from input', async () => {
    const gatewayCall: CE05GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const capturedParams: Array<{
      grade: string;
      subject: string;
      termNumber: number;
      weekNumber: number;
      academicYear: number;
    }> = [];
    const getUnitBlueprint: GetUnitBlueprintFn = vi
      .fn()
      .mockImplementation((_tx, params) => {
        capturedParams.push(params);
        return Promise.resolve(null);
      });
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Life Sciences',
          weekNumber: 7,
          termNumber: 2,
          academicYear: 2027,
          tenantId: TENANT_ID,
          templateId: 'lesson-plan-v2',
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({
      grade: '9',
      subject: 'Life Sciences',
      termNumber: 2,
      weekNumber: 7,
      academicYear: 2027,
    });
  });

  it('passes grade, subject, weekNumber, termNumber, academicYear, and templateId in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subject: 'Physical Sciences',
          weekNumber: 5,
          termNumber: 3,
          academicYear: 2027,
          tenantId: TENANT_ID,
          templateId: 'lesson-plan-v3',
        },
      }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: {
        grade: string;
        subject: string;
        weekNumber: number;
        termNumber: number;
        academicYear: number;
        templateId: string;
      };
    };
    expect(parsed.input.grade).toBe('10');
    expect(parsed.input.subject).toBe('Physical Sciences');
    expect(parsed.input.weekNumber).toBe(5);
    expect(parsed.input.termNumber).toBe(3);
    expect(parsed.input.academicYear).toBe(2027);
    expect(parsed.input.templateId).toBe('lesson-plan-v3');
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-05 test.';

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.lessons as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE05GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getUnitBlueprint: GetUnitBlueprintFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE05Executor(
      withTenant,
      listConstitution,
      getUnitBlueprint,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.lessons');
  });
});
