// Tool handler implementations — called by the StepExecutor for tool_call and
// compensation steps. Each handler is created within a withTenant transaction; the
// TenantClient in the closure satisfies rule 5 at the call site in worker-host.ts.
//
// l0.ingest_ratified_source:
//   Stores a ratified CAPS/ATP source document into L0_CONSTITUTION (the Brain's
//   first tier). L0 candidates await human ratification before committing; the write
//   path records the candidate and leaves it at AWAITING_RATIFICATION.
//
// brain.publish_curriculum_version:
//   Records a curriculum version as published. Irreversible in intent — only reached
//   after the hod-approval human_gate (enforced by validatePipelineGating in tests).
//   Written as an L1_NODE in the curriculum graph; no ratification required.
//
// brain.tombstone_curriculum_version (compensation):
//   Records that a published curriculum version has been rolled back — created by the
//   compensation path if audit-coverage fails after publish. Append-only per rule 11:
//   the original publish record is never modified; a new L1_NODE references it.
//
// MOD-02 / MOD-03 / MOD-04 / MOD-05 / LE (Stage 51):
//   Every remaining tool_call step across the five modules writes to the Brain the same
//   way — the pipelines that reach these tools never touch a bespoke domain table,
//   because the Brain is this system's one durable record of what happened. Two shapes
//   cover all of them:
//     - L2_EPISODE for "this happened" facts (a delivery, a dispatch, a suppression, a
//       retraction) — eventType + summary + detail, the same shape brain.tombstone_* uses
//       conceptually for "the prior fact was undone."
//     - L3_PROCEDURE for versioned procedural artefacts (a promoted challenger prompt, a
//       promoted exemplar, a pattern published to the commons) — kind + ref + content,
//       the same tier brain.publish_curriculum_version's sibling would use for anything
//       that is a procedure rather than an entity or an event.
//   Each handler's input schema is deliberately small — only the fields the pipeline's
//   own step actually needs to record — matching the existing IngestInput/PublishInput/
//   TombstoneInput style rather than re-deriving the upstream agent's full output shape.

import { remember } from '@infinite-ai/brain';
import type { TenantClient } from '@infinite-ai/db';
import { z } from 'zod';

import type { ToolHandlerMap } from './step-executor.js';

const IngestInput = z.object({
  documentId: z.string().min(1),
  documentVersion: z.string().min(1),
  content: z.unknown(),
  source: z.string().min(1),
});

const PublishInput = z.object({
  curriculumRunId: z.string().min(1),
  tenantId: z.string().min(1),
  publishedAt: z.string().datetime().optional(),
});

const TombstoneInput = z.object({
  publishedNodeId: z.string().min(1),
  rollbackReason: z.string().min(1),
});

// ── Shared episode/procedure helpers ─────────────────────────────────────────

/** Fields common to every "this happened" tool. `occurredAt` defaults to now — none of
 * these tools are backdated; a caller replaying history would set it explicitly. */
const EpisodeCommon = {
  occurredAt: z.string().datetime().optional(),
  actorId: z.string().uuid().nullable().default(null),
};

async function recordEpisode(
  tx: TenantClient,
  toolName: string,
  eventType: string,
  fields: {
    readonly subjectNodeId?: string | null;
    readonly actorId: string | null;
    readonly occurredAt?: string | undefined;
    readonly summary: string;
    readonly outcome?: string | null;
    readonly detail: Record<string, unknown>;
  },
): Promise<unknown> {
  return remember(tx, {
    targetTier: 'L2_EPISODE',
    rawPayload: {
      eventType,
      subjectNodeId: fields.subjectNodeId ?? null,
      actorId: fields.actorId,
      occurredAt: fields.occurredAt ?? new Date().toISOString(),
      summary: fields.summary,
      outcome: fields.outcome ?? null,
      detail: fields.detail,
    },
    source: toolName,
  });
}

// ── MOD-02 Support Analytics Centre ──────────────────────────────────────────

const RaiseTier1ImprovementInput = z.object({
  classGroupId: z.string().min(1),
  term: z.string().min(1),
  tier1Rate: z.number().min(0).max(1),
  ...EpisodeCommon,
});

