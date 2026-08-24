// Unit tests for the step executor — the dispatch layer between the orchestrator runner
// and real agent/tool work. Tests mock fetch and the prompts loader to exercise the
// routing logic without network or file-system dependencies.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CE01Contract } from '@infinite-ai/agents';
import { MOD01_CURRICULUM_PIPELINE } from '@infinite-ai/orchestrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
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
});
