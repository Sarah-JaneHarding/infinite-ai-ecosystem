// Side-effect module: registers CE-01 through CE-09 eval-harness executors.
// Import once from evals-run.ts and evals-gate.ts so all nine executors are
// discoverable by the harness.
//
// Every executor is built from the real factory with stub dependencies:
//   - stubWithTenant    — calls fn(null) so no real DB is needed
//   - stubListConstitution — returns [] so L0 appears empty
//   - stubGetNull       — returns null for any Brain artefact getter
//   - ceXXGateway       — returns a valid needs_input JSON body so the executor's
//                         own Zod validation passes
//
// All 270 CE eval cases expect status: 'needs_input' because L0 has no
// CAPS/ATP documents — this is the "empty vessel" state the stubs replicate.

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';
import {
  registerAgentExecutor,
  type AgentExecutor,
  type EvalCase,
} from '@infinite-ai/evals';
import {
  makeCE01Executor,
  makeCE02Executor,
  makeCE03Executor,
  makeCE04Executor,
  makeCE05Executor,
  makeCE06Executor,
  makeCE07Executor,
  makeCE08Executor,
  makeCE09Executor,
  type StepExecutionContext,
} from '@infinite-ai/curriculum-seed';

// ---------------------------------------------------------------------------
// Shared stub helpers
// ---------------------------------------------------------------------------

function parseUserInput(req: ChatCompletionRequest): Record<string, unknown> {
  const userMsg = req.messages.find((m) => m.role === 'user');
  if (userMsg === undefined) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(userMsg.content) as unknown;
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const inputField = (raw as Record<string, unknown>)['input'];
  if (typeof inputField !== 'object' || inputField === null) return {};
  return inputField as Record<string, unknown>;
}

function strField(obj: Record<string, unknown>, key: string, fallback: string): string {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function numField(obj: Record<string, unknown>, key: string, fallback: number): number {
  const v = obj[key];
  return typeof v === 'number' ? v : fallback;
}

function stubResponse(model: string, payload: unknown): ChatCompletionResponse {
  return {
    id: 'eval-stub',
    model,
    provider: 'eval-stub',
    message: { role: 'assistant', content: JSON.stringify(payload) },
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    cached: false,
  };
}

function stubWithTenant<T>(
  _ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<T>,
): Promise<T> {
  return fn(null as unknown as TenantClient);
}

// Returns an empty constitution / CAPS list — simulates an empty L0.
const stubListConstitution = async () => [] as const;

// Returns null for any Brain artefact lookup — simulates nothing ratified yet.
const stubGetNull = async () => null;

function makeAdapter(
  executor: (context: StepExecutionContext) => Promise<unknown>,
): AgentExecutor {
  return async (evalCase: EvalCase) => {
    const output = await executor({
      runId: 'eval-harness',
      stepId: evalCase.id,
      attempt: 1,
      input: evalCase.input,
    });
    return { output };
  };
}

// ---------------------------------------------------------------------------
// CE-01 CAPS Mapper gateway stub
// Produces one CAPS_SUBJECT_STATEMENT missing entry per subject so the
// field-level assertions (missing.0.documentKind, missing.0.subjectName) pass.
// ---------------------------------------------------------------------------

const ce01Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const rawSubjects = inp['subjects'];
  const subjects = Array.isArray(rawSubjects)
    ? rawSubjects.filter((s): s is string => typeof s === 'string')
    : [];
  const missing =
    subjects.length > 0
      ? subjects.map((s) => ({
          documentKind: 'CAPS_SUBJECT_STATEMENT' as const,
          subjectName: s,
          why: 'No CAPS subject statement found in L0',
        }))
      : [
          {
            documentKind: 'CAPS_SUBJECT_STATEMENT' as const,
            subjectName: null as null,
            why: 'No CAPS subject statement found in L0',
          },
        ];
  return stubResponse('curriculum.map', { status: 'needs_input', grade, missing });
};

// ---------------------------------------------------------------------------
// CE-02 ATP Sequencer gateway stub
// One eval case asserts missing.0.documentKind === 'ATP'.
// ---------------------------------------------------------------------------

const ce02Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  return stubResponse('curriculum.sequence', {
    status: 'needs_input',
    grade,
    missing: [{ documentKind: 'ATP', subjectName: null, why: 'No ATP found in L0' }],
  });
};

// ---------------------------------------------------------------------------
// CE-03 Term Planner gateway stub
// Only status is asserted in the eval set.
// ---------------------------------------------------------------------------

