// MOD-04 Teaching & Learning Toolbox pipeline — Stage 11 step 7.
//
// Teacher request → draft artefact → ◆ teacher approval → deliver → capture edit signal
//
// The pipeline is generic across all eleven TB agents: `draft-artefact` dispatches to the
// right agent through `toolbox.draft_artefact` (which reads `agentId` from the run input)
// rather than hard-coding an `agent_call` step. One pipeline definition covers every
// toolbox output rather than eleven per-agent variants.
//
// `toolbox.deliver_artefact` is irreversible (artefact visible to teacher/learner once
// delivered). validatePipelineGating in the test suite asserts that it is only ever
// reachable through the teacher-approval human gate — never directly.
//
// Structural integrity: validatePipelineDag runs at module load, so a mis-wired
// reference or forward cycle is a deployment error, not a runtime surprise.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

const definition = {
  id: 'mod-04-toolbox',
  version: '1.0.0',
  entryStepId: 'draft-artefact',
  steps: {
    // ── Stage 1: draft ────────────────────────────────────────────────────────
    // toolbox.draft_artefact reads agentId from the run input and dispatches to
    // the appropriate TB agent (TB-01 through TB-11).
    'draft-artefact': {
      id: 'draft-artefact',
      kind: 'tool_call' as const,
      toolName: 'toolbox.draft_artefact',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: 'compensate-draft',
      next: 'teacher-approval',
    },
    // ── Stage 2: teacher gate ─────────────────────────────────────────────────
    // 7-day window for the teacher to review. On approval (with or without edits)
    // the pipeline continues to deliver-artefact. On rejection the run fails and
    // the compensation chain voids the draft.
    'teacher-approval': {
      id: 'teacher-approval',
      kind: 'human_gate' as const,
      requiredRole: 'teacher',
      timeoutMs: 604_800_000, // 7 days in ms
      maxRetries: 0,
      compensatesWith: null,
      next: 'deliver-artefact',
    },
    // ── Stage 3: deliver → capture ────────────────────────────────────────────
    // toolbox.deliver_artefact marks the artefact as approved and delivers it to
    // the teacher's UI. Irreversible — must only be reached through teacher-approval.
    'deliver-artefact': {
      id: 'deliver-artefact',
      kind: 'tool_call' as const,
      toolName: 'toolbox.deliver_artefact',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: 'compensate-deliver',
      next: 'capture-edit-signal',
    },
    // toolbox.capture_edit_signal writes a TeacherEditSignal to the Brain when the
    // approval outcome was EDITED; it is a no-op for plain APPROVED outcomes. Brain
    // writes are append-only — no compensation is possible or needed.
    'capture-edit-signal': {
      id: 'capture-edit-signal',
      kind: 'tool_call' as const,
      toolName: 'toolbox.capture_edit_signal',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // ── Compensation ──────────────────────────────────────────────────────────
    // Soft-deletes the draft record if drafting succeeded but a later step fails
    // before the artefact is delivered.
    'compensate-draft': {
      id: 'compensate-draft',
      kind: 'compensation' as const,
      compensatesStepId: 'draft-artefact',
      agentId: null,
      toolName: 'toolbox.void_draft',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
    },
    // Creates a retraction record if delivery succeeded but capture-edit-signal
    // fails terminally. The delivered artefact cannot be un-sent; the retraction
    // is a new append-only event, not a deletion.
    'compensate-deliver': {
      id: 'compensate-deliver',
      kind: 'compensation' as const,
      compensatesStepId: 'deliver-artefact',
      agentId: null,
      toolName: 'toolbox.void_delivery',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
    },
  },
};

export const MOD04_TOOLBOX_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(definition);

// Fail fast at startup — a mis-wired reference or forward cycle is a deployment error.
validatePipelineDag(MOD04_TOOLBOX_PIPELINE);
