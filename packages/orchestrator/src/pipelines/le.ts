// LE Learning Engine pipelines — Stage 50.
//
// Five pipelines cover the LE feedback loop described in Stage 13 of the build manual
// ("signal captured → diff and classify → outcome attribution → pattern mining →
// challenger proposed → offline eval vs champion → ◆ ratify promotion → promote to L3
// (versioned) → publish to commons (opt-in) → decay and revalidate"), split the same way
// MOD-02 splits its lifecycle into independently-triggered pipelines rather than one DAG
// with dead-end branches:
//
// LE_SIGNAL_PIPELINE — one call per HITL edit event:
//   ingest correction (LE-01) → process HITL event (LE-02)
//
// LE_PATTERN_PIPELINE — periodic pattern mining over a correction window:
//   mine patterns (LE-03) → score attribution (LE-04)
//   Both agents write their own outcome (including a below-threshold result) to Brain
//   themselves — nothing else in the pipeline needs to act on that result structurally.
//   Whether a scored pattern has enough evidence to attempt evolution is a call made
//   outside this DAG, from the recorded LE-04 output, the same way AC-04's daily signal
//   feeds decisions made outside its own pipeline.
//
// LE_EVOLUTION_PIPELINE — triggered once a pattern has enough attribution evidence:
//   evolve prompt (LE-06, candidate only) → eval gate (LE-07, verdict only) →
//   ◆ promotion ratification → promote challenger to champion
//   LE-06 and LE-07 never write to Brain themselves (candidate/verdict only, per their
//   contracts) — the only persisted, irreversible action is the gated promote step,
//   which is what validatePipelineGating checks.
//
// LE_EXEMPLAR_PIPELINE — triggered on a high-quality artefact, independent of pattern
// mining (LE-05's input is an artefact, not a pattern):
//   curate exemplar (LE-05, candidate only) → ◆ exemplar ratification → promote exemplar
//
// LE_COMMONS_PIPELINE — triggered when a tenant opts a ratified pattern into sharing:
//   evaluate commons eligibility (LE-08) → [k-anonymity/opt-in blocked] record blocked
//                                          → [eligible] ◆ commons ratification → publish
//   LE-08's own contract says writesToBrain: true, but the orchestrator still models the
//   actual publish as a distinct gated tool_call — publishing de-identified patterns
//   across tenant boundaries is exactly the kind of irreversible, externally-visible
//   action validatePipelineGating exists to catch, and that check only ever inspects
//   tool_call steps.
//
// Reversibility: Stage 13 requires "every promotion is versioned and reversible by one
// command." That command is `packages/learning/src/promotion-log.ts`'s rollback command
// generation, not DAG-level compensation — compensation steps run automatically when a
// *later step in the same run* fails, and promote-challenger/promote-exemplar/publish-
// to-commons are each the last step in their pipeline, so there is no later failure for
// a compensation step to react to.
//
// Structural integrity: validatePipelineDag runs at module load on all five pipelines.

import { PipelineDefinition, validatePipelineDag } from '../dag.js';

// ─────────────────────────────────────────────────────────────────────────────
// LE Signal pipeline
// ─────────────────────────────────────────────────────────────────────────────

