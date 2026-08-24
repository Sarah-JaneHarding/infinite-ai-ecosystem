// MOD-02 Support Analytics Centre pipelines — Stage 10.
//
// Three pipelines cover the full RTI / MTSS / SIAS lifecycle:
//
// MOD02_RTI_PIPELINE — termly screening and tiering flow:
//   screen learners (AC-01) → assess class core health (AC-02) →
//   [core health blocked] → raise Tier 1 improvement task [terminal]
//   [core health ok]      → recommend tiers (AC-03) → ◆ SBST review →
//                           plan interventions (AC-05) → deliver → record to Brain
//
// MOD02_MONITORING_PIPELINE — periodic monitoring and referral path:
//   monitor progress (AC-06) → check fidelity (AC-07) →
//   [needs referral] → compile SIAS (AC-09) → ◆ referral sign-off →
//                      write parent report (AC-10) → ◆ parent-letter review → dispatch
//   [no referral]    → record monitoring outcome [terminal]
//
// MOD02_SBST_SCRIBE_PIPELINE — SBST meeting scribing (event-triggered):
//   scribe meeting (AC-08) → ◆ chair confirmation → record minutes to Brain
//
// AC-02 gates AC-03: if the class's Tier-1 rate falls below 80%, individual tier
// recommendations are suppressed and a Tier-1 improvement task is raised instead.
// Every consequential decision (tier recommendation, intervention delivery, referral,
// parent letter dispatch) sits behind a human gate. These are verified by
// validatePipelineGating in the test suite.
//
// Structural integrity: validatePipelineDag runs at module load on all three pipelines.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOD-02 RTI pipeline
// ─────────────────────────────────────────────────────────────────────────────

