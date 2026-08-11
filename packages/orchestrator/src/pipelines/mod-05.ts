// MOD-05 Teaching Analytics & PD Studio pipelines — Stage 12 step 5.
//
// Two pipelines share this module:
//
// MOD05_PD_ANALYSIS_PIPELINE — the main PD workflow:
//   collect signals → aggregate (PD-04, with cohort suppression) →
//   detect gaps (PD-05) → compose intervention (PD-06 or PD-07) →
//   ◆ HoD approval → deliver → record to Brain
//
// MOD05_CPTD_PIPELINE — triggered when a teacher records a completed CPD activity:
//   compute CPTD points (PD-08) → record to Brain
//
// Cohort suppression: PD-04 returns { status: "suppressed" } when cohortSize < 5.
// The branch-on-suppression step short-circuits to pd.record_suppression, which
// writes a suppression record (append-only) so the run is auditable without producing
// a need profile. No personal data leaves the suppression path.
//
// No-ranking invariant: PD agents never emit rank, percentile or ordinal fields.
// The pipeline never adds them either — nothing in this file assigns a ranking.
//
// Structural integrity: validatePipelineDag runs at module load on both pipelines.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOD-05 PD Analysis pipeline
// ─────────────────────────────────────────────────────────────────────────────

const pdAnalysisDefinition = {
  id: 'mod-05-pd-analysis',
  version: '1.0.0',
  entryStepId: 'aggregate-signals',
  steps: {
    // ── Stage 1: aggregate ────────────────────────────────────────────────────
    // PD-04 reads all TeachingSignal types at once and returns a NeedProfile or
    // a CohortSuppressionResult when cohortSize < MINIMUM_COHORT_SIZE (5).
    'aggregate-signals': {
      id: 'aggregate-signals',
      kind: 'agent_call' as const,
      agentId: 'PD-04',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'branch-on-suppression',
    },
    // ── Branch: suppressed vs. actionable ────────────────────────────────────
    // Condition "pd.is_suppressed" evaluates PD-04's output.status === "suppressed".
    // The runner's ConditionEvaluator injects this check — no business logic here.
    'branch-on-suppression': {
      id: 'branch-on-suppression',
      kind: 'branch' as const,
      condition: 'pd.is_suppressed',
      timeoutMs: 5_000,
      maxRetries: 0,
      compensatesWith: null,
      onTrue: 'record-suppression',
      onFalse: 'detect-gaps',
    },
    // ── Suppression path ─────────────────────────────────────────────────────
    // Writes an append-only suppression record to the Brain. No PII, no ranking.
    'record-suppression': {
      id: 'record-suppression',
      kind: 'tool_call' as const,
      toolName: 'pd.record_suppression',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 2: gap detection ────────────────────────────────────────────────
    // PD-05 converts the NeedProfile into prioritised, intervention-typed gaps.
    'detect-gaps': {
      id: 'detect-gaps',
      kind: 'agent_call' as const,
      agentId: 'PD-05',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'branch-on-intervention',
    },
    // ── Branch: micro-course vs coaching ─────────────────────────────────────
    // Condition "pd.needs_micro_course" evaluates whether the highest-priority gap's
    // interventionType is "micro_course". Coaching is the alternative path.
    'branch-on-intervention': {
      id: 'branch-on-intervention',
      kind: 'branch' as const,
      condition: 'pd.needs_micro_course',
      timeoutMs: 5_000,
      maxRetries: 0,
      compensatesWith: null,
      onTrue: 'compose-micro-courses',
      onFalse: 'compose-coaching-plan',
    },
    // ── Stage 3a: micro-course path ───────────────────────────────────────────
    // Map over the gaps collection — one PD-06 call per gap that needs a micro-course.
    'compose-micro-courses': {
      id: 'compose-micro-courses',
      kind: 'map' as const,
      itemStepId: 'compose-micro-course-item',
      collectionField: 'gaps',
      timeoutMs: 600_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'hod-approval',
    },
    'compose-micro-course-item': {
      id: 'compose-micro-course-item',
      kind: 'agent_call' as const,
      agentId: 'PD-06',
      timeoutMs: 180_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 3b: coaching path ───────────────────────────────────────────────
    // PD-07 produces a multi-session coaching plan covering all coaching-flagged gaps.
    'compose-coaching-plan': {
      id: 'compose-coaching-plan',
      kind: 'agent_call' as const,
      agentId: 'PD-07',
      timeoutMs: 180_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'hod-approval',
    },
    // ── Stage 4: HoD gate → deliver → record ─────────────────────────────────
    // 7-day window for the HoD to review the PD recommendation before it reaches
    // teachers. pd.deliver_pd_intervention is irreversible once a teacher has seen
    // the material; validatePipelineGating in the test suite asserts it is only
    // reachable through this gate.
    'hod-approval': {
      id: 'hod-approval',
      kind: 'human_gate' as const,
      requiredRole: 'hod',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'deliver-pd-intervention',
    },
    // Irreversible — must only be reached through hod-approval (enforced in tests).
    'deliver-pd-intervention': {
      id: 'deliver-pd-intervention',
      kind: 'tool_call' as const,
      toolName: 'pd.deliver_pd_intervention',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: 'compensate-deliver',
      next: 'record-to-brain',
    },
    // Append-only Brain write — no compensation is possible or needed.
    'record-to-brain': {
      id: 'record-to-brain',
      kind: 'tool_call' as const,
      toolName: 'brain.record_pd_intervention',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // ── Compensation ──────────────────────────────────────────────────────────
    // Creates a retraction record if delivery succeeded but record-to-brain fails
    // terminally. The Brain is append-only — retraction is a new event, not a delete.
    'compensate-deliver': {
      id: 'compensate-deliver',
      kind: 'compensation' as const,
      compensatesStepId: 'deliver-pd-intervention',
      agentId: null,
      toolName: 'pd.retract_pd_intervention',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
    },
  },
};

export const MOD05_PD_ANALYSIS_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(pdAnalysisDefinition);

validatePipelineDag(MOD05_PD_ANALYSIS_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// MOD-05 CPTD pipeline
// ─────────────────────────────────────────────────────────────────────────────

const cptdDefinition = {
  id: 'mod-05-cptd',
  version: '1.0.0',
  entryStepId: 'compute-cptd',
  steps: {
    // ── Compute CPTD points ───────────────────────────────────────────────────
    // PD-08 reads the activity description and matches it to a CPTD policy clause.
    // It never invents point values — all points come from cited policy text.
    'compute-cptd': {
      id: 'compute-cptd',
      kind: 'agent_call' as const,
      agentId: 'PD-08',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'record-cptd',
    },
    // Append-only Brain write — CPTD records may not be deleted, only superseded
    // via the tombstone path if an error is discovered later.
    'record-cptd': {
      id: 'record-cptd',
      kind: 'tool_call' as const,
      toolName: 'brain.record_cptd_activity',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const MOD05_CPTD_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(cptdDefinition);

validatePipelineDag(MOD05_CPTD_PIPELINE);
