import { describe, expect, it, vi } from 'vitest';

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  CoverageAuditResult,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import {
  makeCE09Executor,
  type CE09GatewayCallFn,
  type GetEpisodeLogFn,
  type GetTermPlanFn,
  type WithCE09TenantFn,
} from '../src/ce09-executor.js';
import type { StepExecutionContext } from '../src/l0-gate-executor.js';
import { CurriculumSeedError } from '../src/types.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '10000000-0000-4000-8000-000000000009';
const PROMPT_BODY = '# ROLE\nCE-09 stub prompt for tests.';

function makeContext(overrides?: Partial<StepExecutionContext>): StepExecutionContext {
  return {
    runId: 'run-ce09-1',
    stepId: 'audit-coverage',
    attempt: 1,
    input: {
      grade: '7',
      subject: 'Mathematics',
      termNumber: 1,
      academicYear: 2026,
      tenantId: TENANT_ID,
    },
    ...overrides,
  };
}

function makeGatewayResponse(outputJson: unknown): ChatCompletionResponse {
  return {
    id: 'chatcmpl-test',
    model: 'curriculum.audit',
    provider: 'anthropic',
    message: {
      role: 'assistant',
      content: JSON.stringify(outputJson),
    },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    cached: false,
  };
}

const NEEDS_INPUT_RESULT: CoverageAuditResult = {
  status: 'needs_input',
  grade: '7',
  subject: 'Mathematics',
  termNumber: 1,
  missing: [
    {
      documentKind: 'TERM_PLAN',
      detail: null,
      why: 'No ratified TermPlan found for Mathematics Grade 7 Term 1.',
    },
  ],
};

