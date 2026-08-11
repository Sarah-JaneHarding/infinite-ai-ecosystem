// Readability band tests per language — Stage 11 step 8.
//
// "Reading level is measured, not estimated: run a readability metric appropriate to the
// language and assert the grade band. Out of band is a hard failure."
//
// These tests verify the ReadabilityCheckInput and ReadabilityCheckResult schemas for:
// 1. Each of the four verdict types (within_band, below_band, above_band, cannot_measure).
// 2. Each of the eleven official South African languages as valid input.
// 3. That the `cannot_measure` verdict correctly records the language and reason.
//
// The Flesch-Kincaid metric (packages/guardrails/src/readability.ts) is English-only;
// agents producing output in other languages must return `cannot_measure` until a
// validated per-language metric is available (per TB-06 design: mark as human-review-
// required rather than shipping with an unchecked reading level). These tests assert
// the schema contract for that behaviour — not a live metric invocation.

import { describe, expect, it } from 'vitest';

import {
  GradeBand,
  ReadabilityCheckInput,
  ReadabilityCheckResult,
} from '../src/toolbox/index.js';

// The eleven official South African languages (ISO 639-1 codes).
const SA_OFFICIAL_LANGUAGES = [
  'en',
  'af',
  'zu',
  'xh',
  'st',
  'tn',
  'nso',
  've',
  'ts',
  'ss',
  'nr',
];

// Representative grade bands for each school phase.
const FOUNDATION_BAND = { minGrade: 0, maxGrade: 3 };
const INTERMEDIATE_BAND = { minGrade: 4, maxGrade: 6 };
const SENIOR_BAND = { minGrade: 7, maxGrade: 9 };
const FET_BAND = { minGrade: 10, maxGrade: 12 };

describe('GradeBand', () => {
  it('accepts valid grade bands for each school phase', () => {
    for (const band of [FOUNDATION_BAND, INTERMEDIATE_BAND, SENIOR_BAND, FET_BAND]) {
      expect(GradeBand.safeParse(band).success).toBe(true);
    }
  });

  it('rejects a band where maxGrade is less than minGrade', () => {
    expect(GradeBand.safeParse({ minGrade: 7, maxGrade: 4 }).success).toBe(false);
  });

  it('accepts a point band (minGrade === maxGrade)', () => {
    expect(GradeBand.safeParse({ minGrade: 5, maxGrade: 5 }).success).toBe(true);
  });
});

describe('ReadabilityCheckInput per language', () => {
  it.each(SA_OFFICIAL_LANGUAGES)(
    'accepts a valid check input for language %s',
    (lang) => {
      const input: unknown = {
        text: 'The sun rises in the east.',
        targetBand: INTERMEDIATE_BAND,
        language: lang,
      };
      expect(ReadabilityCheckInput.safeParse(input).success).toBe(true);
    },
  );

  it('rejects input with empty text', () => {
    expect(
      ReadabilityCheckInput.safeParse({
        text: '',
        targetBand: INTERMEDIATE_BAND,
        language: 'en',
      }).success,
    ).toBe(false);
  });

  it('rejects input with an invalid (too-short) language code', () => {
    expect(
      ReadabilityCheckInput.safeParse({
        text: 'Some text.',
        targetBand: INTERMEDIATE_BAND,
        language: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('ReadabilityCheckResult — within_band verdict', () => {
  it('accepts a within_band result for an intermediate band', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'within_band',
        measuredGrade: 5.2,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(true);
  });

  it('accepts a within_band result at the band boundary (minGrade)', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'within_band',
        measuredGrade: 4.0,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(true);
  });

  it('accepts a within_band result at the band boundary (maxGrade)', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'within_band',
        measuredGrade: 6.0,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(true);
  });
});

describe('ReadabilityCheckResult — below_band verdict', () => {
  it('accepts a below_band result for Foundation Phase text measured against Intermediate', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'below_band',
        measuredGrade: 2.1,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(true);
  });

  it('accepts a below_band result for FET text measured below FET band', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'below_band',
        measuredGrade: 8.5,
        targetBand: FET_BAND,
      }).success,
    ).toBe(true);
  });
});

describe('ReadabilityCheckResult — above_band verdict', () => {
  it('accepts an above_band result for complex text measured against Foundation band', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'above_band',
        measuredGrade: 11.4,
        targetBand: FOUNDATION_BAND,
      }).success,
    ).toBe(true);
  });

  it('accepts an above_band result for Senior Phase text measured against Intermediate', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'above_band',
        measuredGrade: 9.8,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(true);
  });
});

describe('ReadabilityCheckResult — cannot_measure verdict', () => {
  it.each(SA_OFFICIAL_LANGUAGES.filter((l) => l !== 'en'))(
    'accepts cannot_measure for language %s — no validated metric available yet',
    (lang) => {
      expect(
        ReadabilityCheckResult.safeParse({
          verdict: 'cannot_measure',
          language: lang,
          reason: `No validated readability metric is available for language "${lang}". Marking as human-review-required.`,
        }).success,
      ).toBe(true);
    },
  );

  it('rejects cannot_measure with an empty reason', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'cannot_measure',
        language: 'af',
        reason: '',
      }).success,
    ).toBe(false);
  });

  it('cannot_measure result records the language that was attempted', () => {
    const result = ReadabilityCheckResult.parse({
      verdict: 'cannot_measure',
      language: 'zu',
      reason: 'No Zulu readability metric available.',
    });
    if (result.verdict === 'cannot_measure') {
      expect(result.language).toBe('zu');
    }
  });
});

describe('ReadabilityCheckResult schema rejects unknown verdicts', () => {
  it('rejects a result with an unknown verdict', () => {
    expect(
      ReadabilityCheckResult.safeParse({
        verdict: 'undetermined',
        measuredGrade: 5,
        targetBand: INTERMEDIATE_BAND,
      }).success,
    ).toBe(false);
  });
});