const ce03Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const termNumber = numField(inp, 'termNumber', 1);
  return stubResponse('curriculum.plan', {
    status: 'needs_input',
    grade,
    termNumber,
    missing: [
      {
        documentKind: 'GRADE_FRAMEWORK',
        subjectName: null,
        why: 'No grade framework in L0',
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-04 Unit Architect gateway stub
// ---------------------------------------------------------------------------

const ce04Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  const contentArea = strField(inp, 'contentArea', 'Number');
  return stubResponse('curriculum.design', {
    status: 'needs_input',
    grade,
    subject,
    contentArea,
    missing: [
      {
        documentKind: 'GRADE_FRAMEWORK',
        subjectName: null,
        why: 'No grade framework found',
      },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-05 Lesson Plan Generator gateway stub
// ---------------------------------------------------------------------------

const ce05Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  const weekNumber = numField(inp, 'weekNumber', 1);
  return stubResponse('curriculum.lessons', {
    status: 'needs_input',
    grade,
    subject,
    weekNumber,
    missing: [
      { documentKind: 'GRADE_FRAMEWORK', detail: null, why: 'No grade framework found' },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-06 Assessment Designer gateway stub
// ---------------------------------------------------------------------------

const ce06Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  return stubResponse('curriculum.assess', {
    status: 'needs_input',
    grade,
    subject,
    missing: [
      { documentKind: 'GRADE_FRAMEWORK', detail: null, why: 'No grade framework found' },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-07 Rubric Builder gateway stub
// ---------------------------------------------------------------------------

const ce07Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  return stubResponse('curriculum.rubric', {
    status: 'needs_input',
    grade,
    subject,
    missing: [
      { documentKind: 'GRADE_FRAMEWORK', detail: null, why: 'No grade framework found' },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-08 Differentiation Agent gateway stub
// ---------------------------------------------------------------------------

const ce08Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  const weekNumber = numField(inp, 'weekNumber', 1);
  return stubResponse('curriculum.differentiate', {
    status: 'needs_input',
    grade,
    subject,
    weekNumber,
    missing: [
      { documentKind: 'GRADE_FRAMEWORK', detail: null, why: 'No grade framework found' },
    ],
  });
};

// ---------------------------------------------------------------------------
// CE-09 Coverage Auditor gateway stub
// ---------------------------------------------------------------------------

const ce09Gateway = async (
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const inp = parseUserInput(req);
  const grade = strField(inp, 'grade', 'R');
  const subject = strField(inp, 'subject', 'Mathematics');
  const termNumber = numField(inp, 'termNumber', 1);
  return stubResponse('curriculum.audit', {
    status: 'needs_input',
    grade,
    subject,
    termNumber,
    missing: [
      { documentKind: 'TERM_PLAN', detail: null, why: 'No term plan found in Brain' },
    ],
  });
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

registerAgentExecutor(
  'CE-01',
  makeAdapter(makeCE01Executor(stubWithTenant, stubListConstitution, ce01Gateway, '')),
);

registerAgentExecutor(
  'CE-02',
  makeAdapter(makeCE02Executor(stubWithTenant, stubListConstitution, ce02Gateway, '')),
);

registerAgentExecutor(
  'CE-03',
  makeAdapter(makeCE03Executor(stubWithTenant, stubListConstitution, ce03Gateway, '')),
);

registerAgentExecutor(
  'CE-04',
  makeAdapter(
    makeCE04Executor(stubWithTenant, stubListConstitution, stubGetNull, ce04Gateway, ''),
  ),
);

registerAgentExecutor(
  'CE-05',
  makeAdapter(
    makeCE05Executor(stubWithTenant, stubListConstitution, stubGetNull, ce05Gateway, ''),
  ),
);

registerAgentExecutor(
  'CE-06',
  makeAdapter(
    makeCE06Executor(
      stubWithTenant,
      stubListConstitution,
      stubGetNull,
      stubGetNull,
      ce06Gateway,
      '',
    ),
  ),
);

registerAgentExecutor(
  'CE-07',
  makeAdapter(
    makeCE07Executor(stubWithTenant, stubGetNull, stubGetNull, ce07Gateway, ''),
  ),
);

registerAgentExecutor(
  'CE-08',
  makeAdapter(
    makeCE08Executor(stubWithTenant, stubGetNull, stubGetNull, ce08Gateway, ''),
  ),
);

registerAgentExecutor(
  'CE-09',
  makeAdapter(
    makeCE09Executor(stubWithTenant, stubGetNull, stubGetNull, ce09Gateway, ''),
  ),
);