const rtiDefinition = {
  id: 'mod-02-rti',
  version: '1.0.0',
  entryStepId: 'screen-learners',
  steps: {
    // ── Stage 1: screen ───────────────────────────────────────────────────────
    // One AC-01 call per learner. AC-01 writes screen results (versioned support
    // facts) to Brain. A safeguarding signal in any reading escalates immediately
    // and bypasses all downstream steps.
    'screen-learners': {
      id: 'screen-learners',
      kind: 'map' as const,
      itemStepId: 'screen-learner-item',
      collectionField: 'learners',
      timeoutMs: 1_800_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'assess-core-health',
    },
    'screen-learner-item': {
      id: 'screen-learner-item',
      kind: 'agent_call' as const,
      agentId: 'AC-01',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 2: core-health gate ─────────────────────────────────────────────
    // AC-02 checks whether ≥80% of the class is in Tier 1 (the DBE SIAS
    // core-health threshold). If blocked, no individual tier recommendations may
    // be made for this class this term.
    'assess-core-health': {
      id: 'assess-core-health',
      kind: 'agent_call' as const,
      agentId: 'AC-02',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'branch-on-core-health',
    },
    // Condition "support.core_health_blocked" evaluates AC-02's output.status === "blocked".
    // The runner's ConditionEvaluator injects this check — no business logic here.
    'branch-on-core-health': {
      id: 'branch-on-core-health',
      kind: 'branch' as const,
      condition: 'support.core_health_blocked',
      timeoutMs: 5_000,
      maxRetries: 0,
      compensatesWith: null,
      onTrue: 'raise-tier1-improvement',
      onFalse: 'recommend-tiers',
    },
    // ── Blocked path: Tier 1 improvement ─────────────────────────────────────
    // When core health fails, raise a Tier 1 improvement task for the whole class.
    // The run terminates here; individual tier recommendations wait for the next
    // termly re-screen after Tier 1 teaching has been improved.
    'raise-tier1-improvement': {
      id: 'raise-tier1-improvement',
      kind: 'tool_call' as const,
      toolName: 'support.raise_tier1_improvement',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 3: tier recommendation ─────────────────────────────────────────
    // AC-03's input schema enforces coreHealthGate: z.literal(true), so it cannot
    // be satisfied without a passing gate. One call per at-risk learner. AC-03
    // writes each recommendation (with evidenceIds) to Brain.
    'recommend-tiers': {
      id: 'recommend-tiers',
      kind: 'map' as const,
      itemStepId: 'recommend-tier-item',
      collectionField: 'atRiskLearners',
      timeoutMs: 1_200_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'sbst-review',
    },
    'recommend-tier-item': {
      id: 'recommend-tier-item',
      kind: 'agent_call' as const,
      agentId: 'AC-03',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 4: SBST human gate ──────────────────────────────────────────────
    // 7-day window for the SBST to review and ratify the tier recommendations.
    // The approval record (sbstRatificationId) is required by AC-05 before it
    // will produce an intervention plan.
    'sbst-review': {
      id: 'sbst-review',
      kind: 'human_gate' as const,
      requiredRole: 'sbst',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'plan-interventions',
    },
    // ── Stage 5: intervention planning ───────────────────────────────────────
    // AC-05 plans an intervention for each Tier 2/3 learner; it requires the
    // sbstRatificationId from the gate above. Plans are written to Brain.
    'plan-interventions': {
      id: 'plan-interventions',
      kind: 'map' as const,
      itemStepId: 'plan-intervention-item',
      collectionField: 'tier2and3Learners',
      timeoutMs: 1_200_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'deliver-interventions',
    },
    'plan-intervention-item': {
      id: 'plan-intervention-item',
      kind: 'agent_call' as const,
      agentId: 'AC-05',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 6: deliver → Brain record ──────────────────────────────────────
    // support.deliver_interventions makes plans visible to educators — irreversible
    // once a member of staff has seen the material. Must only be reached through
    // sbst-review (enforced by validatePipelineGating in tests).
    'deliver-interventions': {
      id: 'deliver-interventions',
      kind: 'tool_call' as const,
      toolName: 'support.deliver_interventions',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: 'compensate-deliver-interventions',
      next: 'record-interventions-to-brain',
    },
    // Append-only Brain write — no compensation possible.
    'record-interventions-to-brain': {
      id: 'record-interventions-to-brain',
      kind: 'tool_call' as const,
      toolName: 'brain.record_intervention_delivery',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // ── Compensation ──────────────────────────────────────────────────────────
    // Retracts the delivery record if the Brain write fails terminally. The
    // delivery itself cannot be unseen; the retraction is an append-only audit event.
    'compensate-deliver-interventions': {
      id: 'compensate-deliver-interventions',
      kind: 'compensation' as const,
      compensatesStepId: 'deliver-interventions',
      agentId: null,
      toolName: 'support.retract_intervention_delivery',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
    },
  },
};

export const MOD02_RTI_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(rtiDefinition);

validatePipelineDag(MOD02_RTI_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// MOD-02 Monitoring pipeline
// ─────────────────────────────────────────────────────────────────────────────

const monitoringDefinition = {
  id: 'mod-02-monitoring',
  version: '1.0.0',
  entryStepId: 'monitor-progress',
  steps: {
    // ── Stage 1: progress monitoring ─────────────────────────────────────────
    // AC-06 computes the trend line for each active intervention against its goal
    // line. Requires ≥2 measurements; returns needs_input when data is insufficient.
    'monitor-progress': {
      id: 'monitor-progress',
      kind: 'map' as const,
      itemStepId: 'monitor-progress-item',
      collectionField: 'activeInterventions',
      timeoutMs: 1_200_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'check-fidelity',
    },
    'monitor-progress-item': {
      id: 'monitor-progress-item',
      kind: 'agent_call' as const,
      agentId: 'AC-06',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Stage 2: fidelity check ───────────────────────────────────────────────
    // AC-07 checks whether each intervention ran as planned (80% of minutes
    // delivered on the right day). Inadequate fidelity is surfaced in the audit
    // log and influences the progress recommendation.
    'check-fidelity': {
      id: 'check-fidelity',
      kind: 'map' as const,
      itemStepId: 'check-fidelity-item',
      collectionField: 'activeInterventions',
      timeoutMs: 1_200_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'branch-on-referral',
    },
    'check-fidelity-item': {
      id: 'check-fidelity-item',
      kind: 'agent_call' as const,
      agentId: 'AC-07',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── Branch: referral path vs. record outcome ──────────────────────────────
    // Condition "support.needs_referral" evaluates whether any monitored learner
    // has reached REFERRAL_PENDING SIAS status.
    'branch-on-referral': {
      id: 'branch-on-referral',
      kind: 'branch' as const,
      condition: 'support.needs_referral',
      timeoutMs: 5_000,
      maxRetries: 0,
      compensatesWith: null,
      onTrue: 'compile-sias',
      onFalse: 'record-monitoring-outcome',
    },
    // ── Referral path ─────────────────────────────────────────────────────────
    // AC-09 compiles the SIAS documentation pack. It accepts input only when
    // siasStatus === 'REFERRAL_PENDING'; the SIAS state machine is enforced in
    // the schema — any other status returns state_machine_blocked.
    'compile-sias': {
      id: 'compile-sias',
      kind: 'agent_call' as const,
      agentId: 'AC-09',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'referral-sign-off',
    },
    // 7-day window for the SBST to sign off the compiled referral pack.
    // AC-09 sets requiresSignOff: true always.
    'referral-sign-off': {
      id: 'referral-sign-off',
      kind: 'human_gate' as const,
      requiredRole: 'sbst',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'write-parent-report',
    },
    // After referral is signed off, AC-10 writes the parent progress letter in the
    // guardian's home language at the requested readability grade.
    'write-parent-report': {
      id: 'write-parent-report',
      kind: 'agent_call' as const,
      agentId: 'AC-10',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'parent-letter-review',
    },
    // 48-hour window for the Learning Support Educator to review the parent letter
    // before it is dispatched to the guardian. AC-10 sets requiresSignOff: true always.
    'parent-letter-review': {
      id: 'parent-letter-review',
      kind: 'human_gate' as const,
      requiredRole: 'lse',
      timeoutMs: 172_800_000, // 48 hours
      maxRetries: 0,
      compensatesWith: null,
      next: 'dispatch-parent-report',
    },
    // support.dispatch_parent_report delivers the letter to the guardian — irreversible
    // once sent. Must only be reached through parent-letter-review.
    'dispatch-parent-report': {
      id: 'dispatch-parent-report',
      kind: 'tool_call' as const,
      toolName: 'support.dispatch_parent_report',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
    // ── No-referral path ──────────────────────────────────────────────────────
    // Append-only Brain write of the progress and fidelity summary for this cycle.
    'record-monitoring-outcome': {
      id: 'record-monitoring-outcome',
      kind: 'tool_call' as const,
      toolName: 'brain.record_monitoring_outcome',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const MOD02_MONITORING_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(monitoringDefinition);

validatePipelineDag(MOD02_MONITORING_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// MOD-02 SBST Scribe pipeline
// ─────────────────────────────────────────────────────────────────────────────

const sbstScribeDefinition = {
  id: 'mod-02-sbst-scribe',
  version: '1.0.0',
  entryStepId: 'scribe-meeting',
  steps: {
    // ── Stage 1: scribe the meeting ────────────────────────────────────────────
    // AC-08 converts a structured meeting agenda into draft minutes with decisions
    // and action items. requiresChairConfirmation: true is always present in the
    // output — no code path in AC-08 may omit it.
    'scribe-meeting': {
      id: 'scribe-meeting',
      kind: 'agent_call' as const,
      agentId: 'AC-08',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'chair-confirmation',
    },
    // ── Stage 2: chair human gate ──────────────────────────────────────────────
    // 48-hour window for the SBST chair to confirm the draft minutes before they
    // are committed to the Brain as a ratified, versioned support fact.
    'chair-confirmation': {
      id: 'chair-confirmation',
      kind: 'human_gate' as const,
      requiredRole: 'sbst_chair',
      timeoutMs: 172_800_000, // 48 hours
      maxRetries: 0,
      compensatesWith: null,
      next: 'record-minutes',
    },
    // ── Stage 3: record to Brain ───────────────────────────────────────────────
    // brain.record_sbst_minutes is an append-only Brain write — ratified minutes
    // are a versioned support fact. Must only be reached through chair-confirmation.
    'record-minutes': {
      id: 'record-minutes',
      kind: 'tool_call' as const,
      toolName: 'brain.record_sbst_minutes',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const MOD02_SBST_SCRIBE_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(sbstScribeDefinition);

validatePipelineDag(MOD02_SBST_SCRIBE_PIPELINE);