const OK_RESULT: CoverageAuditResult = {
  status: 'ok',
  audit: {
    grade: '7',
    subject: 'Mathematics',
    termNumber: 1,
    academicYear: 2026,
    coverageRatePct: 100.0,
    driftItems: [],
    sourceDocuments: [
      {
        documentId: 'term-plan-gr7-t1',
        documentVersion: '2026-01',
        clause: '§2 Term Plan',
        ratifiedBy: null,
      },
    ],
    auditedAt: '2026-04-01T08:00:00.000Z',
  },
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

const FAKE_EPISODE_LOG = {
  termNumber: 1,
  entries: [{ topicId: 'alg-1', weekNumber: 2 }],
};

function makeWithTenant(
  stub: (
    fn: (tx: TenantClient) => Promise<CoverageAuditResult>,
  ) => Promise<CoverageAuditResult>,
): WithCE09TenantFn {
  return (_ctx, fn) => stub(fn);
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('makeCE09Executor', () => {
  it('returns needs_input when gateway returns needs_input', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(NEEDS_INPUT_RESULT);
  });

  it('returns ok when gateway returns a valid CoverageAudit', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(OK_RESULT));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(FAKE_TERM_PLAN);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(FAKE_EPISODE_LOG);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    const result = await executor(makeContext());

    expect(result).toEqual(OK_RESULT);
  });

  it('throws CurriculumSeedError for invalid input (missing subject)', async () => {
    const gatewayCall: CE09GatewayCallFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi.fn();
    const getEpisodeLog: GetEpisodeLogFn = vi.fn();
    const withTenant = vi.fn() as unknown as WithCE09TenantFn;

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    const badContext = makeContext({
      input: {
        grade: '7',
        // subject missing
        termNumber: 1,
        academicYear: 2026,
        tenantId: TENANT_ID,
      },
    });

    await expect(executor(badContext)).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response is not valid JSON', async () => {
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockResolvedValue({
      id: 'chatcmpl-test',
      model: 'curriculum.audit',
      provider: 'anthropic',
      message: { role: 'assistant', content: 'not json at all' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cached: false,
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('throws CurriculumSeedError when gateway response does not match CoverageAuditResult', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse({ status: 'unknown_status', data: [] }));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(CurriculumSeedError);
  });

  it('propagates errors from getTermPlan', async () => {
    const gatewayCall: CE09GatewayCallFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for term plan'));
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for term plan',
    );
  });

  it('propagates errors from getEpisodeLog', async () => {
    const gatewayCall: CE09GatewayCallFn = vi.fn();
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi
      .fn()
      .mockRejectedValue(new Error('brain read failed for episode log'));
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow(
      'brain read failed for episode log',
    );
  });

  it('propagates errors from gatewayCall', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockRejectedValue(new Error('gateway timeout'));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );

    await expect(executor(makeContext())).rejects.toThrow('gateway timeout');
  });

  it('passes tenantId and actorId to withTenant', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const captured: Array<{ tenantId: string; actorId: string }> = [];
    const withTenant: WithCE09TenantFn = (ctx, fn) => {
      captured.push(ctx);
      return fn({} as TenantClient);
    };

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tenantId).toBe(TENANT_ID);
    expect(captured[0]?.actorId).toBe('ce09-executor');
  });

  it('passes termPlan and episodeLog from Brain in context', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(FAKE_TERM_PLAN);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(FAKE_EPISODE_LOG);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { termPlan: unknown; episodeLog: unknown };
    };
    expect(parsed.context.termPlan).toEqual(FAKE_TERM_PLAN);
    expect(parsed.context.episodeLog).toEqual(FAKE_EPISODE_LOG);
  });

  it('passes null termPlan and episodeLog when Brain returns null', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    const userMsg = capturedRequests[0]?.messages[1];
    expect(userMsg).toBeDefined();
    const parsed = JSON.parse(userMsg!.content) as {
      context: { termPlan: unknown; episodeLog: unknown };
    };
    expect(parsed.context.termPlan).toBeNull();
    expect(parsed.context.episodeLog).toBeNull();
  });

  it('calls getTermPlan with grade, termNumber, and academicYear from input', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const capturedParams: Array<{
      grade: string;
      termNumber: number;
      academicYear: number;
    }> = [];
    const getTermPlan: GetTermPlanFn = vi.fn().mockImplementation((_tx, params) => {
      capturedParams.push(params);
      return Promise.resolve(null);
    });
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '10',
          subject: 'Life Sciences',
          termNumber: 3,
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({ grade: '10', termNumber: 3, academicYear: 2027 });
  });

  it('calls getEpisodeLog with correct params', async () => {
    const gatewayCall: CE09GatewayCallFn = vi
      .fn()
      .mockResolvedValue(makeGatewayResponse(NEEDS_INPUT_RESULT));
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const capturedParams: Array<{
      grade: string;
      subject: string;
      termNumber: number;
      academicYear: number;
    }> = [];
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockImplementation((_tx, params) => {
      capturedParams.push(params);
      return Promise.resolve(null);
    });
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '9',
          subject: 'Physical Sciences',
          termNumber: 2,
          academicYear: 2027,
          tenantId: TENANT_ID,
        },
      }),
    );

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0]).toEqual({
      grade: '9',
      subject: 'Physical Sciences',
      termNumber: 2,
      academicYear: 2027,
    });
  });

  it('passes all input fields in the user message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(
      makeContext({
        input: {
          grade: '8',
          subject: 'English Home Language',
          termNumber: 4,
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
        academicYear: number;
      };
    };
    expect(parsed.input.grade).toBe('8');
    expect(parsed.input.subject).toBe('English Home Language');
    expect(parsed.input.termNumber).toBe(4);
    expect(parsed.input.academicYear).toBe(2026);
  });

  it('uses the promptBody as the system message', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));
    const customPrompt = 'Custom prompt body for CE-09 test.';

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      customPrompt,
    );
    await executor(makeContext());

    const systemMsg = capturedRequests[0]?.messages[0];
    expect(systemMsg?.content).toBe(customPrompt);
  });

  it('uses curriculum.audit as the model', async () => {
    const capturedRequests: ChatCompletionRequest[] = [];
    const gatewayCall: CE09GatewayCallFn = vi.fn().mockImplementation((req) => {
      capturedRequests.push(req);
      return Promise.resolve(makeGatewayResponse(NEEDS_INPUT_RESULT));
    });
    const getTermPlan: GetTermPlanFn = vi.fn().mockResolvedValue(null);
    const getEpisodeLog: GetEpisodeLogFn = vi.fn().mockResolvedValue(null);
    const withTenant = makeWithTenant((fn) => fn({} as TenantClient));

    const executor = makeCE09Executor(
      withTenant,
      getTermPlan,
      getEpisodeLog,
      gatewayCall,
      PROMPT_BODY,
    );
    await executor(makeContext());

    expect(capturedRequests[0]?.model).toBe('curriculum.audit');
  });
});
