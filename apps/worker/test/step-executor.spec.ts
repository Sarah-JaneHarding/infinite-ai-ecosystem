// Unit tests for the step executor — the dispatch layer between the orchestrator runner
// and real agent/tool work. Tests mock fetch and the prompts loader to exercise the
// routing logic without network or file-system dependencies.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AC01Contract, AC10Contract, CE01Contract } from '@infinite-ai/agents';
import {
  GuardrailEscalationError,
  refuse,
  type AgeAppropriatenessChecker,
} from '@infinite-ai/guardrails';
import {
  MOD01_CURRICULUM_PIPELINE,
  type PipelineDefinition,
} from '@infinite-ai/orchestrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GuardrailRefusalError,
  StepExecutorError,
  createStepExecutor,
  type StepExecutorDeps,
  type ToolHandlerMap,
} from '../src/step-executor.js';

// Path to the real prompt file so loadPromptFile resolves without a mock.
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_ROOT = path.resolve(thisDir, '../../../packages/prompts/src');

const MOCK_TENANT_ID = 'tenant-abc';
const MOCK_GATEWAY_URL = 'http://gateway.test';
const MOCK_RUN_ID = 'run-001';

function makeToolHandlers(
  overrides?: Record<string, (input: unknown) => Promise<unknown>>,
): ToolHandlerMap {
  return new Map(Object.entries(overrides ?? {}));
}

function makeDeps(overrides?: Partial<StepExecutorDeps>): StepExecutorDeps {
  return {
    pipeline: MOD01_CURRICULUM_PIPELINE,
    agentContracts: new Map([[CE01Contract.id, CE01Contract]]),
    promptsRoot: PROMPTS_ROOT,
    gatewayBaseUrl: MOCK_GATEWAY_URL,
    tenantId: MOCK_TENANT_ID,
    toolHandlers: makeToolHandlers(),
    ...overrides,
  };
}

const FAKE_RESPONSE = {
  id: 'resp-1',
  model: 'curriculum.map',
  provider: 'anthropic',
  message: {
    role: 'assistant',
    content: JSON.stringify({ status: 'ok', framework: {} }),
  },
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  cached: false,
};

