// Stage 57 — LE-05 Exemplar Curator unit tests.
//
// Definition of Done: happy path + at least two failure paths.
// UUID and timestamp are injected so results are deterministic.

import { describe, expect, it } from 'vitest';
import {
  curateExemplars,
  EXEMPLAR_MIN_COMPOSITE_SCORE,
  type ExemplarCuratorCandidateInput,
  type ExemplarCuratorInput,
} from '../src/exemplar-curator.js';

const CAPS_TOPIC_ID = 'CAPS-G4-MATH-T1';
const AGENT_ID = 'LE-05-TEST';
const NOW = '2026-09-14T10:00:00Z';

let idCounter = 0;
function makeId(): string {
  idCounter++;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

function makeInput(
  partial: Partial<ExemplarCuratorInput> & {
    candidates: readonly ExemplarCuratorCandidateInput[];
  },
): ExemplarCuratorInput {
  return {
    capsTopicId: CAPS_TOPIC_ID,
    agentId: AGENT_ID,
    now: NOW,
    idGenerator: makeId,
    ...partial,
  };
}

function makeCandidate(
  artefactId: string,
  evalScore: number,
  firstPassAcceptanceRate: number,
  attributionConfidence: number,
): ExemplarCuratorCandidateInput {
  return { artefactId, evalScore, firstPassAcceptanceRate, attributionConfidence };
}

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('curateExemplars — needs_input', () => {
  it('returns needs_input when candidates array is empty', () => {
    const result = curateExemplars(makeInput({ candidates: [] }));

    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('candidates');
  });
});

describe('curateExemplars — no_candidates', () => {
  it('returns no_candidates when all composite scores are below threshold', () => {
    const candidates = [
      makeCandidate('art-1', 0.2, 0.2, 0.2), // composite = 0.2
      makeCandidate('art-2', 0.3, 0.3, 0.3), // composite = 0.3
    ];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('no_candidates');
    if (result.status !== 'no_candidates') return;
    expect(result.detail).toContain(String(EXEMPLAR_MIN_COMPOSITE_SCORE));
  });

  it('returns no_candidates when composite score is exactly below threshold (0.499...)', () => {
    // 0.4 + 0.5 + 0.6 = 1.5 / 3 = 0.5 — this is exactly at threshold, so should qualify
    // Use values that give 0.499 recurring
    const candidates = [
      makeCandidate('art-1', 0.4, 0.5, 0.59), // composite ≈ 0.4967 < 0.5
    ];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('no_candidates');
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('curateExemplars — ok', () => {
  it('returns ok with one candidate when composite score meets threshold exactly', () => {
    // 0.5 + 0.5 + 0.5 = 1.5 / 3 = 0.5 — exactly at threshold
    const candidates = [makeCandidate('art-1', 0.5, 0.5, 0.5)];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0]!;
    expect(c.artefactId).toBe('art-1');
    expect(c.capsTopicId).toBe(CAPS_TOPIC_ID);
    expect(c.agentId).toBe(AGENT_ID);
    expect(c.compositeScore).toBeCloseTo(0.5, 10);
    expect(c.proposedAt).toBe(NOW);
    expect(c.promoted).toBe(false);
  });

  it('promoted is always false', () => {
    const candidates = [makeCandidate('art-1', 1.0, 1.0, 1.0)];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.candidates[0]!.promoted).toBe(false);
  });

  it('returns candidates sorted by compositeScore descending', () => {
    const candidates = [
      makeCandidate('art-low', 0.5, 0.5, 0.5),  // composite = 0.5
      makeCandidate('art-high', 0.9, 0.9, 0.9), // composite = 0.9
      makeCandidate('art-mid', 0.7, 0.7, 0.7),  // composite = 0.7
    ];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.candidates).toHaveLength(3);
    const scores = result.candidates.map((c) => c.compositeScore);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[1]).toBeGreaterThan(scores[2]!);
    expect(result.candidates[0]!.artefactId).toBe('art-high');
    expect(result.candidates[2]!.artefactId).toBe('art-low');
  });

  it('excludes candidates below threshold while including those above', () => {
    const candidates = [
      makeCandidate('art-pass', 0.8, 0.8, 0.8), // composite = 0.8
      makeCandidate('art-fail', 0.1, 0.1, 0.1), // composite = 0.1
    ];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.artefactId).toBe('art-pass');
  });

  it('rationale encodes all three score components', () => {
    const candidates = [makeCandidate('art-1', 0.6, 0.7, 0.8)];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const rationale = result.candidates[0]!.rationale;
    expect(rationale).toContain('eval=0.6');
    expect(rationale).toContain('firstPassAcceptance=0.7');
    expect(rationale).toContain('attributionConfidence=0.8');
  });

  it('each candidate gets a unique candidateId from idGenerator', () => {
    const candidates = [
      makeCandidate('art-1', 0.8, 0.8, 0.8),
      makeCandidate('art-2', 0.7, 0.7, 0.7),
    ];
    const result = curateExemplars(makeInput({ candidates }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const ids = result.candidates.map((c) => c.candidateId);
    expect(new Set(ids).size).toBe(2);
  });
});
