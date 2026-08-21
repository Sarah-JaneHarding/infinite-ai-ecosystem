import { describe, expect, it, vi } from 'vitest';

import type {
  AssessmentTaskDesignResult,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import {
  makeCE06Executor,
  type CE06GatewayCallFn,
  type GetGradeFrameworkFn,
  type WithCE06TenantFn,
} from '../src/ce06-executor.js';
import type { GetTermPlanFn } from '../src/ce04-executor.js';
import type {
  ListConstitutionFn,
  StepExecutionContext,
} from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000006';
const PROMPT_BODY = '# ROLE\nCE-06 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce06-1',
    stepId: 'design-assessment-task',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      termNumber: 1,
      taskKind: 'test',
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
    model: 'curriculum.assess',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: AssessmentTaskDesignResult = {
  status: 'needs_input',
  grade: '7',
  subject: 'Mathematics',
  missing: [
    {
      documentKind: 'GRADE_FRAMEWORK',
      detail: null,
      why: 'No ratified GradeFramework found for Grade 7.',
    },
  ],
};

const OK_RESULT: AssessmentTaskDesignResult = {
  status: 'ok',
  task: {
    grade: '7',
    subject: 'Mathematics',
    termNumber: 1,
    taskKind: 'test',
    totalMarks: 50,
    cognitiveSpread: {
      knowledge: 20,
      comprehension: 30,
      application: 25,
      analysis: 15,
      synthesis: 5,
      evaluation: 5,
    },
    sections: [
      {
        title: 'Section A',
        totalMarks: 50,
        questions: [
          {
            number: 1,
            marks: 50,
            cognitiveLevel: 'knowledge',
            source: {
              documentId: 'caps-gr7',
              documentVersion: '2011-01',
              clause: '§3.1 Topic 1',
              ratifiedBy: null,
            },
          },
        ],
      },
    ],
    sourceDocuments: [
      {
        documentId: 'caps-gr7',
        documentVersion: '2011-01',
        clause: '§3.1 Topic 1',
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
    source: { documentId: 'fw-doc', documentVersion: 1 },
  },
  subjects: [],
  ratifiedAt: '2026-01-15T00:00:00.000Z',
};

const FAKE_TERM_PLAN = {
  grade: '7',
  termNumber: 1,
  academicYear: 2026,
  subjects: [],
  assessmentCalendar: [],
  sourceDocuments: [],
  ratifiedAt: '2026-01-15T00:00:00.000Z',
};

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<AssessmentTaskDesignResult>,
  ) => Promise<AssessmentTaskDesignResult>,
): WithCE06TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE06Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('returns ok when gateway returns a valid AssessmentTaskDesign', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(OK_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(FAKE_TERM_PLAN);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(OK_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing taskKind)', async () => {
    const gatewayCall: CE06GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn();
    const getGradeFramework: GetGradeFrameworkFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE06TenantFn;

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
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
        // taskKind missing
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.assess',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match AssessmentTaskDesignResult', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 123 }));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from listConstitution', async () => {
    const gatewayCall: CE06GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
    const getGradeFramework: GetGradeFrameworkFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi.fn();
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('db connection lost');
  });

  it('propagates errors from getGradeFramework', async () => {
    const gatewayCall: CE06GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for framework'));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for framework',
    );
  });

  it('propagates errors from getTermPlan', async () => {
    const gatewayCall: CE06GatewayCallFn = vi.fn();
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for term plan'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for term plan',
    );
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId from input to withTenant', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE06TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
    expect(captured[0]?.actorId).toBe('ce06-executor');
  });

  it('passes only ASSESSMENT_POLICY rows and excludes CAPS_CANON and ATP_CALENDAR', async () => {
    const capsRow = makeRow('CAPS_CANON', 'caps-1');
    const atpRow = makeRow('ATP_CALENDAR', 'atp-1');
    const assessRow = makeRow('ASSESSMENT_POLICY', 'assess-1');
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi
      .fn()
      .mockResolvedValue([capsRow, atpRow, assessRow]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { assessmentPolicy: ConstitutionRow[] };
    };
    expect(parsed.context.assessmentPolicy).toHaveLength(1);
    expect(parsed.context.assessmentPolicy[0]?.id).toBe('assess-1');
  });

  it('passes framework and termPlan from Brain in context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(FAKE_TERM_PLAN);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; termPlan: unknown };
    };
    expect(parsed.context.framework).toEqual(FAKE_FRAMEWORK);
    expect(parsed.context.termPlan).toEqual(FAKE_TERM_PLAN);
  });

  it('passes null framework and termPlan when Brain returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; termPlan: unknown };
    };
    expect(parsed.context.framework).toBeNull();
    expect(parsed.context.termPlan).toBeNull();
  });

  it('calls getGradeFramework with correct params', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const capturedParams: Array<{ grade: string; academicYear: number }> = [];
    const getGradeFramework: GetGradeFrameworkFn = vi
      .fn()
      .mockImplementation((_tx, params) => {
        capturedParams.push(params);
        return Promise.resolve(null);
      });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
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
          taskKind: 'examination',
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '10', academicYear: 2027 });
  });

  it('calls getTermPlan with correct params', async () => {
    const gatewayCall: CE06GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
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

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Life Sciences',
          termNumber: 3,
          taskKind: 'project',
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '9', termNumber: 3, academicYear: 2027 });
  });

  it('passes grade, subject, termNumber, taskKind, and academicYear in user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '11',
          subject: 'History',
          termNumber: 2,
          taskKind: 'assignment',
          academicYear: 2026,
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
        taskKind: string;
        academicYear: number;
      };
    };
    expect(parsed.input.grade).toBe('11');
    expect(parsed.input.subject).toBe('History');
    expect(parsed.input.termNumber).toBe(2);
    expect(parsed.input.taskKind).toBe('assignment');
    expect(parsed.input.academicYear).toBe(2026);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-06 test.';

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.assess as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE06GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const listConstitution: ListConstitutionFn = vi.fn().mockResolvedValue([]);
    const getGradeFramework: GetGradeFrameworkFn = vi.fn().mockResolvedValue(null);
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE06Executor(
      withTenant,
      listConstitution,
      getGradeFramework,
      getTermPlan,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.assess');
  });
});
