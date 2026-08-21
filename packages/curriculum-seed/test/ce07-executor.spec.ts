import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  RubricResult,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import {
  makeCE07Executor,
  type CE07GatewayCallFn,
  type GetAssessmentTaskFn,
  type GetRubricFrameworkFn,
  type WithCE07TenantFn,
} from '../src/ce07-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000007';
const PROMPT_BODY = '# ROLE\nCE-07 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce07-1',
    stepId: 'build-rubric',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      taskKind: 'test',
      tenantId: TENANT_ID,
      totalMarks: 50,
    },
    ...overrides,
  };
}

function makeGatewayResponse(outputJson: unknown): ChatCompletionResponse {
  return {
    id: 'chatcmpl-test',
    model: 'curriculum.rubric',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: RubricResult = {
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

const OK_RESULT: RubricResult = {
  status: 'ok',
  rubric: {
    grade: '7',
    subject: 'Mathematics',
    taskKind: 'test',
    totalMarks: 50,
    criteria: [
      {
        criterion: 'Question 1 — Solve for x',
        descriptors: {
          level4: 'Correct solution with full working shown.',
          level3: 'Correct solution with minor working gaps.',
          level2: 'Partial solution — method correct but calculation error.',
          level1: 'Minimal engagement; formula recalled but not applied.',
        },
        marks: 50,
        source: {
          documentId: 'caps-gr7',
          documentVersion: '2011-01',
          clause: '§3.1 Topic 1',
          ratifiedBy: null,
        },
      },
    ],
    markingMemo: 'Award full marks for correct solution with working shown.',
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

const FAKE_ASSESSMENT_TASK = {
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
  ratifiedAt: '2026-02-01T00:00:00.000Z',
};

function makeWithTenant(
  stub: (fn: (tx: TenantClient) => Promise<RubricResult>) => Promise<RubricResult>,
): WithCE07TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE07Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('returns ok when gateway returns a valid Rubric', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(OK_RESULT));
    const getGradeFramework: GetRubricFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getAssessmentTask: GetAssessmentTaskFn = vi
      .fn()
      .mockResolvedValue(FAKE_ASSESSMENT_TASK);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(OK_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing totalMarks)', async () => {
    const gatewayCall: CE07GatewayCallFn = vi.fn();
    const getGradeFramework: GetRubricFrameworkFn = vi.fn();
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE07TenantFn;

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    const badContext = makeContext({
      input: {
        grade: '7',
        subject: 'Mathematics',
        taskKind: 'test',
        tenantId: TENANT_ID,
        // totalMarks missing
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.rubric',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match RubricResult', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: 42 }));
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from getGradeFramework', async () => {
    const gatewayCall: CE07GatewayCallFn = vi.fn();
    const getGradeFramework: GetRubricFrameworkFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for framework'));
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for framework',
    );
  });

  it('propagates errors from getAssessmentTask', async () => {
    const gatewayCall: CE07GatewayCallFn = vi.fn();
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for task'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('brain read failed for task');
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId and actorId to withTenant', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE07TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
    expect(captured[0]?.actorId).toBe('ce07-executor');
  });

  it('passes framework and assessmentTask from Brain in context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetRubricFrameworkFn = vi
      .fn()
      .mockResolvedValue(FAKE_FRAMEWORK);
    const getAssessmentTask: GetAssessmentTaskFn = vi
      .fn()
      .mockResolvedValue(FAKE_ASSESSMENT_TASK);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; assessmentTask: unknown };
    };
    expect(parsed.context.framework).toEqual(FAKE_FRAMEWORK);
    expect(parsed.context.assessmentTask).toEqual(FAKE_ASSESSMENT_TASK);
  });

  it('passes null framework and assessmentTask when Brain returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { framework: unknown; assessmentTask: unknown };
    };
    expect(parsed.context.framework).toBeNull();
    expect(parsed.context.assessmentTask).toBeNull();
  });

  it('calls getGradeFramework with the grade from input', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const capturedParams: Array<{ grade: string }> = [];
    const getGradeFramework: GetRubricFrameworkFn = vi
      .fn()
      .mockImplementation((_tx, params) => {
        capturedParams.push(params);
        return Promise.resolve(null);
      });
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subject: 'Physical Sciences',
          taskKind: 'examination',
          tenantId: TENANT_ID,
          totalMarks: 150,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '10' });
  });

  it('calls getAssessmentTask with correct grade, subject, taskKind, and totalMarks', async () => {
    const gatewayCall: CE07GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const capturedParams: Array<{
      grade: string;
      subject: string;
      taskKind: string;
      totalMarks: number;
    }> = [];
    const getAssessmentTask: GetAssessmentTaskFn = vi
      .fn()
      .mockImplementation((_tx, params) => {
        capturedParams.push(params);
        return Promise.resolve(null);
      });
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Life Sciences',
          taskKind: 'project',
          tenantId: TENANT_ID,
          totalMarks: 100,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({
      grade: '9',
      subject: 'Life Sciences',
      taskKind: 'project',
      totalMarks: 100,
    });
  });

  it('passes grade, subject, taskKind, and totalMarks in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '11',
          subject: 'History',
          taskKind: 'oral',
          tenantId: TENANT_ID,
          totalMarks: 30,
        },
      }),
    );

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      input: {
        grade: string;
        subject: string;
        taskKind: string;
        totalMarks: number;
      };
    };
    expect(parsed.input.grade).toBe('11');
    expect(parsed.input.subject).toBe('History');
    expect(parsed.input.taskKind).toBe('oral');
    expect(parsed.input.totalMarks).toBe(30);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-07 test.';

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.rubric as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE07GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getGradeFramework: GetRubricFrameworkFn = vi.fn().mockResolvedValue(null);
    const getAssessmentTask: GetAssessmentTaskFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE07Executor(
      withTenant,
      getGradeFramework,
      getAssessmentTask,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.rubric');
  });
});