const signalDefinition = {
  id: 'le-signal',
  version: '1.0.0',
  entryStepId: 'ingest-correction',
  steps: {
    // LE-01 labels a single HITL edit diff as a correction event and writes it to Brain.
    'ingest-correction': {
      id: 'ingest-correction',
      kind: 'agent_call' as const,
      agentId: 'LE-01',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'process-hitl-event',
    },
    // LE-02 normalises the raw event (accept/reject/edit/HoD override) into a weight
    // adjustment signal and writes it to Brain. Terminal — nothing to gate; neither
    // agent performs an irreversible external action.
    'process-hitl-event': {
      id: 'process-hitl-event',
      kind: 'agent_call' as const,
      agentId: 'LE-02',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
  },
};

export const LE_SIGNAL_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(signalDefinition);

validatePipelineDag(LE_SIGNAL_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// LE Pattern Mining pipeline
// ─────────────────────────────────────────────────────────────────────────────

const patternDefinition = {
  id: 'le-pattern-mining',
  version: '1.0.0',
  entryStepId: 'mine-patterns',
  steps: {
    // LE-03 mines a pattern from correction events in the window (k-anonymity
    // pre-check: ≥5 unique teacher refs), writing the pattern to Brain.
    'mine-patterns': {
      id: 'mine-patterns',
      kind: 'agent_call' as const,
      agentId: 'LE-03',
      timeoutMs: 300_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'score-attribution',
    },
    // LE-04 scores the mined pattern's attribution (below PATTERN_MIN_SAMPLE_SIZE = 10
    // returns below_threshold) and writes the scored result to Brain itself. Terminal —
    // whether to attempt evolution from a scored pattern is decided outside this DAG.
    'score-attribution': {
      id: 'score-attribution',
      kind: 'agent_call' as const,
      agentId: 'LE-04',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
  },
};

export const LE_PATTERN_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(patternDefinition);

validatePipelineDag(LE_PATTERN_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// LE Evolution pipeline
// ─────────────────────────────────────────────────────────────────────────────

const evolutionDefinition = {
  id: 'le-evolution',
  version: '1.0.0',
  entryStepId: 'evolve-prompt',
  steps: {
    // LE-06 proposes a challenger prompt from mined patterns. PromptChallenger.isLive
    // is z.literal(false) — structurally impossible to be live without passing LE-07
    // and ratification. No Brain write.
    'evolve-prompt': {
      id: 'evolve-prompt',
      kind: 'agent_call' as const,
      agentId: 'LE-06',
      timeoutMs: 300_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'eval-gatekeeper',
    },
    // LE-07 scores champion vs challenger (regression → bias → improvement priority).
    // Verdict only — advisory, never itself a promotion. No Brain write.
    'eval-gatekeeper': {
      id: 'eval-gatekeeper',
      kind: 'agent_call' as const,
      agentId: 'LE-07',
      timeoutMs: 300_000,
      maxRetries: 1,
      compensatesWith: null,
      next: 'promotion-ratification',
    },
    // 7-day window for SMT (or a curriculum board) to review the challenger, its eval
    // delta and the rollback command before it goes live. Every path to
    // promote-challenger passes through this gate (enforced by validatePipelineGating).
    'promotion-ratification': {
      id: 'promotion-ratification',
      kind: 'human_gate' as const,
      requiredRole: 'smt',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'promote-challenger',
    },
    // Irreversible in the forward sense — the champion prompt changes for every future
    // run of this agent. Reversible by the promotion-log rollback command, not DAG
    // compensation (see file header). Terminal: nothing follows to fail and trigger it.
    'promote-challenger': {
      id: 'promote-challenger',
      kind: 'tool_call' as const,
      toolName: 'brain.promote_challenger_prompt',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const LE_EVOLUTION_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(evolutionDefinition);

validatePipelineDag(LE_EVOLUTION_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// LE Exemplar pipeline
// ─────────────────────────────────────────────────────────────────────────────

const exemplarDefinition = {
  id: 'le-exemplar',
  version: '1.0.0',
  entryStepId: 'curate-exemplar',
  steps: {
    // LE-05 scores a candidate artefact against evaluation criteria. ExemplarCandidate.
    // promoted is z.literal(false) — schema error for this field to be true. No Brain
    // write; candidates only.
    'curate-exemplar': {
      id: 'curate-exemplar',
      kind: 'agent_call' as const,
      agentId: 'LE-05',
      timeoutMs: 120_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'exemplar-ratification',
    },
    // 7-day window for the HoD to ratify the candidate before it enters the few-shot
    // exemplar set. promote-exemplar must only be reached through this gate (enforced
    // by validatePipelineGating).
    'exemplar-ratification': {
      id: 'exemplar-ratification',
      kind: 'human_gate' as const,
      requiredRole: 'hod',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'promote-exemplar',
    },
    // Append-only Brain write — the ratified exemplar is a versioned L3 fact. Terminal.
    'promote-exemplar': {
      id: 'promote-exemplar',
      kind: 'tool_call' as const,
      toolName: 'brain.promote_exemplar',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
  },
};

export const LE_EXEMPLAR_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(exemplarDefinition);

validatePipelineDag(LE_EXEMPLAR_PIPELINE);

// ─────────────────────────────────────────────────────────────────────────────
// LE Commons pipeline
// ─────────────────────────────────────────────────────────────────────────────

const commonsDefinition = {
  id: 'le-commons',
  version: '1.0.0',
  entryStepId: 'evaluate-commons-publish',
  steps: {
    // LE-08 checks k-anonymity (COMMONS_K_ANONYMITY_THRESHOLD = 5 contributing tenants)
    // and tenant opt-in, returning published or blocked (no_opt_in / below_threshold).
    'evaluate-commons-publish': {
      id: 'evaluate-commons-publish',
      kind: 'agent_call' as const,
      agentId: 'LE-08',
      timeoutMs: 60_000,
      maxRetries: 2,
      compensatesWith: null,
      next: 'branch-on-commons-eligible',
    },
    // Condition "learning.commons_publish_blocked" evaluates LE-08's output.status !==
    // "published" — LE08Result's real statuses are "published", "suppressed_below_
    // threshold", "suppressed_no_opt_in" and "needs_input"; there is no literal "blocked"
    // (a stale assumption this comment used to repeat before LE-08's contract was
    // finalised). The runner's ConditionEvaluator injects this check.
    'branch-on-commons-eligible': {
      id: 'branch-on-commons-eligible',
      kind: 'branch' as const,
      condition: 'learning.commons_publish_blocked',
      timeoutMs: 5_000,
      maxRetries: 0,
      compensatesWith: null,
      onTrue: 'record-commons-blocked',
      onFalse: 'commons-ratification',
    },
    // Append-only audit record of why publication did not proceed. No PII, no pattern
    // content — just the block reason.
    'record-commons-blocked': {
      id: 'record-commons-blocked',
      kind: 'tool_call' as const,
      toolName: 'learning.record_commons_publish_blocked',
      timeoutMs: 30_000,
      maxRetries: 3,
      compensatesWith: null,
      next: null,
    },
    // 7-day window for SMT to ratify sharing a de-identified, aggregated pattern beyond
    // this tenant's boundary — the most consequential LE decision, since it is the only
    // one that leaves the tenant. publish-to-commons must only be reached through this
    // gate (enforced by validatePipelineGating).
    'commons-ratification': {
      id: 'commons-ratification',
      kind: 'human_gate' as const,
      requiredRole: 'smt',
      timeoutMs: 604_800_000, // 7 days
      maxRetries: 0,
      compensatesWith: null,
      next: 'publish-to-commons',
    },
    // Irreversible — once published, the pattern is visible to every opted-in tenant.
    // Terminal: nothing follows to fail and trigger a compensation.
    'publish-to-commons': {
      id: 'publish-to-commons',
      kind: 'tool_call' as const,
      toolName: 'learning.publish_to_commons',
      timeoutMs: 30_000,
      maxRetries: 2,
      compensatesWith: null,
      next: null,
    },
  },
};

export const LE_COMMONS_PIPELINE: PipelineDefinition =
  PipelineDefinition.parse(commonsDefinition);

validatePipelineDag(LE_COMMONS_PIPELINE);