const DeliverInterventionsInput = z.object({
  interventionIds: z.array(z.string().min(1)).min(1),
  ...EpisodeCommon,
});

const RecordInterventionDeliveryInput = z.object({
  interventionIds: z.array(z.string().min(1)).min(1),
  deliveredAt: z.string().datetime().optional(),
  ...EpisodeCommon,
});

const RetractInterventionDeliveryInput = z.object({
  interventionIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1),
  ...EpisodeCommon,
});

const RecordMonitoringOutcomeInput = z.object({
  interventionIds: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
  ...EpisodeCommon,
});

const DispatchParentReportInput = z.object({
  learnerRef: z.string().min(1),
  reportRef: z.string().min(1),
  language: z.string().min(1),
  ...EpisodeCommon,
});

const RecordSbstMinutesInput = z.object({
  meetingRef: z.string().min(1),
  decisions: z.array(z.string().min(1)).default([]),
  actionItems: z.array(z.string().min(1)).default([]),
  ...EpisodeCommon,
});

// ── MOD-03 Data Collection & Warehouse ───────────────────────────────────────

const UpdateFeatureStoreInput = z.object({
  learnerRefs: z.array(z.string().min(1)).min(1),
  features: z.record(z.unknown()).default({}),
  ...EpisodeCommon,
});

const RecordLearnerInsightInput = z.object({
  insightRef: z.string().min(1),
  scope: z.enum(['learner', 'class', 'grade', 'school']),
  summary: z.string().min(1),
  ...EpisodeCommon,
});

// ── MOD-04 Teaching & Learning Toolbox ───────────────────────────────────────

const DraftArtefactInput = z.object({
  artefactRef: z.string().min(1),
  artefactType: z.string().min(1),
  ...EpisodeCommon,
});

const DeliverArtefactInput = z.object({
  artefactRef: z.string().min(1),
  deliveredTo: z.string().min(1),
  ...EpisodeCommon,
});

const CaptureEditSignalInput = z.object({
  artefactRef: z.string().min(1),
  editSummary: z.string().min(1),
  ...EpisodeCommon,
});

const VoidDraftInput = z.object({
  artefactRef: z.string().min(1),
  reason: z.string().min(1),
  ...EpisodeCommon,
});

const VoidDeliveryInput = z.object({
  artefactRef: z.string().min(1),
  reason: z.string().min(1),
  ...EpisodeCommon,
});

// ── MOD-05 Teaching Analytics & PD Studio ────────────────────────────────────

const RecordSuppressionInput = z.object({
  cohortRef: z.string().min(1),
  cohortSize: z.number().int().min(0),
  ...EpisodeCommon,
});

const DeliverPdInterventionInput = z.object({
  interventionRef: z.string().min(1),
  deliveredTo: z.string().min(1),
  ...EpisodeCommon,
});

const RecordPdInterventionInput = z.object({
  interventionRef: z.string().min(1),
  summary: z.string().min(1),
  ...EpisodeCommon,
});

const RetractPdInterventionInput = z.object({
  interventionRef: z.string().min(1),
  reason: z.string().min(1),
  ...EpisodeCommon,
});

const RecordCptdActivityInput = z.object({
  teacherRef: z.string().min(1),
  activityRef: z.string().min(1),
  points: z.number().min(0),
  activityType: z.enum([
    'type_1_teacher_initiated',
    'type_2_school_initiated',
    'type_3_externally_initiated',
  ]),
  ...EpisodeCommon,
});

// ── LE Learning Engine ────────────────────────────────────────────────────────

const PromoteChallengerPromptInput = z.object({
  agentId: z.string().min(1),
  challengerVersion: z.string().min(1),
  promptDiff: z.unknown(),
});

const PromoteExemplarInput = z.object({
  candidateId: z.string().min(1),
  agentId: z.string().min(1),
  exemplarScore: z.number().min(0).max(1),
});

const RecordCommonsPublishBlockedInput = z.object({
  patternId: z.string().min(1),
  reason: z.enum(['no_opt_in', 'below_threshold']),
  ...EpisodeCommon,
});

const PublishToCommonsInput = z.object({
  patternId: z.string().min(1),
  contributingTenantCount: z.number().int().min(0),
});

