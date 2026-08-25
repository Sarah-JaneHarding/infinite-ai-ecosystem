// Unit tests for createToolHandlers — Stage 51.
// `remember` (brain) is mocked so no database is needed; these tests verify each handler
// parses its input correctly and calls `remember` with the right target tier and shape.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@infinite-ai/brain', () => ({
  remember: vi.fn(),
}));

import { remember } from '@infinite-ai/brain';
import type { TenantClient } from '@infinite-ai/db';

import { createToolHandlers } from '../src/tool-handlers.js';

const mockRemember = vi.mocked(remember);
const fakeTx = {} as TenantClient;

const ALL_TOOL_NAMES = [
  'l0.ingest_ratified_source',
  'brain.publish_curriculum_version',
  'brain.tombstone_curriculum_version',
  'support.raise_tier1_improvement',
  'support.deliver_interventions',
  'brain.record_intervention_delivery',
  'support.retract_intervention_delivery',
  'brain.record_monitoring_outcome',
  'support.dispatch_parent_report',
  'brain.record_sbst_minutes',
  'warehouse.update_feature_store',
  'brain.record_learner_insight',
  'toolbox.draft_artefact',
  'toolbox.deliver_artefact',
  'toolbox.capture_edit_signal',
  'toolbox.void_draft',
  'toolbox.void_delivery',
  'pd.record_suppression',
  'pd.deliver_pd_intervention',
  'brain.record_pd_intervention',
  'pd.retract_pd_intervention',
  'brain.record_cptd_activity',
  'brain.promote_challenger_prompt',
  'brain.promote_exemplar',
  'learning.record_commons_publish_blocked',
  'learning.publish_to_commons',
];

describe('createToolHandlers', () => {
  beforeEach(() => {
    mockRemember.mockReset();
    mockRemember.mockResolvedValue({ id: 'fact-1' } as never);
  });

  it('registers exactly one handler for every tool name referenced by a pipeline', () => {
    const handlers = createToolHandlers(fakeTx);
    expect(handlers.size).toBe(ALL_TOOL_NAMES.length);
    for (const name of ALL_TOOL_NAMES) {
      expect(handlers.has(name), `expected a handler for "${name}"`).toBe(true);
    }
  });

  describe('support.deliver_interventions', () => {
    it('records an L2_EPISODE with the delivered intervention ids', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('support.deliver_interventions')!;

      await handler({ interventionIds: ['int-1', 'int-2'] });

      expect(mockRemember).toHaveBeenCalledOnce();
      const [tx, input] = mockRemember.mock.calls[0]!;
      expect(tx).toBe(fakeTx);
      expect(input.targetTier).toBe('L2_EPISODE');
      const payload = input.rawPayload as Record<string, unknown>;
      expect(payload['eventType']).toBe('interventions_delivered');
      expect((payload['detail'] as Record<string, unknown>)['interventionIds']).toEqual([
        'int-1',
        'int-2',
      ]);
    });

    it('rejects an empty interventionIds array', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('support.deliver_interventions')!;

      await expect(handler({ interventionIds: [] })).rejects.toThrow();
      expect(mockRemember).not.toHaveBeenCalled();
    });
  });

  describe('brain.promote_challenger_prompt', () => {
    it('records an L3_PROCEDURE with kind PROMPT_VERSION', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('brain.promote_challenger_prompt')!;

      await handler({
        agentId: 'CE-05',
        challengerVersion: '1.1.0',
        promptDiff: { a: 1 },
      });

      expect(mockRemember).toHaveBeenCalledOnce();
      const [, input] = mockRemember.mock.calls[0]!;
      expect(input.targetTier).toBe('L3_PROCEDURE');
      const payload = input.rawPayload as Record<string, unknown>;
      expect(payload['kind']).toBe('PROMPT_VERSION');
      expect(payload['ref']).toBe('CE-05@1.1.0');
    });

    it('rejects a missing agentId', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('brain.promote_challenger_prompt')!;

      await expect(
        handler({ challengerVersion: '1.1.0', promptDiff: {} }),
      ).rejects.toThrow();
      expect(mockRemember).not.toHaveBeenCalled();
    });
  });

  describe('learning.publish_to_commons', () => {
    it('records an L3_PROCEDURE with kind SOP', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('learning.publish_to_commons')!;

      await handler({ patternId: 'pattern-9', contributingTenantCount: 7 });

      expect(mockRemember).toHaveBeenCalledOnce();
      const [, input] = mockRemember.mock.calls[0]!;
      expect(input.targetTier).toBe('L3_PROCEDURE');
      const payload = input.rawPayload as Record<string, unknown>;
      expect(payload['kind']).toBe('SOP');
      expect(payload['ref']).toBe('pattern-9');
    });
  });

  describe('learning.record_commons_publish_blocked', () => {
    it('records an L2_EPISODE with the block reason as outcome', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('learning.record_commons_publish_blocked')!;

      await handler({ patternId: 'pattern-9', reason: 'below_threshold' });

      const [, input] = mockRemember.mock.calls[0]!;
      const payload = input.rawPayload as Record<string, unknown>;
      expect(payload['eventType']).toBe('commons_publish_blocked');
      expect(payload['outcome']).toBe('below_threshold');
    });

    it('rejects a reason outside the enum', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('learning.record_commons_publish_blocked')!;

      await expect(
        handler({ patternId: 'pattern-9', reason: 'not_a_real_reason' }),
      ).rejects.toThrow();
    });
  });

  describe('brain.record_cptd_activity', () => {
    it('records an L2_EPISODE carrying the points and activity type', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('brain.record_cptd_activity')!;

      await handler({
        teacherRef: 'teacher-1',
        activityRef: 'activity-1',
        points: 10,
        activityType: 'type_1_teacher_initiated',
      });

      const [, input] = mockRemember.mock.calls[0]!;
      expect(input.targetTier).toBe('L2_EPISODE');
      const detail = (input.rawPayload as Record<string, unknown>)['detail'] as Record<
        string,
        unknown
      >;
      expect(detail['points']).toBe(10);
      expect(detail['activityType']).toBe('type_1_teacher_initiated');
    });

    it('rejects a negative points value', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('brain.record_cptd_activity')!;

      await expect(
        handler({
          teacherRef: 'teacher-1',
          activityRef: 'activity-1',
          points: -5,
          activityType: 'type_1_teacher_initiated',
        }),
      ).rejects.toThrow();
    });
  });

  describe('toolbox.void_draft (compensation)', () => {
    it('records an L2_EPISODE with the void reason as both outcome and detail', async () => {
      const handlers = createToolHandlers(fakeTx);
      const handler = handlers.get('toolbox.void_draft')!;

      await handler({ artefactRef: 'artefact-1', reason: 'schema mismatch' });

      const [, input] = mockRemember.mock.calls[0]!;
      const payload = input.rawPayload as Record<string, unknown>;
      expect(payload['eventType']).toBe('artefact_draft_voided');
      expect(payload['outcome']).toBe('schema mismatch');
    });
  });
});
