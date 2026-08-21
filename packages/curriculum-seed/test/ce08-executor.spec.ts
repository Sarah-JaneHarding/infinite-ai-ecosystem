import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  DifferentiationResult,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import {
  makeCE08Executor,
  type CE08GatewayCallFn,
  type GetGradeFrameworkFn,
  type GetLessonPlanFn,
  type WithCE08TenantFn,
} from '../src/ce08-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000008';
const PROMPT_BODY = '# ROLE\nCE-08 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce08-1',
    stepId: 'differentiate-lessons',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      weekNumber: 3,
      termNumber: 1,
      academicYear: 2026,
      tenantId: TENANT_ID,
      tiers: ['support', 'on-level', 'extension'],
    },
    ...overrides,
  };
}

function makeGatewayResponse(outputJson: unknown): ChatCompletionResponse {
  return {
    id: 'chatcmpl-test',
    model: 'curriculum.differentiate',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: DifferentiationResult = {
  status: 'needs_input',
  grade: '7',
  subject: 'Mathematics',
  weekNumber: 3,
  missing: [
    {
      documentKind: 'LESSON_PLAN',
      detail: null,
      why: 'No ratified LessonPlan found for Mathematics Grade 7 Week 3.',
    },
  ],
};

const OK_RESULT: DifferentiationResult = {
  status: 'ok',
  set: {
    grade: '7',
    subject: 'Mathematics',
    weekNumber: 3,
    termNumber: 1,
    academicYear: 2026,
    tiers: [
      {
        name: 'on-level',
        modifications: ['Mirrors the base lesson plan activities.'],
        scaffolds: [],
        source: {
          documentId: 'lesson-plan-w3',
          documentVersion: '1.0',
          clause: '§ Week 3',
          ratifiedBy: null,
        },
      },
    ],
    sourceDocuments: [
      {
        documentId: 'lesson-plan-w3',
        documentVersion: '1.0',
        clause: '§ Week 3',
        ratifiedBy: null,
      },
    ],
    ratifiedAt: null,
  },
};

const FAKE_FRAMEWORK = {
  grade: '7',
  phase: 'Senior',
  totalInstructionalHours: {
    value: 30,
    source: {
      documentId: 'fw-doc',
      documentVersion: '2011-01',
      clause: '§1',
      ratifiedBy: null,
    },
  },
  subjects: [],
  ratifiedAt: '2026-01-15T00:00:00.000Z',
};

const FAKE_LESSON_PLAN = {
  grade: '7',
  subject: 'Mathematics',
  weekNumber: 3,
  termNumber: 1,
  academicYear: 2026,
  templateId: 'lesson-plan-v1',
  lessons: [],
  sourceDocuments: [],
  ratifiedAt: '2026-02-01T00:00:00.000Z',
};

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<DifferentiationResult>,
  ) => Promise<DifferentiationResult>,
): WithCE08TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE08Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('returns ok when gateway returns a valid DifferentiatedSet', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(OK_RESULT));
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(FAKE_LESSON_PLAN);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(OK_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing tiers)', async () => {
    const gatewayCall: CE08GatewayCallFn = vi.fn();
    const getGradeFramework: GetGradeFrameworkFn = vi.fn();
    const getLessonPlan: GetLessonPlanFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE08TenantFn;

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
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
        // tiers missing
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.differentiate',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match DifferentiationResult', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: [] }));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from getGradeFramework', async () => {
    const gatewayCall: CE08GatewayCallFn = vi.fn();
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for framework'));
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for framework',
    );
  });

  it('propagates errors from getLessonPlan', async () => {
    const gatewayCall: CE08GatewayCallFn = vi.fn();
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for lesson plan'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for lesson plan',
    );
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId and actorId to withTenant', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE08TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
    expect(captured[0]?.actorId).toBe('ce08-executor');
  });

  it('passes framework and lessonPlan from Brain in context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(FAKE_LESSON_PLAN);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; lessonPlan: unknown };
    };
    expect(parsed.context.framework).toEqual(FAKE_FRAMEWORK);
    expect(parsed.context.lessonPlan).toEqual(FAKE_LESSON_PLAN);
  });

  it('passes null framework and lessonPlan when Brain returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; lessonPlan: unknown };
    };
    expect(parsed.context.framework).toBeNull();
    expect(parsed.context.lessonPlan).toBeNull();
  });

  it('calls getGradeFramework with grade and academicYear from input', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const capturedParams: Array<{ grade: string; academicYear: number }> = [];
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockImplementation((_tx, params) => {
        capturedParams.push(params);
        return Promise.resolve(null);
      });
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subject: 'Physical Sciences',
          weekNumber: 5,
          termNumber: 2,
          academicYear: 2027,
          tenantId: TENANT_ID,
          tiers: ['support'],
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '10', academicYear: 2027 });
  });

  it('calls getLessonPlan with correct params', async () => {
    const gatewayCall: CE08GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const capturedParams: Array<{
      grade: string;
      subject: string;
      weekNumber: number;
      termNumber: number;
      academicYear: number;
    }> = [];
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockImplementation((_tx, params) => {
      capturedParams.push(params);
      return Promise.resolve(null);
    });
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Life Sciences',
          weekNumber: 7,
          termNumber: 3,
          academicYear: 2027,
          tenantId: TENANT_ID,
          tiers: ['extension'],
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({
      grade: '9',
      subject: 'Life Sciences',
      weekNumber: 7,
      termNumber: 3,
      academicYear: 2027,
    });
  });

  it('passes all input fields including tiers in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '8',
          subject: 'English',
          weekNumber: 4,
          termNumber: 2,
          academicYear: 2026,
          tenantId: TENANT_ID,
          tiers: ['support', 'extension'],
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
        tiers: string[];
      };
    };
    expect(parsed.input.grade).toBe('8');
    expect(parsed.input.subject).toBe('English');
    expect(parsed.input.weekNumber).toBe(4);
    expect(parsed.input.termNumber).toBe(2);
    expect(parsed.input.academicYear).toBe(2026);
    expect(parsed.input.tiers).toEqual(['support', 'extension']);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-08 test.';

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.differentiate as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE08GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getLessonPlan: GetLessonPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE08Executor(
      withTenant,
      getGradeFramework,
      getLessonPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.differentiate');
  });
});
