import { describe, expect, it } from 'vitest';

import {
  acceptCorrectionCandidate,
  buildCorrectionCandidate,
} from '../src/growth-loop.js';

const scrubName = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace('Thabo', '[REDACTED]') : value;

describe('buildCorrectionCandidate', () => {
  it('de-identifies input, context and editDiff independently', () => {
    const candidate = buildCorrectionCandidate(
      {
        agentId: 'CE-05',
        input: 'Plan a lesson for Thabo',
        context: 'Thabo struggles with fractions',
        decision: 'EDITED',
        reason: 'Tone was off.',
        editDiff: 'Changed wording about Thabo',
      },
      scrubName,
    );
    expect(candidate.input).toBe('Plan a lesson for [REDACTED]');
    expect(candidate.context).toBe('[REDACTED] struggles with fractions');
    expect(candidate.editDiff).toBe('Changed wording about [REDACTED]');
  });

  it('marks a fresh candidate as not reviewed', () => {
    const candidate = buildCorrectionCandidate(
      {
        agentId: 'CE-05',
        input: {},
        context: {},
        decision: 'REJECTED',
        reason: 'Wrong.',
      },
      (v) => v,
    );
    expect(candidate.reviewed).toBe(false);
  });

  it('leaves editDiff null when the decision has none (a REJECTED, not an EDITED)', () => {
    const candidate = buildCorrectionCandidate(
      {
        agentId: 'CE-05',
        input: {},
        context: {},
        decision: 'REJECTED',
        reason: 'Wrong.',
      },
      (v) => v,
    );
    expect(candidate.editDiff).toBeNull();
  });

  it('carries the decision and reason through unchanged', () => {
    const candidate = buildCorrectionCandidate(
      {
        agentId: 'CE-05',
        input: {},
        context: {},
        decision: 'EDITED',
        reason: 'Fixed wording.',
      },
      (v) => v,
    );
    expect(candidate.decision).toBe('EDITED');
    expect(candidate.reason).toBe('Fixed wording.');
  });
});

describe('acceptCorrectionCandidate', () => {
  it('produces a real, validated EvalCase with source: correction', () => {
    const candidate = buildCorrectionCandidate(
      {
        agentId: 'CE-05',
        input: { topic: 'fractions' },
        context: {},
        decision: 'EDITED',
        reason: 'x',
      },
      (v) => v,
    );
    const evalCase = acceptCorrectionCandidate(candidate, 'correction-001', [
      { type: 'exact_match', field: 'status', value: 'ok' },
    ]);
    expect(evalCase.id).toBe('correction-001');
    expect(evalCase.agentId).toBe('CE-05');
    expect(evalCase.source).toBe('correction');
    expect(evalCase.expectations).toHaveLength(1);
  });

  it('carries optional rubric and tags through', () => {
    const candidate = buildCorrectionCandidate(
      { agentId: 'CE-05', input: {}, context: {}, decision: 'REJECTED', reason: 'x' },
      (v) => v,
    );
    const evalCase = acceptCorrectionCandidate(
      candidate,
      'correction-002',
      [{ type: 'llm_judge', minScore: 4 }],
      { rubric: 'Score 1-5.', tags: ['regression'] },
    );
    expect(evalCase.rubric).toBe('Score 1-5.');
    expect(evalCase.tags).toEqual(['regression']);
  });

  it('throws when the human-supplied expectations are empty, the same as validateEvalCase', () => {
    const candidate = buildCorrectionCandidate(
      { agentId: 'CE-05', input: {}, context: {}, decision: 'REJECTED', reason: 'x' },
      (v) => v,
    );
    expect(() => acceptCorrectionCandidate(candidate, 'correction-003', [])).toThrow();
  });
});