describe('createStepExecutor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('agent_call happy path', () => {
    it('POSTs to the gateway and returns parsed JSON from the assistant content', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => FAKE_RESPONSE,
        text: async () => JSON.stringify(FAKE_RESPONSE),
      });
      vi.stubGlobal('fetch', fetchMock);

      const executor = createStepExecutor(makeDeps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 1,
        input: { grade: '4', subjects: ['Mathematics'] },
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${MOCK_GATEWAY_URL}/v1/chat/completions`);
      expect(init.method).toBe('POST');

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['tenantId']).toBe(MOCK_TENANT_ID);
      expect(body['agent']).toBe('CE-01');
      expect(body['model']).toBe('curriculum.map');
      expect((body['provenance'] as Record<string, unknown>)['deidentified']).toBe(true);

      expect(result).toEqual({ status: 'ok', framework: {} });
    });

    it('includes mapItemIndex in the idempotency key so two map items do not collide', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => FAKE_RESPONSE,
        text: async () => JSON.stringify(FAKE_RESPONSE),
      });
      vi.stubGlobal('fetch', fetchMock);

      const executor = createStepExecutor(makeDeps());
      await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 0,
        input: 'item-a',
        mapItemIndex: 0,
      });
      await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 0,
        input: 'item-b',
        mapItemIndex: 1,
      });

      const keys = fetchMock.mock.calls.map((call) => {
        const [, init] = call as [string, RequestInit];
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        return body['idempotencyKey'];
      });
      expect(keys[0]).not.toBe(keys[1]);
      expect(keys).toEqual([
        `${MOCK_RUN_ID}-build-topic-graph-0-0`,
        `${MOCK_RUN_ID}-build-topic-graph-1-0`,
      ]);
    });

    it('omits the map disambiguator for a normal (non-map) step, leaving the key unchanged', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => FAKE_RESPONSE,
        text: async () => JSON.stringify(FAKE_RESPONSE),
      });
      vi.stubGlobal('fetch', fetchMock);

      const executor = createStepExecutor(makeDeps());
      await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 2,
        input: {},
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['idempotencyKey']).toBe(`${MOCK_RUN_ID}-build-topic-graph-2`);
    });
  });

  describe('agent_call failure paths', () => {
    it('throws StepExecutorError when the gateway returns a non-ok status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        }),
      );

      const executor = createStepExecutor(makeDeps());
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(StepExecutorError);

      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(/503/);
    });

    it('throws StepExecutorError when the agent returns non-JSON content', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ...FAKE_RESPONSE,
            message: { role: 'assistant', content: 'Sorry, I cannot help with that.' },
          }),
        }),
      );

      const executor = createStepExecutor(makeDeps());
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(StepExecutorError);
    });
  });

  describe('agent_call guardrails (OQ-014, OQ-015)', () => {
    function stubGatewayResponse(): void {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => FAKE_RESPONSE,
          text: async () => JSON.stringify(FAKE_RESPONSE),
        }),
      );
    }

    it('returns the output unchanged when no ageAppropriatenessChecker is supplied', async () => {
      stubGatewayResponse();
      const executor = createStepExecutor(makeDeps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 1,
        input: {},
      });
      expect(result).toEqual({ status: 'ok', framework: {} });
    });

    it('throws GuardrailRefusalError when the checker refuses, without escalating', async () => {
      stubGatewayResponse();
      const checker: AgeAppropriatenessChecker = () =>
        refuse('age_inappropriate', 'not suitable for this grade');
      const notify = vi.fn();

      const executor = createStepExecutor(
        makeDeps({ ageAppropriatenessChecker: checker, notify }),
      );
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(GuardrailRefusalError);
      expect(notify).not.toHaveBeenCalled();
    });

    it('calls the configured notifier when the checker refuses with an escalation route', async () => {
      stubGatewayResponse();
      const escalation = { category: 'safeguarding_concern', notifyRole: 'sbst' };
      const checker: AgeAppropriatenessChecker = () =>
        refuse('age_inappropriate', 'contains a safeguarding concern', escalation);
      const notify = vi.fn().mockResolvedValue(undefined);

      const executor = createStepExecutor(
        makeDeps({ ageAppropriatenessChecker: checker, notify }),
      );
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(GuardrailRefusalError);

      expect(notify).toHaveBeenCalledOnce();
      const [route, refusal] = notify.mock.calls[0] as [unknown, { code: string }];
      expect(route).toEqual(escalation);
      expect(refusal.code).toBe('age_inappropriate');
    });

    it('surfaces GuardrailEscalationError when a refusal escalates and no notifier is configured', async () => {
      stubGatewayResponse();
      const escalation = { category: 'safeguarding_concern', notifyRole: 'sbst' };
      const checker: AgeAppropriatenessChecker = () =>
        refuse('age_inappropriate', 'contains a safeguarding concern', escalation);

      // No `notify` supplied — falls back to defaultEscalationNotifier, which throws
      // rather than silently dropping a safeguarding concern (OQ-014).
      const executor = createStepExecutor(
        makeDeps({ ageAppropriatenessChecker: checker }),
      );
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'build-topic-graph',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(GuardrailEscalationError);
    });
  });

  describe('unknown step', () => {
    it('throws StepExecutorError for a stepId not in the pipeline', async () => {
      const executor = createStepExecutor(makeDeps());
      await expect(
        executor({ runId: MOCK_RUN_ID, stepId: 'no-such-step', attempt: 1, input: {} }),
      ).rejects.toThrow(StepExecutorError);

      await expect(
        executor({ runId: MOCK_RUN_ID, stepId: 'no-such-step', attempt: 1, input: {} }),
      ).rejects.toThrow(/no-such-step/);
    });
  });

  describe('tool_call', () => {
    it('dispatches to the registered handler and returns its output', async () => {
      const mockOutput = { ingested: true };
      const handler = vi.fn().mockResolvedValue(mockOutput);
      const deps = makeDeps({
        toolHandlers: makeToolHandlers({ 'l0.ingest_ratified_source': handler }),
      });

      const executor = createStepExecutor(deps);
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'ingest-caps-atp',
        attempt: 1,
        input: { documentId: 'doc-1', documentVersion: '1.0' },
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(result).toEqual(mockOutput);
    });

    it('throws StepExecutorError when no handler is registered for the tool name', async () => {
      const executor = createStepExecutor(makeDeps({ toolHandlers: makeToolHandlers() }));
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'ingest-caps-atp',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(StepExecutorError);

      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'ingest-caps-atp',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(/l0.ingest_ratified_source/);
    });
  });

  describe('agent_call diagnosis_guard (OQ-026)', () => {
    // A minimal one-step pipeline calling AC-01 (mod-02), which declares "diagnosis_guard"
    // and freeTextOutputFields: ['detail'] on its real contract — enough to exercise the
    // wiring without pulling in the full MOD02_RTI_PIPELINE.
    const AC01_PIPELINE: PipelineDefinition = {
      id: 'mod-02-test',
      version: '1.0.0',
      entryStepId: 'screen-learner',
      steps: {
        'screen-learner': {
          id: 'screen-learner',
          kind: 'agent_call',
          agentId: 'AC-01',
          next: null,
          timeoutMs: 10_000,
          maxRetries: 0,
          compensatesWith: null,
        },
      },
    };

    function makeAc01Deps(overrides?: Partial<StepExecutorDeps>): StepExecutorDeps {
      return makeDeps({
        pipeline: AC01_PIPELINE,
        agentContracts: new Map([[AC01Contract.id, AC01Contract]]),
        ...overrides,
      });
    }

    function stubGatewayResponse(content: unknown): void {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ...FAKE_RESPONSE,
            message: { role: 'assistant', content: JSON.stringify(content) },
          }),
        }),
      );
    }

    it('passes clean output through unchanged', async () => {
      stubGatewayResponse({
        status: 'needs_input',
        detail: 'Insufficient data for the literacy domain.',
        insufficientDomains: ['literacy'],
      });
      const executor = createStepExecutor(makeAc01Deps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'screen-learner',
        attempt: 1,
        input: {},
      });
      expect(result).toEqual({
        status: 'needs_input',
        detail: 'Insufficient data for the literacy domain.',
        insufficientDomains: ['literacy'],
      });
    });

    it('throws GuardrailRefusalError when a diagnostic term appears in a declared free-text field', async () => {
      stubGatewayResponse({
        status: 'needs_input',
        detail: 'The learner shows signs of dyslexia in reading tasks.',
        insufficientDomains: ['literacy'],
      });
      const executor = createStepExecutor(makeAc01Deps());
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'screen-learner',
          attempt: 1,
          input: {},
        }),
      ).rejects.toThrow(GuardrailRefusalError);
    });

    it('does not scan a contract that has not declared diagnosis_guard', async () => {
      // CE-01 (mod-01) carries no diagnosis_guard — a diagnostic-sounding word in its
      // output must not be refused by this check.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ...FAKE_RESPONSE,
            message: {
              role: 'assistant',
              content: JSON.stringify({ status: 'ok', framework: { note: 'autism' } }),
            },
          }),
        }),
      );
      const executor = createStepExecutor(makeDeps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'build-topic-graph',
        attempt: 1,
        input: {},
      });
      expect(result).toEqual({ status: 'ok', framework: { note: 'autism' } });
    });
  });

  describe('agent_call readability_guard (AC-10 only)', () => {
    const AC10_PIPELINE: PipelineDefinition = {
      id: 'mod-02-parent-report-test',
      version: '1.0.0',
      entryStepId: 'write-report',
      steps: {
        'write-report': {
          id: 'write-report',
          kind: 'agent_call',
          agentId: 'AC-10',
          next: null,
          timeoutMs: 10_000,
          maxRetries: 0,
          compensatesWith: null,
        },
      },
    };

    function makeAc10Deps(overrides?: Partial<StepExecutorDeps>): StepExecutorDeps {
      return makeDeps({
        pipeline: AC10_PIPELINE,
        agentContracts: new Map([[AC10Contract.id, AC10Contract]]),
        ...overrides,
      });
    }

    function stubGatewayResponse(content: unknown): void {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ...FAKE_RESPONSE,
            message: { role: 'assistant', content: JSON.stringify(content) },
          }),
        }),
      );
    }

    const ADVANCED_TEXT =
      'The extraordinarily sophisticated methodology employed by the ' +
      'interdisciplinary research consortium necessitated a comprehensive ' +
      'reevaluation of previously established administrative frameworks.';

    it('passes when the letter is within targetReadabilityGrade + 1', async () => {
      stubGatewayResponse({
        status: 'written',
        reportId: 'report-1',
        learnerId: 'learner-1',
        termId: 'term-1',
        homeLanguage: 'en',
        reportText: 'The cat sat on the mat.',
        estimatedReadabilityGrade: 2,
        readabilityAdequate: true,
        evidenceIds: ['ev-1'],
      });
      const executor = createStepExecutor(makeAc10Deps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'write-report',
        attempt: 1,
        input: { homeLanguage: 'en', targetReadabilityGrade: 3 },
      });
      expect((result as { reportText: string }).reportText).toBe(
        'The cat sat on the mat.',
      );
    });

    it('throws GuardrailRefusalError when the measured grade exceeds targetReadabilityGrade + 1', async () => {
      stubGatewayResponse({
        status: 'written',
        reportId: 'report-1',
        learnerId: 'learner-1',
        termId: 'term-1',
        homeLanguage: 'en',
        reportText: ADVANCED_TEXT,
        // The agent's own self-report claims it's fine — the independent re-measurement
        // is what actually catches this, not trusting readabilityAdequate at face value.
        estimatedReadabilityGrade: 3,
        readabilityAdequate: true,
        evidenceIds: ['ev-1'],
      });
      const executor = createStepExecutor(makeAc10Deps());
      await expect(
        executor({
          runId: MOCK_RUN_ID,
          stepId: 'write-report',
          attempt: 1,
          input: { homeLanguage: 'en', targetReadabilityGrade: 3 },
        }),
      ).rejects.toThrow(GuardrailRefusalError);
    });

    it('does not check a non-English letter — no validated metric for it', async () => {
      stubGatewayResponse({
        status: 'written',
        reportId: 'report-1',
        learnerId: 'learner-1',
        termId: 'term-1',
        homeLanguage: 'zu',
        reportText: ADVANCED_TEXT,
        estimatedReadabilityGrade: 3,
        readabilityAdequate: true,
        evidenceIds: ['ev-1'],
      });
      const executor = createStepExecutor(makeAc10Deps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'write-report',
        attempt: 1,
        input: { homeLanguage: 'zu', targetReadabilityGrade: 3 },
      });
      expect((result as { reportText: string }).reportText).toBe(ADVANCED_TEXT);
    });

    it('does not check a needs_input result — there is no reportText to measure', async () => {
      stubGatewayResponse({ status: 'needs_input', detail: 'Missing progress summary.' });
      const executor = createStepExecutor(makeAc10Deps());
      const result = await executor({
        runId: MOCK_RUN_ID,
        stepId: 'write-report',
        attempt: 1,
        input: { homeLanguage: 'en', targetReadabilityGrade: 3 },
      });
      expect(result).toEqual({
        status: 'needs_input',
        detail: 'Missing progress summary.',
      });
    });
  });
});
