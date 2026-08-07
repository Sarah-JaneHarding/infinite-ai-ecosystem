// MOD-01 Curriculum Engine pipeline — Stage 08 step 4.
//
// CAPS + ATP ingest → topic graph → term plan → unit blueprint →
// lesson set + differentiation → assessment + rubric + memo →
// ◆ HoD approval → publish + version to Brain → coverage audit
//
// Structural invariant enforced here: validatePipelineDag runs at module load,
// so a mis-wired reference or cycle is caught at startup, not at run time.
// validatePipelineGating is NOT called here — it requires knowing which tools are
// irreversible (brain.publish_curriculum_version), which is a deployment-level
// concern; the pipeline spec tests enforce it instead.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

const definition = {
  id: 'mod-01-curriculum',
  version: '1.0.0',
  entryStepId: 'ingest-caps-atp',
  steps: {
    // ── Stage 1: ingest and ground ────────────────────────────────────────────
    'ingest-caps-atp': {
      id: 'ingest-caps-atp',
      kind: 'tool_call' as const,
      toolName: 'l0.ingest_ratified_source',
      timeoutMs: 120_000,
      maxRetries: 3,
      compensatesWith: null,
      next: 'build-topic-graph',
    },
    'build-topic-graph': {
      id: 'build-topic-graph',
      kind: 'agent_call' as const,
      agentId: 'CE-01',
      timeoutMs: 180_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'sequence-atp',
    },
    'sequence-atp': {
      id: 'sequence-atp',
      kind: 'agent_call' as const,
      agentId: 'CE-02',
      timeoutMs: 180_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'plan-term',
    },
    // ── Stage 2: plan ─────────────────────────────────────────────────────────
    'plan-term': {
      id: 'plan-term',
      kind: 'agent_call' as const,
      agentId: 'CE-03',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'architect-units',
    },
    // map over content areas — one CE-04 call per area
    'architect-units': {
      id: 'architect-units',
      kind: 'map' as const,
      itemStepId: 'architect-unit-item',
      collectionField: 'contentAreas',
      timeoutMs: 1_800_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'generate-lessons',
    },
    'architect-unit-item': {
      id: 'architect-unit-item',
      kind: 'agent_call' as const,
      agentId: 'CE-04',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 3: lessons and differentiation ─────────────────────────────────
    // map over units — one CE-05 call per unit
    'generate-lessons': {
      id: 'generate-lessons',
      kind: 'map' as const,
      itemStepId: 'generate-lesson-item',
      collectionField: 'units',
      timeoutMs: 3_600_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'differentiate-lessons',
    },
    'generate-lesson-item': {
      id: 'generate-lesson-item',
      kind: 'agent_call' as const,
      agentId: 'CE-05',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // map over lesson plans — one CE-08 call per lesson plan
    'differentiate-lessons': {
      id: 'differentiate-lessons',
      kind: 'map' as const,
      itemStepId: 'differentiate-lesson-item',
      collectionField: 'lessonPlans',
      timeoutMs: 3_600_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'design-assessments',
    },
    'differentiate-lesson-item': {
      id: 'differentiate-lesson-item',
      kind: 'agent_call' as const,
      agentId: 'CE-08',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 4: assessment and rubric ────────────────────────────────────────
    // map over units — one CE-06 call per unit
    'design-assessments': {
      id: 'design-assessments',
      kind: 'map' as const,
      itemStepId: 'design-assessment-item',
      collectionField: 'units',
      timeoutMs: 1_800_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'build-rubrics',
    },
    'design-assessment-item': {
      id: 'design-assessment-item',
      kind: 'agent_call' as const,
      agentId: 'CE-06',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // map over assessment tasks — one CE-07 call per task
    'build-rubrics': {
      id: 'build-rubrics',
      kind: 'map' as const,
      itemStepId: 'build-rubric-item',
      collectionField: 'assessmentTasks',
      timeoutMs: 1_800_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'hod-approval',
    },
    'build-rubric-item': {
      id: 'build-rubric-item',
      kind: 'agent_call' as const,
      agentId: 'CE-07',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 5: HoD gate → publish → audit ──────────────────────────────────
    // 7-day window for the HoD to review and approve the complete package
    'hod-approval': {
      id: 'hod-approval',
      kind: 'human_gate' as const,
      requiredRole: 'hod',
      timeoutMs: 604_800_000,
      maxRetries: 0,
      compensatesWith: null,
      next: 'publish-to-brain',
    },
    // brain.publish_curriculum_version is irreversible — must never be reached
    // without a human_gate in front of it (enforced by validatePipelineGating in tests)
    'publish-to-brain': {
      id: 'publish-to-brain',
      kind: 'tool_call' as const,
      toolName: 'brain.publish_curriculum_version',
      timeoutMs: 60_000,
      maxRetries: 0,
      compensatesWith: 'compensate-publish',
      next: 'audit-coverage',
    },
    'audit-coverage': {
      id: 'audit-coverage',
      kind: 'agent_call' as const,
      agentId: 'CE-09',
      timeoutMs: 300_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Compensation ──────────────────────────────────────────────────────────
    // Tombstones the Brain record if publish succeeds but a later step fails.
    // The Brain is append-only — tombstone is a new record, not a delete.
    'compensate-publish': {
      id: 'compensate-publish',
      kind: 'compensation' as const,
      compensatesStepId: 'publish-to-brain',
      agentId: null,
      toolName: 'brain.tombstone_curriculum_version',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
    },
  },
};

export const MOD01_CURRICULUM_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(definition);

// Fail fast at startup — a mis-wired reference or forward cycle is a deployment error.
validatePipelineDag(MOD01_CURRICULUM_PIPELINE);
