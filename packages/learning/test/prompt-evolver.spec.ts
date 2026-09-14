// Stage 57 — LE-06 Prompt Evolver unit tests.
//
// Definition of Done: happy path + at least two failure paths.
// UUID and timestamp are injected so results are deterministic.

import { describe, expect, it } from 'vitest';
import {
  evolvePrompt,
  EVOLVER_MIN_CORRECTION_FREQUENCY,
  type CorrectionPattern,
  type PromptEvolverInput,
} from '../src/prompt-evolver.js';

const AGENT_ID = 'LE-06-TEST';
const NOW = '2026-09-14T10:00:00Z';
const CHAMPION_VERSION = 'v1.0.0';
const CHAMPION_CONTENT = 'You are an educational content generator for South African primary schools.';

let idCounter = 0;
function makeId(): string {
  idCounter++;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

function makeInput(
  partial: Partial<PromptEvolverInput> & {
    correctionPatterns: readonly CorrectionPattern[];
  },
): PromptEvolverInput {
  return {
    agentId: AGENT_ID,
    championPrompt: { version: CHAMPION_VERSION, content: CHAMPION_CONTENT },
    now: NOW,
    idGenerator: makeId,
    ...partial,
  };
}

function makePattern(
  correctionType: CorrectionPattern['correctionType'],
  frequency: number,
  representativeExample = 'Example correction.',
): CorrectionPattern {
  return { correctionType, frequency, representativeExample };
}

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('evolvePrompt — needs_input', () => {
  it('returns needs_input when correctionPatterns array is empty', () => {
    const result = evolvePrompt(makeInput({ correctionPatterns: [] }));

    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('correctionPatterns');
  });
});

describe('evolvePrompt — no_improvement_found', () => {
  it('returns no_improvement_found when all patterns are below minimum frequency', () => {
    const patterns = [
      makePattern('factual', 1),
      makePattern('tone', 1),
    ];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('no_improvement_found');
    if (result.status !== 'no_improvement_found') return;
    expect(result.detail).toContain(String(EVOLVER_MIN_CORRECTION_FREQUENCY));
  });

  it('returns no_improvement_found when frequency is exactly one below threshold', () => {
    const patterns = [makePattern('readability', EVOLVER_MIN_CORRECTION_FREQUENCY - 1)];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('no_improvement_found');
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('evolvePrompt — ok', () => {
  it('returns ok with one addressed type when a single pattern meets threshold', () => {
    const patterns = [makePattern('factual', EVOLVER_MIN_CORRECTION_FREQUENCY)];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const { challenger } = result;
    expect(challenger.agentId).toBe(AGENT_ID);
    expect(challenger.proposedAt).toBe(NOW);
    expect(challenger.isLive).toBe(false);
    expect(challenger.addressedCorrectionTypes).toContain('factual');
    expect(challenger.addressedCorrectionTypes).toHaveLength(1);
  });

  it('isLive is always false', () => {
    const patterns = [makePattern('tone', 5)];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.challenger.isLive).toBe(false);
  });

  it('challenger version is derived from champion version', () => {
    const patterns = [makePattern('factual', 3)];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.challenger.challengerVersion).toBe(`${CHAMPION_VERSION}+le06`);
  });

  it('challenger content includes champion content and LE-06 enhancement block', () => {
    const patterns = [makePattern('curriculum_alignment', 3, 'Content missed CAPS topic.')];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const { content } = result.challenger;
    expect(content).toContain(CHAMPION_CONTENT);
    expect(content).toContain('[LE-06 enhancement]');
    expect(content).toContain('curriculum_alignment');
    expect(content).toContain('Content missed CAPS topic.');
  });

  it('excludes patterns below threshold while including those at or above', () => {
    const patterns = [
      makePattern('factual', 1),                               // excluded
      makePattern('tone', EVOLVER_MIN_CORRECTION_FREQUENCY),  // included
      makePattern('readability', 5),                           // included
    ];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.challenger.addressedCorrectionTypes).not.toContain('factual');
    expect(result.challenger.addressedCorrectionTypes).toContain('tone');
    expect(result.challenger.addressedCorrectionTypes).toContain('readability');
  });

  it('patterns are listed by frequency descending in the content', () => {
    const exampleHigh = 'High frequency issue.';
    const exampleLow = 'Low frequency issue.';
    const patterns = [
      makePattern('factual', 2, exampleLow),
      makePattern('tone', 10, exampleHigh),
    ];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const { content } = result.challenger;
    expect(content.indexOf(exampleHigh)).toBeLessThan(content.indexOf(exampleLow));
  });

  it('rationale names all addressed correction types', () => {
    const patterns = [
      makePattern('factual', 3),
      makePattern('completeness', 4),
    ];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.challenger.rationale).toContain('factual');
    expect(result.challenger.rationale).toContain('completeness');
  });

  it('challengerId is populated from idGenerator', () => {
    const patterns = [makePattern('other', 3)];
    const result = evolvePrompt(makeInput({ correctionPatterns: patterns }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.challenger.challengerId).toBeTruthy();
  });
});