/** Creates the tool handler map for one pipeline job's transaction scope.
 * The transaction is held open for the job by withTenant in worker-host.ts. */
export function createToolHandlers(tx: TenantClient): ToolHandlerMap {
  const handlers = new Map<string, (input: unknown) => Promise<unknown>>();

  handlers.set(
    'l0.ingest_ratified_source',
    async (rawInput: unknown): Promise<unknown> => {
      const input = IngestInput.parse(rawInput);
      return remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          documentId: input.documentId,
          documentVersion: input.documentVersion,
          content: input.content,
        },
        source: input.source,
      });
    },
  );

  handlers.set(
    'brain.publish_curriculum_version',
    async (rawInput: unknown): Promise<unknown> => {
      const input = PublishInput.parse(rawInput);
      const publishedAt = input.publishedAt ?? new Date().toISOString();
      return remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          kind: 'curriculum_version',
          status: 'published',
          curriculumRunId: input.curriculumRunId,
          tenantId: input.tenantId,
          publishedAt,
        },
        source: 'brain.publish_curriculum_version',
      });
    },
  );

  handlers.set(
    'brain.tombstone_curriculum_version',
    async (rawInput: unknown): Promise<unknown> => {
      const input = TombstoneInput.parse(rawInput);
      // Append-only record that invalidates the published version (rule 11). The original
      // publish node is never modified; this new node references it as superseded.
      return remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          kind: 'curriculum_version',
          status: 'rolled_back',
          supersedes: input.publishedNodeId,
          rollbackReason: input.rollbackReason,
          rolledBackAt: new Date().toISOString(),
        },
        source: 'brain.tombstone_curriculum_version',
      });
    },
  );

  // ── MOD-02 ──────────────────────────────────────────────────────────────

  handlers.set('support.raise_tier1_improvement', async (rawInput: unknown) => {
    const input = RaiseTier1ImprovementInput.parse(rawInput);
    return recordEpisode(
      tx,
      'support.raise_tier1_improvement',
      'tier1_improvement_raised',
      {
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        summary: `Tier 1 improvement task raised for class ${input.classGroupId}, term ${input.term}`,
        detail: {
          classGroupId: input.classGroupId,
          term: input.term,
          tier1Rate: input.tier1Rate,
        },
      },
    );
  });

  handlers.set('support.deliver_interventions', async (rawInput: unknown) => {
    const input = DeliverInterventionsInput.parse(rawInput);
    return recordEpisode(tx, 'support.deliver_interventions', 'interventions_delivered', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `${input.interventionIds.length} intervention plan(s) delivered to educators`,
      detail: { interventionIds: input.interventionIds },
    });
  });

  handlers.set('brain.record_intervention_delivery', async (rawInput: unknown) => {
    const input = RecordInterventionDeliveryInput.parse(rawInput);
    return recordEpisode(
      tx,
      'brain.record_intervention_delivery',
      'intervention_delivery_recorded',
      {
        actorId: input.actorId,
        occurredAt: input.deliveredAt ?? input.occurredAt,
        summary: `Delivery recorded for ${input.interventionIds.length} intervention plan(s)`,
        detail: { interventionIds: input.interventionIds },
      },
    );
  });

  handlers.set('support.retract_intervention_delivery', async (rawInput: unknown) => {
    const input = RetractInterventionDeliveryInput.parse(rawInput);
    return recordEpisode(
      tx,
      'support.retract_intervention_delivery',
      'intervention_delivery_retracted',
      {
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        summary: `Delivery retracted for ${input.interventionIds.length} intervention plan(s): ${input.reason}`,
        outcome: input.reason,
        detail: { interventionIds: input.interventionIds, reason: input.reason },
      },
    );
  });

  handlers.set('brain.record_monitoring_outcome', async (rawInput: unknown) => {
    const input = RecordMonitoringOutcomeInput.parse(rawInput);
    return recordEpisode(
      tx,
      'brain.record_monitoring_outcome',
      'monitoring_outcome_recorded',
      {
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        summary: input.summary,
        detail: { interventionIds: input.interventionIds },
      },
    );
  });

  handlers.set('support.dispatch_parent_report', async (rawInput: unknown) => {
    const input = DispatchParentReportInput.parse(rawInput);
    return recordEpisode(
      tx,
      'support.dispatch_parent_report',
      'parent_report_dispatched',
      {
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        summary: `Parent progress report dispatched for learner ${input.learnerRef} (${input.language})`,
        detail: {
          learnerRef: input.learnerRef,
          reportRef: input.reportRef,
          language: input.language,
        },
      },
    );
  });

  handlers.set('brain.record_sbst_minutes', async (rawInput: unknown) => {
    const input = RecordSbstMinutesInput.parse(rawInput);
    return recordEpisode(tx, 'brain.record_sbst_minutes', 'sbst_minutes_recorded', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `SBST minutes ratified for meeting ${input.meetingRef}`,
      detail: {
        meetingRef: input.meetingRef,
        decisions: input.decisions,
        actionItems: input.actionItems,
      },
    });
  });

  // ── MOD-03 ──────────────────────────────────────────────────────────────

  handlers.set('warehouse.update_feature_store', async (rawInput: unknown) => {
    const input = UpdateFeatureStoreInput.parse(rawInput);
    return recordEpisode(tx, 'warehouse.update_feature_store', 'feature_store_updated', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Feature store updated for ${input.learnerRefs.length} learner(s)`,
      detail: { learnerRefs: input.learnerRefs, features: input.features },
    });
  });

  handlers.set('brain.record_learner_insight', async (rawInput: unknown) => {
    const input = RecordLearnerInsightInput.parse(rawInput);
    return recordEpisode(tx, 'brain.record_learner_insight', 'learner_insight_recorded', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: input.summary,
      detail: { insightRef: input.insightRef, scope: input.scope },
    });
  });

  // ── MOD-04 ──────────────────────────────────────────────────────────────

  handlers.set('toolbox.draft_artefact', async (rawInput: unknown) => {
    const input = DraftArtefactInput.parse(rawInput);
    return recordEpisode(tx, 'toolbox.draft_artefact', 'artefact_drafted', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Draft artefact ${input.artefactRef} (${input.artefactType}) created`,
      detail: { artefactRef: input.artefactRef, artefactType: input.artefactType },
    });
  });

  handlers.set('toolbox.deliver_artefact', async (rawInput: unknown) => {
    const input = DeliverArtefactInput.parse(rawInput);
    return recordEpisode(tx, 'toolbox.deliver_artefact', 'artefact_delivered', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Artefact ${input.artefactRef} delivered to ${input.deliveredTo}`,
      detail: { artefactRef: input.artefactRef, deliveredTo: input.deliveredTo },
    });
  });

  handlers.set('toolbox.capture_edit_signal', async (rawInput: unknown) => {
    const input = CaptureEditSignalInput.parse(rawInput);
    return recordEpisode(tx, 'toolbox.capture_edit_signal', 'artefact_edit_captured', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Edit signal captured for artefact ${input.artefactRef}`,
      detail: { artefactRef: input.artefactRef, editSummary: input.editSummary },
    });
  });

  handlers.set('toolbox.void_draft', async (rawInput: unknown) => {
    const input = VoidDraftInput.parse(rawInput);
    return recordEpisode(tx, 'toolbox.void_draft', 'artefact_draft_voided', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Draft artefact ${input.artefactRef} voided: ${input.reason}`,
      outcome: input.reason,
      detail: { artefactRef: input.artefactRef, reason: input.reason },
    });
  });

  handlers.set('toolbox.void_delivery', async (rawInput: unknown) => {
    const input = VoidDeliveryInput.parse(rawInput);
    return recordEpisode(tx, 'toolbox.void_delivery', 'artefact_delivery_voided', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `Delivery of artefact ${input.artefactRef} voided: ${input.reason}`,
      outcome: input.reason,
      detail: { artefactRef: input.artefactRef, reason: input.reason },
    });
  });

  // ── MOD-05 ──────────────────────────────────────────────────────────────

  handlers.set('pd.record_suppression', async (rawInput: unknown) => {
    const input = RecordSuppressionInput.parse(rawInput);
    return recordEpisode(tx, 'pd.record_suppression', 'pd_cohort_suppressed', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `PD cohort ${input.cohortRef} suppressed (size ${input.cohortSize} below threshold)`,
      detail: { cohortRef: input.cohortRef, cohortSize: input.cohortSize },
    });
  });

  handlers.set('pd.deliver_pd_intervention', async (rawInput: unknown) => {
    const input = DeliverPdInterventionInput.parse(rawInput);
    return recordEpisode(tx, 'pd.deliver_pd_intervention', 'pd_intervention_delivered', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `PD intervention ${input.interventionRef} delivered to ${input.deliveredTo}`,
      detail: { interventionRef: input.interventionRef, deliveredTo: input.deliveredTo },
    });
  });

  handlers.set('brain.record_pd_intervention', async (rawInput: unknown) => {
    const input = RecordPdInterventionInput.parse(rawInput);
    return recordEpisode(tx, 'brain.record_pd_intervention', 'pd_intervention_recorded', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: input.summary,
      detail: { interventionRef: input.interventionRef },
    });
  });

  handlers.set('pd.retract_pd_intervention', async (rawInput: unknown) => {
    const input = RetractPdInterventionInput.parse(rawInput);
    return recordEpisode(tx, 'pd.retract_pd_intervention', 'pd_intervention_retracted', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `PD intervention ${input.interventionRef} retracted: ${input.reason}`,
      outcome: input.reason,
      detail: { interventionRef: input.interventionRef, reason: input.reason },
    });
  });

  handlers.set('brain.record_cptd_activity', async (rawInput: unknown) => {
    const input = RecordCptdActivityInput.parse(rawInput);
    return recordEpisode(tx, 'brain.record_cptd_activity', 'cptd_activity_recorded', {
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      summary: `${input.points} CPTD point(s) recorded for teacher ${input.teacherRef} (${input.activityType})`,
      detail: {
        teacherRef: input.teacherRef,
        activityRef: input.activityRef,
        points: input.points,
        activityType: input.activityType,
      },
    });
  });

  // ── LE ──────────────────────────────────────────────────────────────────

  handlers.set('brain.promote_challenger_prompt', async (rawInput: unknown) => {
    const input = PromoteChallengerPromptInput.parse(rawInput);
    // Reversible via packages/learning's promotion-log rollback command, not DAG
    // compensation — see packages/orchestrator/src/pipelines/le.ts's own header.
    return remember(tx, {
      targetTier: 'L3_PROCEDURE',
      rawPayload: {
        kind: 'PROMPT_VERSION',
        ref: `${input.agentId}@${input.challengerVersion}`,
        content: { agentId: input.agentId, promptDiff: input.promptDiff },
      },
      source: 'brain.promote_challenger_prompt',
    });
  });

  handlers.set('brain.promote_exemplar', async (rawInput: unknown) => {
    const input = PromoteExemplarInput.parse(rawInput);
    return remember(tx, {
      targetTier: 'L3_PROCEDURE',
      rawPayload: {
        kind: 'EXEMPLAR',
        ref: input.candidateId,
        content: { agentId: input.agentId, exemplarScore: input.exemplarScore },
      },
      source: 'brain.promote_exemplar',
    });
  });

  handlers.set('learning.record_commons_publish_blocked', async (rawInput: unknown) => {
    const input = RecordCommonsPublishBlockedInput.parse(rawInput);
    return recordEpisode(
      tx,
      'learning.record_commons_publish_blocked',
      'commons_publish_blocked',
      {
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        summary: `Commons publication blocked for pattern ${input.patternId}: ${input.reason}`,
        outcome: input.reason,
        detail: { patternId: input.patternId, reason: input.reason },
      },
    );
  });

  handlers.set('learning.publish_to_commons', async (rawInput: unknown) => {
    const input = PublishToCommonsInput.parse(rawInput);
    return remember(tx, {
      targetTier: 'L3_PROCEDURE',
      rawPayload: {
        kind: 'SOP',
        ref: input.patternId,
        content: { contributingTenantCount: input.contributingTenantCount },
      },
      source: 'learning.publish_to_commons',
    });
  });

  return handlers;
}
