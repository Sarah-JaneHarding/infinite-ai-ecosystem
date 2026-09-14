// Stage 56 — LE-04 Pattern Miner unit tests.
//
// Definition of Done: happy path + at least two failure paths.
// UUID and timestamp are injected so results are deterministic.

import { describe, expect, it } from 'vitest';
import {
  minePatterns,
  type PatternMinerAttribution,
  type PatternMinerInput,
} from '../src/pattern-miner.js';

const CAPS_TOPIC_ID = 'CAPS-G4-MATH-T1';
const NOW = '2026-09-14T10:00:00Z';

let idCounter = 0;
function makeId(): string {
  idCounter++;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

function makeInput(
  partial: Partial<PatternMinerInput> & {
    attributions: readonly PatternMinerAttribution[];
  },
): PatternMinerInput {
  return {
    capsTopicId: CAPS_TOPIC_ID,
    stratificationFields: [],
    now: NOW,
    idGenerator: makeId,
    ...partial,
  };
}

function makeAttribution(
  agentId: string,
  meanScoreDelta: number | null,
  cohortSize = 30,
): PatternMinerAttribution {
  return {
    artefactId: makeId(),
    agentId,
    method: 'pre_post_assessment',
    confidence: 0.8,
    cohortSize,
    meanScoreDelta,
  };
}

function nAttribsForAgent(
  count: number,
  agentId: string,
  delta: number | null,
): PatternMinerAttribution[] {
  return Array.from({ length: count }, () => makeAttribution(agentId, delta));
}

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('minePatterns — needs_input', () => {
  it('returns needs_input when attributions array is empty', () => {
    const result = minePatterns(makeInput({ attributions: [] }));

    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('attributions');
  });
});

describe('minePatterns — below_threshold', () => {
  it('returns below_threshold when fewer than 10 attributions supplied', () => {
    const attributions = nAttribsForAgent(7, 'TB-01', 12);
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('below_threshold');
    if (result.status !== 'below_threshold') return;
    expect(result.actual).toBe(7);
    expect(result.required).toBe(10);
  });

  it('returns below_threshold when total ≥ 10 but all agent groups are individually below threshold', () => {
    // 12 attributions split across 3 agents (4 each) — none has ≥ 10
    const attributions = [
      ...nAttribsForAgent(4, 'TB-01', 10),
      ...nAttribsForAgent(4, 'TB-02', 10),
      ...nAttribsForAgent(4, 'TB-03', 10),
    ];
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('below_threshold');
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('minePatterns — ok (single agent)', () => {
  it('returns ok with one pattern when a single agent has ≥ 10 attributions', () => {
    const attributions = nAttribsForAgent(10, 'TB-01', 8);
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.capsTopicId).toBe(CAPS_TOPIC_ID);
    expect(result.patterns).toHaveLength(1);
    expect(result.patternsBlockedForBiasDivergence).toBe(0);

    const pattern = result.patterns[0]!;
    expect(pattern.agentId).toBe('TB-01');
    expect(pattern.sampleSize).toBe(10);
    expect(pattern.minedAt).toBe(NOW);
  });

  it('effectSize is the mean of non-null meanScoreDeltas', () => {
    const attributions = [
      makeAttribution('TB-01', 10),
      makeAttribution('TB-01', 20),
      makeAttribution('TB-01', 30),
      ...nAttribsForAgent(7, 'TB-01', 20),
    ];
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const pattern = result.patterns[0]!;
    // First 3 deltas are 10, 20, 30; remaining 7 are all 20
    // mean = (10+20+30 + 7*20) / 10 = (60+140) / 10 = 20
    expect(pattern.effectSize).toBeCloseTo(20, 5);
  });

  it('null deltas are excluded from the effectSize calculation', () => {
    const attributions = [
      makeAttribution('TB-01', 10),
      makeAttribution('TB-01', 20),
      makeAttribution('TB-01', null), // excluded
      makeAttribution('TB-01', null), // excluded
      ...nAttribsForAgent(6, 'TB-01', 15),
    ];
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // Non-null deltas: [10, 20, 15×6] = 8 values, mean = (10+20+6*15)/8 = 120/8 = 15
    expect(result.patterns[0]!.effectSize).toBeCloseTo(15, 5);
  });

  it('confidenceInterval is centred on effectSize', () => {
    const attributions = nAttribsForAgent(10, 'TB-01', 10);
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const [lo, hi] = result.patterns[0]!.confidenceInterval;
    const effectSize = result.patterns[0]!.effectSize;
    // All deltas identical (10) → stddev = 0 → margin = 0 → CI = [10, 10]
    expect(lo).toBeCloseTo(effectSize, 5);
    expect(hi).toBeCloseTo(effectSize, 5);
  });

  it('biasChecked is false when no stratificationFields declared', () => {
    const attributions = nAttribsForAgent(10, 'TB-01', 8);
    const result = minePatterns(makeInput({ attributions, stratificationFields: [] }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patterns[0]!.biasChecked).toBe(false);
  });

  it('biasChecked is true when stratificationFields are declared', () => {
    const attributions = nAttribsForAgent(10, 'TB-01', 8);
    const result = minePatterns(
      makeInput({ attributions, stratificationFields: ['language_group'] }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patterns[0]!.biasChecked).toBe(true);
  });
});

describe('minePatterns — ok (multiple agents)', () => {
  it('produces one pattern per agent when each has ≥ 10 attributions', () => {
    const attributions = [
      ...nAttribsForAgent(10, 'TB-01', 8),
      ...nAttribsForAgent(10, 'TB-02', 12),
    ];
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patterns).toHaveLength(2);
    const agentIds = result.patterns.map((p) => p.agentId);
    expect(agentIds).toContain('TB-01');
    expect(agentIds).toContain('TB-02');
  });

  it('excludes agents below per-agent threshold without counting them as blocked', () => {
    // TB-01 has 10 (threshold met); TB-02 has 5 (below threshold, not bias-blocked)
    const attributions = [
      ...nAttribsForAgent(10, 'TB-01', 8),
      ...nAttribsForAgent(5, 'TB-02', 8),
    ];
    const result = minePatterns(makeInput({ attributions }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]!.agentId).toBe('TB-01');
    expect(result.patternsBlockedForBiasDivergence).toBe(0);
  });
});

describe('minePatterns — bias divergence', () => {
  it('blocks a pattern and increments blocked count when high CV detected with stratificationFields', () => {
    // Deltas [1, 100, 1, 100, ...] → mean ≈ 50, std >> mean → CV > 1 → blocked
    const divergentAttribs = Array.from({ length: 10 }, (_, i) =>
      makeAttribution('TB-01', i % 2 === 0 ? 1 : 100),
    );
    const result = minePatterns(
      makeInput({
        attributions: divergentAttribs,
        stratificationFields: ['grade_phase'],
      }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patternsBlockedForBiasDivergence).toBe(1);
    expect(result.patterns).toHaveLength(0);
  });

  it('does NOT block a pattern when stratificationFields are empty, even with high variance', () => {
    const highVarianceAttribs = Array.from({ length: 10 }, (_, i) =>
      makeAttribution('TB-01', i % 2 === 0 ? 1 : 100),
    );
    const result = minePatterns(
      makeInput({ attributions: highVarianceAttribs, stratificationFields: [] }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patternsBlockedForBiasDivergence).toBe(0);
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]!.biasChecked).toBe(false);
  });

  it('partial block: one agent divergent, one stable → blocked=1, patterns has 1', () => {
    const stableAttribs = nAttribsForAgent(10, 'TB-01', 10); // consistent
    const divergentAttribs = Array.from({ length: 10 }, (_, i) =>
      makeAttribution('TB-02', i % 2 === 0 ? 1 : 100),
    );
    const result = minePatterns(
      makeInput({
        attributions: [...stableAttribs, ...divergentAttribs],
        stratificationFields: ['grade_phase'],
      }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.patternsBlockedForBiasDivergence).toBe(1);
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]!.agentId).toBe('TB-01');
  });
});
