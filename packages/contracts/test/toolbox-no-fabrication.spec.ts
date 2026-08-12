// No-fabrication tests — Stage 11 step 8.
//
// "No fabricated sources, statistics or quotations. Any citation must resolve to a
// supplied document." — Stage 11 strict parameters.
// "A no-fabrication test over a corpus with no supporting source." — Step 8 test requirement.
//
// These tests exercise the contract-level enforcement of the no-fabrication rule:
// 1. Every TB agent's ok result requires citedSourceIds (min 1) — an ok output with
//    no citations is a schema violation.
// 2. The no_source_document status is the correct schema path when no source documents
//    are supplied to the agent — it is a first-class outcome, not an error.
// 3. An ok result with an empty citedSourceIds array is rejected — there is no escape
//    hatch for outputting unsourced content.
//
// These are schema-level tests, not live model invocations. They assert that the
// contract makes fabrication structurally impossible: any output claiming ok status
// must carry at least one citation, and any call without sources must produce
// no_source_document rather than a fabricated ok result.

import { describe, expect, it } from 'vitest';

import {
  TB01Result,
  TB02Result,
  TB03Result,
  TB04Result,
  TB08Result,
  TB09Result,
  TB10Result,
  TB11Result,
} from '../src/toolbox/index.js';

const UUID = '11111111-2222-3333-4444-555555555555';
const LINKAGE = { capsTopicId: 'CAPS-NS-GR5-WATER', lessonId: UUID };
const BAND = { minGrade: 4, maxGrade: 6 };
const READABILITY_OK = {
  verdict: 'within_band' as const,
  measuredGrade: 5,
  targetBand: BAND,
};

// ---------------------------------------------------------------------------
// no_source_document — the correct response when no corpus is supplied
// ---------------------------------------------------------------------------

describe('no_source_document is the correct schema outcome when no sources exist', () => {
  const noSourceResult = {
    status: 'no_source_document',
    detail: 'No source documents were supplied. Cannot ground output without a corpus.',
  };

  // TB05 uses verified/disagreement_flagged; TB06 uses no_source_content — excluded here.
  it.each([
    TB01Result,
    TB02Result,
    TB03Result,
    TB04Result,
    TB08Result,
    TB09Result,
    TB10Result,
    TB11Result,
  ] as const)('agent result schema %# accepts no_source_document status', (schema) => {
    expect(schema.safeParse(noSourceResult).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ok result requires citedSourceIds — no escape hatch for unsourced content
// ---------------------------------------------------------------------------

describe('TB01Result — citedSourceIds is required on ok; empty array is rejected', () => {
  const baseOk = {
    status: 'ok',
    artefactId: UUID,
    artefactType: 'WORKSHEET',
    linkage: LINKAGE,
    sections: [{ title: 'Section A', questions: ['Q1'] }],
    differentiationTier: 'STANDARD',
    readabilityCheckResult: READABILITY_OK,
    citedSourceIds: ['doc-001'],
  };

  it('accepts an ok result with at least one cited source', () => {
    expect(TB01Result.safeParse(baseOk).success).toBe(true);
  });

  it('rejects an ok result with an empty citedSourceIds — no-fabrication guard', () => {
    expect(TB01Result.safeParse({ ...baseOk, citedSourceIds: [] }).success).toBe(false);
  });

  it('rejects an ok result missing citedSourceIds entirely', () => {
    const { citedSourceIds: _c, ...rest } = baseOk;
    expect(TB01Result.safeParse(rest).success).toBe(false);
  });
});

describe('TB11Result — citedSourceIds is required on ok; empty array is rejected', () => {
  const baseOk = {
    status: 'ok',
    artefactId: UUID,
    artefactType: 'VISUAL_BRIEF',
    linkage: LINKAGE,
    brief: 'An illustration of the water cycle showing evaporation and condensation.',
    pedagogicalPurpose: 'Reinforce understanding of the evaporation stage.',
    citedSourceIds: ['doc-water-001'],
  };

  it('accepts an ok result with at least one cited source', () => {
    expect(TB11Result.safeParse(baseOk).success).toBe(true);
  });

  it('rejects an ok result with an empty citedSourceIds — no-fabrication guard', () => {
    expect(TB11Result.safeParse({ ...baseOk, citedSourceIds: [] }).success).toBe(false);
  });
});

describe('TB03Result — citedSourceIds is required on ok', () => {
  const baseOk = {
    status: 'ok',
    artefactId: UUID,
    artefactType: 'READING_PASSAGE',
    linkage: LINKAGE,
    title: 'The Water Cycle',
    body: 'Water evaporates from the surface of lakes when heated by the sun.',
    wordCount: 13,
    readabilityCheckResult: READABILITY_OK,
    isDecodable: false,
    citedSourceIds: ['doc-001'],
  };

  it('accepts an ok result with citations', () => {
    expect(TB03Result.safeParse(baseOk).success).toBe(true);
  });

  it('rejects an ok result with zero citations', () => {
    expect(TB03Result.safeParse({ ...baseOk, citedSourceIds: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// needs_input — the correct path when linkage is missing (not fabrication)
// ---------------------------------------------------------------------------

describe('needs_input is the correct schema path when required fields are absent', () => {
  const needsInput = {
    status: 'needs_input',
    detail:
      'Both lessonId and interventionId are absent. Cannot produce a grounded artefact.',
    missingFields: ['lessonId'],
  };

  it('TB01Result accepts needs_input', () => {
    expect(TB01Result.safeParse(needsInput).success).toBe(true);
  });

  it('TB11Result accepts needs_input', () => {
    expect(TB11Result.safeParse(needsInput).success).toBe(true);
  });

  it('needs_input has no artefactId — no artefact was produced', () => {
    const parsed = TB01Result.parse(needsInput);
    expect(parsed).not.toHaveProperty('artefactId');
  });
});
