import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { Expectation } from '../src/case.js';
import {
  scoreCitationPresence,
  scoreExactMatch,
  scoreExpectation,
  scoreJsonSchema,
  scoreLlmJudge,
  scoreNumericTolerance,
  scoreReadabilityBand,
  scoreRefusalCorrectness,
  scoreSetOverlap,
  scoreTemplateFidelity,
  type LlmJudge,
} from '../src/scorers.js';

function expectation<T extends Expectation['type']>(
  candidate: Extract<Expectation, { type: T }>,
): Extract<Expectation, { type: T }> {
  return candidate;
}

describe('scoreExactMatch', () => {
  it('passes when the field matches exactly', () => {
    const result = scoreExactMatch(
      expectation({ type: 'exact_match', field: 'status', value: 'ok' }),
      { status: 'ok' },
    );
    expect(result.passed).toBe(true);
  });

  it('fails when the field differs', () => {
    const result = scoreExactMatch(
      expectation({ type: 'exact_match', field: 'status', value: 'ok' }),
      { status: 'error' },
    );
    expect(result.passed).toBe(false);
  });

  it('fails when the field is missing entirely', () => {
    const result = scoreExactMatch(
      expectation({ type: 'exact_match', field: 'status', value: 'ok' }),
      {},
    );
    expect(result.passed).toBe(false);
  });

  it('matches nested dot paths', () => {
    const result = scoreExactMatch(
      expectation({ type: 'exact_match', field: 'plan.title', value: 'Fractions' }),
      { plan: { title: 'Fractions' } },
    );
    expect(result.passed).toBe(true);
  });
});

describe('scoreJsonSchema', () => {
  const schema = z.object({ plan: z.string() });

  it('passes when the output conforms', () => {
    const result = scoreJsonSchema(expectation({ type: 'json_schema', schema }), {
      plan: 'A lesson plan.',
    });
    expect(result.passed).toBe(true);
  });

  it('fails when the output does not conform', () => {
    const result = scoreJsonSchema(expectation({ type: 'json_schema', schema }), {
      plan: 42,
    });
    expect(result.passed).toBe(false);
  });
});

describe('scoreNumericTolerance', () => {
  const base = expectation({
    type: 'numeric_tolerance',
    field: 'score',
    expected: 10,
    tolerance: 0.5,
  });

  it('passes within tolerance', () => {
    expect(scoreNumericTolerance(base, { score: 10.3 }).passed).toBe(true);
  });

  it('fails outside tolerance', () => {
    expect(scoreNumericTolerance(base, { score: 12 }).passed).toBe(false);
  });

  it('fails when the field is not a number', () => {
    expect(scoreNumericTolerance(base, { score: 'ten' }).passed).toBe(false);
  });
});

