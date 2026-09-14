// LE Learning Engine pipeline structural tests — Stage 50.
//
// Invariants enforced across all five pipelines:
// 1. Structural integrity (validatePipelineDag).
// 2. Irreversible tools (brain.promote_challenger_prompt, brain.promote_exemplar,
//    learning.publish_to_commons) are only reachable through a human gate.
// 3. LE-08's commons-eligibility branch is correctly wired as a short-circuit.
// 4. All nine LE agents appear across the five pipelines.
// 5. Human gates carry the expected requiredRole values.

import { describe, expect, it } from 'vitest';

import { validatePipelineDag, validatePipelineGating } from '../../src/dag.js';
import {
  LE_COMMONS_PIPELINE,
  LE_EVOLUTION_PIPELINE,
  LE_EXEMPLAR_PIPELINE,
  LE_PATTERN_PIPELINE,
  LE_SIGNAL_PIPELINE,
} from '../../src/pipelines/le.js';

const IRREVERSIBLE_TOOLS = new Set([
  'brain.promote_challenger_prompt',
  'brain.promote_exemplar',
  'learning.publish_to_commons',
]);

// ── Signal pipeline ────────────────────────────────────────────────────────────

describe('LE_SIGNAL_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(LE_SIGNAL_PIPELINE)).not.toThrow();
  });

  it('passes gating validation', () => {
    expect(() =>
      validatePipelineGating(LE_SIGNAL_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(LE_SIGNAL_PIPELINE.id).toBe('le-signal');
    expect(LE_SIGNAL_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry is ingest-correction (LE-01) → process-hitl-event (LE-02) → terminal', () => {
    expect(LE_SIGNAL_PIPELINE.entryStepId).toBe('ingest-correction');

    const ingest = LE_SIGNAL_PIPELINE.steps['ingest-correction'];
    expect(ingest?.kind === 'agent_call' && ingest.agentId).toBe('LE-01');
    if (ingest?.kind === 'agent_call') expect(ingest.next).toBe('process-hitl-event');

    const process = LE_SIGNAL_PIPELINE.steps['process-hitl-event'];
    expect(process?.kind === 'agent_call' && process.agentId).toBe('LE-02');
    if (process?.kind === 'agent_call') expect(process.next).toBeNull();
  });
});

// ── Pattern mining pipeline ──────────────────────────────────────────────────

describe('LE_PATTERN_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(LE_PATTERN_PIPELINE)).not.toThrow();
  });

  it('passes gating validation', () => {
    expect(() =>
      validatePipelineGating(LE_PATTERN_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(LE_PATTERN_PIPELINE.id).toBe('le-pattern-mining');
    expect(LE_PATTERN_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry is mine-patterns (LE-03) → score-attribution (LE-04) → terminal', () => {
    expect(LE_PATTERN_PIPELINE.entryStepId).toBe('mine-patterns');

    const mine = LE_PATTERN_PIPELINE.steps['mine-patterns'];
    expect(mine?.kind === 'agent_call' && mine.agentId).toBe('LE-03');
    if (mine?.kind === 'agent_call') expect(mine.next).toBe('score-attribution');

    const score = LE_PATTERN_PIPELINE.steps['score-attribution'];
    expect(score?.kind === 'agent_call' && score.agentId).toBe('LE-04');
    if (score?.kind === 'agent_call') expect(score.next).toBeNull();
  });
});

// ── Evolution pipeline ───────────────────────────────────────────────────────

describe('LE_EVOLUTION_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(LE_EVOLUTION_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — promote-challenger only reachable through promotion-ratification', () => {
    expect(() =>
      validatePipelineGating(LE_EVOLUTION_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(LE_EVOLUTION_PIPELINE.id).toBe('le-evolution');
    expect(LE_EVOLUTION_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry is evolve-prompt (LE-06) → eval-gatekeeper (LE-07) → promotion-ratification → promote-challenger', () => {
    expect(LE_EVOLUTION_PIPELINE.entryStepId).toBe('evolve-prompt');

    const evolve = LE_EVOLUTION_PIPELINE.steps['evolve-prompt'];
    expect(evolve?.kind === 'agent_call' && evolve.agentId).toBe('LE-06');
    if (evolve?.kind === 'agent_call') expect(evolve.next).toBe('eval-gatekeeper');

    const gate = LE_EVOLUTION_PIPELINE.steps['eval-gatekeeper'];
    expect(gate?.kind === 'agent_call' && gate.agentId).toBe('LE-07');
    if (gate?.kind === 'agent_call') expect(gate.next).toBe('promotion-ratification');

    const ratification = LE_EVOLUTION_PIPELINE.steps['promotion-ratification'];
    expect(ratification?.kind).toBe('human_gate');
    if (ratification?.kind === 'human_gate') {
      expect(ratification.requiredRole).toBe('smt');
      expect(ratification.next).toBe('promote-challenger');
    }
  });

  it('promote-challenger calls brain.promote_challenger_prompt and is terminal', () => {
    const step = LE_EVOLUTION_PIPELINE.steps['promote-challenger'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('brain.promote_challenger_prompt');
      expect(step.next).toBeNull();
    }
  });
});

// ── Exemplar pipeline ────────────────────────────────────────────────────────

describe('LE_EXEMPLAR_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(LE_EXEMPLAR_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — promote-exemplar only reachable through exemplar-ratification', () => {
    expect(() =>
      validatePipelineGating(LE_EXEMPLAR_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(LE_EXEMPLAR_PIPELINE.id).toBe('le-exemplar');
    expect(LE_EXEMPLAR_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry is curate-exemplar (LE-05) → exemplar-ratification (hod) → promote-exemplar', () => {
    expect(LE_EXEMPLAR_PIPELINE.entryStepId).toBe('curate-exemplar');

    const curate = LE_EXEMPLAR_PIPELINE.steps['curate-exemplar'];
    expect(curate?.kind === 'agent_call' && curate.agentId).toBe('LE-05');
    if (curate?.kind === 'agent_call') expect(curate.next).toBe('exemplar-ratification');

    const gate = LE_EXEMPLAR_PIPELINE.steps['exemplar-ratification'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('hod');
      expect(gate.next).toBe('promote-exemplar');
    }

    const promote = LE_EXEMPLAR_PIPELINE.steps['promote-exemplar'];
    expect(promote?.kind).toBe('tool_call');
    if (promote?.kind === 'tool_call') {
      expect(promote.toolName).toBe('brain.promote_exemplar');
      expect(promote.next).toBeNull();
    }
  });
});

// ── Commons pipeline ─────────────────────────────────────────────────────────

describe('LE_COMMONS_PIPELINE', () => {
  it('is a structurally valid DAG', () => {
    expect(() => validatePipelineDag(LE_COMMONS_PIPELINE)).not.toThrow();
  });

  it('passes gating validation — publish-to-commons only reachable through commons-ratification', () => {
    expect(() =>
      validatePipelineGating(LE_COMMONS_PIPELINE, (toolName) =>
        IRREVERSIBLE_TOOLS.has(toolName),
      ),
    ).not.toThrow();
  });

  it('id and version are set', () => {
    expect(LE_COMMONS_PIPELINE.id).toBe('le-commons');
    expect(LE_COMMONS_PIPELINE.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('entry point is evaluate-commons-publish', () => {
    expect(LE_COMMONS_PIPELINE.entryStepId).toBe('evaluate-commons-publish');
    const step = LE_COMMONS_PIPELINE.steps['evaluate-commons-publish'];
    expect(step?.kind === 'agent_call' && step.agentId).toBe('LE-08');
    if (step?.kind === 'agent_call') expect(step.next).toBe('branch-on-commons-eligible');
  });

  it('branch-on-commons-eligible routes blocked → record-commons-blocked and eligible → commons-ratification', () => {
    const branch = LE_COMMONS_PIPELINE.steps['branch-on-commons-eligible'];
    expect(branch?.kind).toBe('branch');
    if (branch?.kind === 'branch') {
      expect(branch.condition).toBe('learning.commons_publish_blocked');
      expect(branch.onTrue).toBe('record-commons-blocked');
      expect(branch.onFalse).toBe('commons-ratification');
    }
  });

  it('record-commons-blocked is a terminal tool_call (next: null)', () => {
    const step = LE_COMMONS_PIPELINE.steps['record-commons-blocked'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('learning.record_commons_publish_blocked');
      expect(step.next).toBeNull();
    }
  });

  it('commons-ratification is an smt gate immediately before publish-to-commons', () => {
    const gate = LE_COMMONS_PIPELINE.steps['commons-ratification'];
    expect(gate?.kind).toBe('human_gate');
    if (gate?.kind === 'human_gate') {
      expect(gate.requiredRole).toBe('smt');
      expect(gate.next).toBe('publish-to-commons');
    }
  });

  it('publish-to-commons calls learning.publish_to_commons and is terminal', () => {
    const step = LE_COMMONS_PIPELINE.steps['publish-to-commons'];
    expect(step?.kind).toBe('tool_call');
    if (step?.kind === 'tool_call') {
      expect(step.toolName).toBe('learning.publish_to_commons');
      expect(step.next).toBeNull();
    }
  });
});

// ── Cross-pipeline coverage ───────────────────────────────────────────────────

describe('LE agent coverage', () => {
  it('all nine LE agents (LE-01 through LE-09) appear across the five pipelines', () => {
    const allSteps = [
      ...Object.values(LE_SIGNAL_PIPELINE.steps),
      ...Object.values(LE_PATTERN_PIPELINE.steps),
      ...Object.values(LE_EVOLUTION_PIPELINE.steps),
      ...Object.values(LE_EXEMPLAR_PIPELINE.steps),
      ...Object.values(LE_COMMONS_PIPELINE.steps),
    ];
    const agentIds = allSteps
      .filter((s) => s.kind === 'agent_call')
      .map((s) => (s.kind === 'agent_call' ? s.agentId : ''));

    for (const id of [
      'LE-01',
      'LE-02',
      'LE-03',
      'LE-04',
      'LE-05',
      'LE-06',
      'LE-07',
      'LE-08',
    ]) {
      expect(agentIds, `Expected LE agent "${id}" to appear in an LE pipeline`).toContain(
        id,
      );
    }
    // LE-09 (Decay Watchdog) runs as a standalone trigger (TTL / CAPS-version-change),
    // the same way AC-04 (Early Warning) is excluded from MOD-02's pipelines.
    expect(agentIds).not.toContain('LE-09');
  });
});
