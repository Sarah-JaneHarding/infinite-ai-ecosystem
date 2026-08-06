import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  EvalCaseError,
  Expectation,
  MUST_NOT_REGRESS_TAG,
  SAFETY_TAGS,
  validateEvalCase,
} from '../src/case.js';

function validCase(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'ce-05-topic-alignment-001',
    agentId: 'CE-05',
    input: { topic: 'fractions' },
    context: { retrievedFacts: ['caps-math-g6-fractions'] },
    expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
    tags: ['regression'],
    source: 'specification',
    ...overrides,
  };
}

describe('validateEvalCase', () => {
  it('accepts a fully-declared case and returns it parsed', () => {
    const parsed = validateEvalCase(validCase());
    expect(parsed.id).toBe('ce-05-topic-alignment-001');
    expect(parsed.agentId).toBe('CE-05');
    expect(parsed.source).toBe('specification');
  });

  it('accepts every declared source value', () => {
    for (const source of ['specification', 'correction', 'incident']) {
      expect(validateEvalCase(validCase({ source })).source).toBe(source);
    }
  });

  it('accepts an optional rubric', () => {
    const parsed = validateEvalCase(
      validCase({
        expectations: [{ type: 'llm_judge', minScore: 4, criterion: 'tone' }],
        rubric: 'Score 1-5 on how age-appropriate the tone is for Grade 6.',
      }),
    );
    expect(parsed.rubric).toContain('age-appropriate');
  });

  it('accepts a case with no rubric at all', () => {
    const parsed = validateEvalCase(validCase());
    expect(parsed.rubric).toBeUndefined();
  });

  it('throws when a required field is missing entirely', () => {
    const { tags: _omitted, ...withoutTags } = validCase() as Record<string, unknown>;
    expect(() => validateEvalCase(withoutTags)).toThrow(EvalCaseError);
  });

  it('throws when source is not one of the declared values', () => {
    expect(() => validateEvalCase(validCase({ source: 'guess' }))).toThrow(EvalCaseError);
  });

  it('throws when expectations is empty', () => {
    expect(() => validateEvalCase(validCase({ expectations: [] }))).toThrow(
      EvalCaseError,
    );
  });

  it('throws when an expectation has an unrecognised type', () => {
    expect(() =>
      validateEvalCase(validCase({ expectations: [{ type: 'vibes_check' }] })),
    ).toThrow(EvalCaseError);
  });

  it('throws when a tag is an empty string', () => {
    expect(() => validateEvalCase(validCase({ tags: [''] }))).toThrow(EvalCaseError);
  });
});

describe('Expectation', () => {
  it('accepts a json_schema expectation carrying a real Zod schema', () => {
    const result = Expectation.safeParse({
      type: 'json_schema',
      schema: z.object({ plan: z.string() }),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a json_schema expectation whose schema is not a real Zod instance', () => {
    const result = Expectation.safeParse({
      type: 'json_schema',
      schema: { type: 'object' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a numeric_tolerance expectation', () => {
    const result = Expectation.safeParse({
      type: 'numeric_tolerance',
      field: 'score',
      expected: 10,
      tolerance: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a numeric_tolerance expectation with a negative tolerance', () => {
    const result = Expectation.safeParse({
      type: 'numeric_tolerance',
      field: 'score',
      expected: 10,
      tolerance: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a set_overlap expectation', () => {
    const result = Expectation.safeParse({
      type: 'set_overlap',
      field: 'topics',
      expectedSet: ['fractions', 'decimals'],
      minOverlap: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a set_overlap expectation with minOverlap outside 0-1', () => {
    const result = Expectation.safeParse({
      type: 'set_overlap',
      field: 'topics',
      expectedSet: ['fractions'],
      minOverlap: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a refusal_correctness expectation with no expectedReasonCode', () => {
    const result = Expectation.safeParse({
      type: 'refusal_correctness',
      shouldRefuse: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a citation_presence expectation', () => {
    const result = Expectation.safeParse({
      type: 'citation_presence',
      minCitations: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a citation_presence expectation with a non-positive minCitations', () => {
    const result = Expectation.safeParse({
      type: 'citation_presence',
      minCitations: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a readability_band expectation', () => {
    const result = Expectation.safeParse({
      type: 'readability_band',
      minGrade: -5,
      maxGrade: 8,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a template_fidelity expectation', () => {
    const result = Expectation.safeParse({
      type: 'template_fidelity',
      templateId: 'lesson-plan-v2',
    });
    expect(result.success).toBe(true);
  });
});

describe('well-known tag vocabulary', () => {
  it('MUST_NOT_REGRESS_TAG is a stable string, safe to use as a real case tag', () => {
    expect(MUST_NOT_REGRESS_TAG).toBe('must_not_regress');
    expect(validateEvalCase(validCase({ tags: [MUST_NOT_REGRESS_TAG] })).tags).toEqual([
      'must_not_regress',
    ]);
  });

  it('SAFETY_TAGS names all six categories step 7 asks for, each usable as a real tag', () => {
    expect(SAFETY_TAGS).toHaveLength(6);
    for (const tag of SAFETY_TAGS) {
      expect(validateEvalCase(validCase({ tags: [tag] })).tags).toEqual([tag]);
    }
  });
});