describe('scoreSetOverlap', () => {
  const base = expectation({
    type: 'set_overlap',
    field: 'topics',
    expectedSet: ['fractions', 'decimals', 'percentages'],
    minOverlap: 0.6,
  });

  it('passes at or above the overlap threshold', () => {
    const result = scoreSetOverlap(base, { topics: ['fractions', 'decimals', 'ratios'] });
    expect(result.passed).toBe(true);
    expect(result.score).toBeCloseTo(2 / 3);
  });

  it('fails below the overlap threshold', () => {
    const result = scoreSetOverlap(base, { topics: ['fractions'] });
    expect(result.passed).toBe(false);
    expect(result.score).toBeCloseTo(1 / 3);
  });

  it('an unexpected extra member does not itself count against overlap', () => {
    const result = scoreSetOverlap(base, {
      topics: ['fractions', 'decimals', 'percentages', 'algebra'],
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when the field is not an array', () => {
    expect(scoreSetOverlap(base, { topics: 'fractions' }).passed).toBe(false);
  });
});

describe('scoreReadabilityBand', () => {
  it('passes text within the band, read from a field', () => {
    const result = scoreReadabilityBand(
      expectation({
        type: 'readability_band',
        minGrade: -5,
        maxGrade: 8,
        field: 'summary',
      }),
      { summary: 'The cat sat on the mat.' },
    );
    expect(result.passed).toBe(true);
  });

  it('scores the output itself as text when field is omitted', () => {
    const result = scoreReadabilityBand(
      expectation({ type: 'readability_band', minGrade: -5, maxGrade: 8 }),
      'The cat sat on the mat.',
    );
    expect(result.passed).toBe(true);
  });

  it('fails when the grade level is outside the band', () => {
    const result = scoreReadabilityBand(
      expectation({ type: 'readability_band', minGrade: 0, maxGrade: 1 }),
      'The comprehensive institutional framework necessitates multidisciplinary collaboration.',
    );
    expect(result.passed).toBe(false);
  });

  it('fails when the resolved value is not a string', () => {
    const result = scoreReadabilityBand(
      expectation({
        type: 'readability_band',
        minGrade: -5,
        maxGrade: 8,
        field: 'summary',
      }),
      { summary: 42 },
    );
    expect(result.passed).toBe(false);
  });
});

describe('scoreTemplateFidelity', () => {
  const base = expectation({ type: 'template_fidelity', templateId: 'lesson-plan-v2' });

  it('passes (inconclusively) when no checker is registered for the template', () => {
    const result = scoreTemplateFidelity(base, { anything: true });
    expect(result.passed).toBe(true);
  });

  it('defers to a registered checker', () => {
    const checkers = {
      'lesson-plan-v2': (output: unknown) => (output as { ok: boolean }).ok,
    };
    expect(scoreTemplateFidelity(base, { ok: true }, checkers).passed).toBe(true);
    expect(scoreTemplateFidelity(base, { ok: false }, checkers).passed).toBe(false);
  });
});

describe('scoreCitationPresence', () => {
  const base = expectation({
    type: 'citation_presence',
    minCitations: 1,
    citedIdsField: 'citedIds',
    validIds: ['fact-1', 'fact-2'],
  });

  it('passes when enough citations are present and all resolve', () => {
    const result = scoreCitationPresence(base, { citedIds: ['fact-1'] });
    expect(result.passed).toBe(true);
  });

  it('fails when fewer citations are present than required', () => {
    const result = scoreCitationPresence(base, { citedIds: [] });
    expect(result.passed).toBe(false);
  });

  it('fails when a citation does not resolve to a valid id', () => {
    const result = scoreCitationPresence(base, { citedIds: ['fact-1', 'fact-99'] });
    expect(result.passed).toBe(false);
  });

  it('fails when the field is not a string array', () => {
    expect(scoreCitationPresence(base, { citedIds: 'fact-1' }).passed).toBe(false);
  });
});

describe('scoreRefusalCorrectness', () => {
  it('passes when a refusal was expected and one was given, matching the reason code', () => {
    const result = scoreRefusalCorrectness(
      expectation({
        type: 'refusal_correctness',
        shouldRefuse: true,
        expectedReasonCode: 'age_inappropriate',
      }),
      {
        refusal: {
          code: 'age_inappropriate',
          explanation: 'Not appropriate for this grade.',
          escalation: null,
        },
      },
    );
    expect(result.passed).toBe(true);
  });

  it('fails when a refusal was expected but the agent did not refuse', () => {
    const result = scoreRefusalCorrectness(
      expectation({ type: 'refusal_correctness', shouldRefuse: true }),
      {},
    );
    expect(result.passed).toBe(false);
  });

  it('fails when no refusal was expected but the agent refused', () => {
    const result = scoreRefusalCorrectness(
      expectation({ type: 'refusal_correctness', shouldRefuse: false }),
      {
        refusal: {
          code: 'cost_budget_exceeded',
          explanation: 'Too expensive.',
          escalation: null,
        },
      },
    );
    expect(result.passed).toBe(false);
  });

  it('fails when the refusal reason code does not match', () => {
    const result = scoreRefusalCorrectness(
      expectation({
        type: 'refusal_correctness',
        shouldRefuse: true,
        expectedReasonCode: 'age_inappropriate',
      }),
      {
        refusal: {
          code: 'cost_budget_exceeded',
          explanation: 'Too expensive.',
          escalation: null,
        },
      },
    );
    expect(result.passed).toBe(false);
  });

  it('fails when the claimed refusal does not match the required shape', () => {
    const result = scoreRefusalCorrectness(
      expectation({ type: 'refusal_correctness', shouldRefuse: true }),
      { refusal: { code: 'not_a_real_code' } },
    );
    expect(result.passed).toBe(false);
  });

  it('reads a custom refusalField when supplied', () => {
    const result = scoreRefusalCorrectness(
      expectation({
        type: 'refusal_correctness',
        shouldRefuse: true,
        refusalField: 'decision.refusal',
      }),
      {
        decision: {
          refusal: {
            code: 'cost_budget_exceeded',
            explanation: 'Too expensive.',
            escalation: null,
          },
        },
      },
    );
    expect(result.passed).toBe(true);
  });
});

describe('scoreLlmJudge', () => {
  const base = expectation({ type: 'llm_judge', minScore: 4 });

  it('fails when no rubric is supplied on the case', () => {
    return scoreLlmJudge(base, {}, undefined, async () => ({
      score: 5,
      rationale: 'x',
    })).then((result) => expect(result.passed).toBe(false));
  });

  it('fails when no LlmJudge implementation is supplied', async () => {
    const result = await scoreLlmJudge(base, {}, 'Score 1-5.', undefined);
    expect(result.passed).toBe(false);
  });

  it('passes when the injected judge scores at or above minScore', async () => {
    const judge: LlmJudge = async () => ({ score: 4, rationale: 'Meets the bar.' });
    const result = await scoreLlmJudge(base, { text: 'hi' }, 'Score 1-5.', judge);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(4);
  });

  it('fails when the injected judge scores below minScore', async () => {
    const judge: LlmJudge = async () => ({ score: 2, rationale: 'Too terse.' });
    const result = await scoreLlmJudge(base, { text: 'hi' }, 'Score 1-5.', judge);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(2);
  });
});

describe('scoreExpectation', () => {
  it('dispatches a sync scorer type correctly', async () => {
    const result = await scoreExpectation(
      expectation({ type: 'exact_match', field: 'status', value: 'ok' }),
      { status: 'ok' },
    );
    expect(result.passed).toBe(true);
  });

  it('dispatches the async llm_judge scorer correctly, threading rubric and judge through options', async () => {
    const judge: LlmJudge = async (rubric) => ({
      score: rubric.includes('age-appropriate') ? 5 : 1,
      rationale: 'x',
    });
    const result = await scoreExpectation(
      expectation({ type: 'llm_judge', minScore: 4 }),
      {},
      { rubric: 'Score how age-appropriate the tone is.', judge },
    );
    expect(result.passed).toBe(true);
  });

  it('threads templateFidelityCheckers through for template_fidelity', async () => {
    const result = await scoreExpectation(
      expectation({ type: 'template_fidelity', templateId: 't1' }),
      { ok: false },
      { templateFidelityCheckers: { t1: (output) => (output as { ok: boolean }).ok } },
    );
    expect(result.passed).toBe(false);
  });
});
