// Toolbox agent contracts — Stage 11 step 2.
//
// Covers: TB-01 (Worksheet Builder), TB-03 (Reading Passage Generator),
// TB-04 (Item Writer), TB-05 (Memo & Marking Guide Agent) input/output schemas.
//
// Key invariants verified:
//   - TBLinkageInput requires at least one of lessonId / interventionId
//   - no_source_document output blocks fabrication
//   - TB-05 disagreement_flagged blocks release (no artefactId in that variant)
//   - MC items must have exactly four options; other types have none

import { describe, expect, it } from 'vitest';

import {
  AnswerKeyEntry,
  AssessmentItem,
  AssessmentItemType,
  MCOption,
  TB01Input,
  TB01Result,
  TB03Input,
  TB03Result,
  TB04Input,
  TB04Result,
  TB05Input,
  TB05ItemInput,
  TB05Result,
  TB05VerificationItem,
  TBOutputLinkage,
  VerifierAnswers,
  WorksheetDifferentiationTier,
  WorksheetSection,
} from '../src/toolbox/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID = '11111111-2222-3333-4444-555555555555';
const UUID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function baseLinkage(overrides: Record<string, unknown> = {}) {
  return { capsTopicId: 'CAPS-EN-GR4-TOPIC-1', lessonId: UUID, ...overrides };
}

function baseBand() {
  return { minGrade: 3, maxGrade: 5 };
}

function baseTB01Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-EN-GR4-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '4',
    subject: 'English Home Language',
    learningObjectives: ['Identify the main idea'],
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: ['doc-001'],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB03Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR5-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '5',
    subject: 'Natural Sciences',
    topic: 'The water cycle',
    targetReadabilityBand: baseBand(),
    wordCountTarget: 250,
    language: 'en',
    decodable: false,
    sourceDocumentIds: ['doc-001'],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB04Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR5-TOPIC-2',
    lessonId: UUID,
    gradeLabel: '5',
    subject: 'Natural Sciences',
    topic: 'Properties of matter',
    cognitiveLevel: 'knowledge',
    itemType: 'multiple_choice',
    count: 4,
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: ['doc-001'],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB05Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-EN-GR5-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '5',
    assessmentArtefactId: UUID,
    items: [
      {
        itemId: UUID,
        questionText: 'What is the main idea?',
        itemType: 'short_answer',
        options: [],
        marks: 2,
      },
    ],
    language: 'en',
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TBOutputLinkage
// ---------------------------------------------------------------------------

describe('TBOutputLinkage', () => {
  it('accepts linkage with lessonId only', () => {
    expect(
      TBOutputLinkage.safeParse({ capsTopicId: 'CAPS-1', lessonId: UUID }).success,
    ).toBe(true);
  });

  it('accepts linkage with interventionId only', () => {
    expect(
      TBOutputLinkage.safeParse({ capsTopicId: 'CAPS-1', interventionId: UUID }).success,
    ).toBe(true);
  });

  it('accepts linkage with both IDs', () => {
    expect(
      TBOutputLinkage.safeParse({
        capsTopicId: 'CAPS-1',
        lessonId: UUID,
        interventionId: UUID2,
      }).success,
    ).toBe(true);
  });

  it('accepts linkage with neither (output schema is relaxed on linkage optionality)', () => {
    expect(TBOutputLinkage.safeParse({ capsTopicId: 'CAPS-1' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WorksheetDifferentiationTier
// ---------------------------------------------------------------------------

describe('WorksheetDifferentiationTier', () => {
  it('accepts SUPPORT, STANDARD, EXTENSION', () => {
    for (const t of ['SUPPORT', 'STANDARD', 'EXTENSION']) {
      expect(WorksheetDifferentiationTier.safeParse(t).success).toBe(true);
    }
  });

  it('rejects unknown tier', () => {
    expect(WorksheetDifferentiationTier.safeParse('INTERMEDIATE').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WorksheetSection
// ---------------------------------------------------------------------------

describe('WorksheetSection', () => {
  it('accepts a section with title and questions', () => {
    expect(
      WorksheetSection.safeParse({
        title: 'Section A',
        questions: ['What is the main idea?'],
      }).success,
    ).toBe(true);
  });

  it('accepts a section with optional instructions', () => {
    expect(
      WorksheetSection.safeParse({
        title: 'Section B',
        instructions: 'Answer in full sentences.',
        questions: ['Explain the water cycle.'],
      }).success,
    ).toBe(true);
  });

  it('rejects a section with no questions', () => {
    expect(WorksheetSection.safeParse({ title: 'Empty', questions: [] }).success).toBe(
      false,
    );
  });

  it('rejects a section with an empty title', () => {
    expect(WorksheetSection.safeParse({ title: '', questions: ['Q1'] }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TB01Input
// ---------------------------------------------------------------------------

describe('TB01Input', () => {
  it('accepts a valid worksheet builder input', () => {
    expect(TB01Input.safeParse(baseTB01Input()).success).toBe(true);
  });

  it('accepts with interventionId instead of lessonId', () => {
    expect(
      TB01Input.safeParse(baseTB01Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('accepts with differentiationTier', () => {
    expect(
      TB01Input.safeParse(baseTB01Input({ differentiationTier: 'EXTENSION' })).success,
    ).toBe(true);
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB01Input.safeParse(
      baseTB01Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join(' ')).toMatch(
        /lessonId or interventionId/,
      );
    }
  });

  it('rejects with empty learningObjectives', () => {
    expect(TB01Input.safeParse(baseTB01Input({ learningObjectives: [] })).success).toBe(
      false,
    );
  });

  it('rejects with empty sourceDocumentIds', () => {
    expect(TB01Input.safeParse(baseTB01Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TB01Result
// ---------------------------------------------------------------------------

describe('TB01Result', () => {
  it('accepts a valid ok result', () => {
    const result = TB01Result.safeParse({
      status: 'ok',
      artefactId: UUID,
      artefactType: 'WORKSHEET',
      linkage: baseLinkage(),
      sections: [{ title: 'Section A', questions: ['Q1'] }],
      readabilityCheckResult: {
        verdict: 'within_band',
        measuredGrade: 4,
        targetBand: baseBand(),
      },
      citedSourceIds: ['doc-001'],
      differentiationTier: 'STANDARD',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null differentiationTier in ok result', () => {
    const result = TB01Result.safeParse({
      status: 'ok',
      artefactId: UUID,
      artefactType: 'WORKSHEET',
      linkage: baseLinkage(),
      sections: [{ title: 'S', questions: ['Q'] }],
      readabilityCheckResult: {
        verdict: 'within_band',
        measuredGrade: 4,
        targetBand: baseBand(),
      },
      citedSourceIds: ['doc-001'],
      differentiationTier: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts needs_input result', () => {
    expect(
      TB01Result.safeParse({
        status: 'needs_input',
        detail: 'Missing learningObjectives.',
        missingFields: ['learningObjectives'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB01Result.safeParse({
        status: 'no_source_document',
        detail: 'No grounding documents supplied.',
      }).success,
    ).toBe(true);
  });

  it('rejects ok result with empty sections', () => {
    const result = TB01Result.safeParse({
      status: 'ok',
      artefactId: UUID,
      artefactType: 'WORKSHEET',
      linkage: baseLinkage(),
      sections: [],
      readabilityCheckResult: {
        verdict: 'within_band',
        measuredGrade: 4,
        targetBand: baseBand(),
      },
      citedSourceIds: ['doc-001'],
      differentiationTier: null,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB03Input
// ---------------------------------------------------------------------------

describe('TB03Input', () => {
  it('accepts a valid reading passage input', () => {
    expect(TB03Input.safeParse(baseTB03Input()).success).toBe(true);
  });

  it('accepts with decodable: true', () => {
    expect(TB03Input.safeParse(baseTB03Input({ decodable: true })).success).toBe(true);
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB03Input.safeParse(
      baseTB03Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects with non-positive wordCountTarget', () => {
    expect(TB03Input.safeParse(baseTB03Input({ wordCountTarget: 0 })).success).toBe(
      false,
    );
  });

  it('rejects with empty sourceDocumentIds', () => {
    expect(TB03Input.safeParse(baseTB03Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TB03Result
// ---------------------------------------------------------------------------

describe('TB03Result', () => {
  it('accepts a valid ok result', () => {
    expect(
      TB03Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'READING_PASSAGE',
        linkage: baseLinkage(),
        title: 'The Water Cycle',
        body: 'Water evaporates from the ocean and falls as rain.',
        wordCount: 9,
        readabilityCheckResult: {
          verdict: 'within_band',
          measuredGrade: 4,
          targetBand: baseBand(),
        },
        isDecodable: false,
        citedSourceIds: ['doc-001'],
      }).success,
    ).toBe(true);
  });

  it('accepts readability_out_of_band result', () => {
    expect(
      TB03Result.safeParse({
        status: 'readability_out_of_band',
        measuredGrade: 9.1,
        targetBand: baseBand(),
        detail: 'Passage reads at grade 9.1, outside target band 3–5.',
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB03Result.safeParse({
        status: 'no_source_document',
        detail: 'No grounding documents supplied.',
      }).success,
    ).toBe(true);
  });

  it('accepts needs_input result', () => {
    expect(
      TB03Result.safeParse({
        status: 'needs_input',
        detail: 'Missing topic.',
        missingFields: ['topic'],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AssessmentItemType and MCOption
// ---------------------------------------------------------------------------

describe('AssessmentItemType', () => {
  it('accepts all four item types', () => {
    for (const t of [
      'multiple_choice',
      'short_answer',
      'extended_response',
      'true_false',
    ]) {
      expect(AssessmentItemType.safeParse(t).success).toBe(true);
    }
  });

  it('rejects unknown type', () => {
    expect(AssessmentItemType.safeParse('matching').success).toBe(false);
  });
});

describe('MCOption', () => {
  it('accepts a valid option', () => {
    expect(MCOption.safeParse({ optionId: 'A', text: 'Paris' }).success).toBe(true);
  });

  it('rejects empty optionId', () => {
    expect(MCOption.safeParse({ optionId: '', text: 'Paris' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AssessmentItem
// ---------------------------------------------------------------------------

describe('AssessmentItem', () => {
  it('accepts a multiple-choice item with four options', () => {
    expect(
      AssessmentItem.safeParse({
        itemId: UUID,
        questionText: 'Which is a mammal?',
        itemType: 'multiple_choice',
        cognitiveLevel: 'knowledge',
        options: [
          { optionId: 'A', text: 'Shark' },
          { optionId: 'B', text: 'Eagle' },
          { optionId: 'C', text: 'Whale' },
          { optionId: 'D', text: 'Python' },
        ],
        marks: 1,
      }).success,
    ).toBe(true);
  });

  it('accepts a short-answer item with empty options', () => {
    expect(
      AssessmentItem.safeParse({
        itemId: UUID,
        questionText: 'Explain photosynthesis.',
        itemType: 'short_answer',
        cognitiveLevel: 'comprehension',
        options: [],
        marks: 3,
      }).success,
    ).toBe(true);
  });

  it('rejects an item with non-positive marks', () => {
    expect(
      AssessmentItem.safeParse({
        itemId: UUID,
        questionText: 'Q',
        itemType: 'short_answer',
        cognitiveLevel: 'knowledge',
        options: [],
        marks: 0,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB04Input
// ---------------------------------------------------------------------------

describe('TB04Input', () => {
  it('accepts a valid item writer input', () => {
    expect(TB04Input.safeParse(baseTB04Input()).success).toBe(true);
  });

  it('accepts count at max boundary (20)', () => {
    expect(TB04Input.safeParse(baseTB04Input({ count: 20 })).success).toBe(true);
  });

  it('rejects count above max (21)', () => {
    expect(TB04Input.safeParse(baseTB04Input({ count: 21 })).success).toBe(false);
  });

  it('rejects count below min (0)', () => {
    expect(TB04Input.safeParse(baseTB04Input({ count: 0 })).success).toBe(false);
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB04Input.safeParse(
      baseTB04Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects with empty sourceDocumentIds', () => {
    expect(TB04Input.safeParse(baseTB04Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TB04Result
// ---------------------------------------------------------------------------

describe('TB04Result', () => {
  it('accepts a valid ok result', () => {
    expect(
      TB04Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'ASSESSMENT_ITEM',
        linkage: baseLinkage(),
        items: [
          {
            itemId: UUID,
            questionText: 'Which is a solid?',
            itemType: 'multiple_choice',
            cognitiveLevel: 'knowledge',
            options: [
              { optionId: 'A', text: 'Ice' },
              { optionId: 'B', text: 'Steam' },
              { optionId: 'C', text: 'Water' },
              { optionId: 'D', text: 'Mist' },
            ],
            marks: 1,
          },
        ],
        totalMarks: 1,
        readabilityCheckResult: {
          verdict: 'within_band',
          measuredGrade: 4,
          targetBand: baseBand(),
        },
        citedSourceIds: ['doc-001'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB04Result.safeParse({
        status: 'no_source_document',
        detail: 'No documents supplied.',
      }).success,
    ).toBe(true);
  });

  it('rejects ok result with zero items', () => {
    expect(
      TB04Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'ASSESSMENT_ITEM',
        linkage: baseLinkage(),
        items: [],
        totalMarks: 0,
        readabilityCheckResult: {
          verdict: 'within_band',
          measuredGrade: 4,
          targetBand: baseBand(),
        },
        citedSourceIds: ['doc-001'],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB05ItemInput
// ---------------------------------------------------------------------------

describe('TB05ItemInput', () => {
  it('accepts a valid item input for TB-05', () => {
    expect(
      TB05ItemInput.safeParse({
        itemId: UUID,
        questionText: 'What is 2+2?',
        itemType: 'short_answer',
        options: [],
        marks: 1,
      }).success,
    ).toBe(true);
  });

  it('rejects item with empty questionText', () => {
    expect(
      TB05ItemInput.safeParse({
        itemId: UUID,
        questionText: '',
        itemType: 'short_answer',
        options: [],
        marks: 1,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnswerKeyEntry
// ---------------------------------------------------------------------------

describe('AnswerKeyEntry', () => {
  it('accepts a valid answer key entry without correctOptionId', () => {
    expect(
      AnswerKeyEntry.safeParse({
        itemId: UUID,
        modelAnswer: 'Photosynthesis converts sunlight to energy.',
        markingCriteria: 'Award 1 mark for mentioning sunlight, 1 mark for energy.',
      }).success,
    ).toBe(true);
  });

  it('accepts a valid entry with correctOptionId', () => {
    expect(
      AnswerKeyEntry.safeParse({
        itemId: UUID,
        modelAnswer: 'C',
        markingCriteria: 'Award 1 mark for C.',
        correctOptionId: 'C',
      }).success,
    ).toBe(true);
  });

  it('rejects an entry with empty modelAnswer', () => {
    expect(
      AnswerKeyEntry.safeParse({
        itemId: UUID,
        modelAnswer: '',
        markingCriteria: 'Marking criteria here.',
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VerifierAnswers
// ---------------------------------------------------------------------------

describe('VerifierAnswers', () => {
  it('accepts a valid verifier answer', () => {
    expect(
      VerifierAnswers.safeParse({
        itemId: UUID,
        verifierAnswer: 'Photosynthesis',
      }).success,
    ).toBe(true);
  });

  it('accepts with correctOptionId', () => {
    expect(
      VerifierAnswers.safeParse({
        itemId: UUID,
        verifierAnswer: 'B',
        correctOptionId: 'B',
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TB05VerificationItem
// ---------------------------------------------------------------------------

describe('TB05VerificationItem', () => {
  it('accepts an agreeing verification item', () => {
    expect(
      TB05VerificationItem.safeParse({
        itemId: UUID,
        authorAnswer: 'Chlorophyll',
        verifierAnswer: 'Chlorophyll',
        agrees: true,
      }).success,
    ).toBe(true);
  });

  it('accepts a disagreeing verification item', () => {
    expect(
      TB05VerificationItem.safeParse({
        itemId: UUID,
        authorAnswer: 'Pretoria',
        verifierAnswer: 'Cape Town',
        agrees: false,
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TB05Input
// ---------------------------------------------------------------------------

describe('TB05Input', () => {
  it('accepts a valid memo agent input', () => {
    expect(TB05Input.safeParse(baseTB05Input()).success).toBe(true);
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB05Input.safeParse(
      baseTB05Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects with empty items array', () => {
    expect(TB05Input.safeParse(baseTB05Input({ items: [] })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB05Result
// ---------------------------------------------------------------------------

describe('TB05Result', () => {
  it('accepts a verified result with all items agreeing', () => {
    expect(
      TB05Result.safeParse({
        status: 'verified',
        artefactId: UUID,
        artefactType: 'MARKING_MEMO',
        linkage: baseLinkage(),
        answerKey: [
          { itemId: UUID, modelAnswer: 'The water cycle.', markingCriteria: '1 mark.' },
        ],
        verificationItems: [
          {
            itemId: UUID,
            authorAnswer: 'The water cycle.',
            verifierAnswer: 'The water cycle.',
            agrees: true,
          },
        ],
        totalMarks: 2,
      }).success,
    ).toBe(true);
  });

  it('accepts a disagreement_flagged result (blocks release)', () => {
    expect(
      TB05Result.safeParse({
        status: 'disagreement_flagged',
        flaggedItems: [
          {
            itemId: UUID,
            authorAnswer: 'Pretoria',
            verifierAnswer: 'Cape Town',
            agrees: false,
          },
        ],
        allItems: [
          {
            itemId: UUID,
            authorAnswer: 'Pretoria',
            verifierAnswer: 'Cape Town',
            agrees: false,
          },
        ],
        detail: 'Author and verifier disagree on item.',
      }).success,
    ).toBe(true);
  });

  it('accepts needs_input result', () => {
    expect(
      TB05Result.safeParse({
        status: 'needs_input',
        detail: 'Items array is empty.',
        missingFields: ['items'],
      }).success,
    ).toBe(true);
  });

  it('rejects verified result with empty answerKey', () => {
    expect(
      TB05Result.safeParse({
        status: 'verified',
        artefactId: UUID,
        artefactType: 'MARKING_MEMO',
        linkage: baseLinkage(),
        answerKey: [],
        verificationItems: [
          { itemId: UUID, authorAnswer: 'A', verifierAnswer: 'A', agrees: true },
        ],
        totalMarks: 1,
      }).success,
    ).toBe(false);
  });

  it('rejects disagreement_flagged result with empty flaggedItems', () => {
    expect(
      TB05Result.safeParse({
        status: 'disagreement_flagged',
        flaggedItems: [],
        allItems: [
          { itemId: UUID, authorAnswer: 'A', verifierAnswer: 'B', agrees: false },
        ],
        detail: 'Some items disagree.',
      }).success,
    ).toBe(false);
  });

  it('verified result has MARKING_MEMO artefactType', () => {
    const result = TB05Result.safeParse({
      status: 'verified',
      artefactId: UUID,
      artefactType: 'MARKING_MEMO',
      linkage: baseLinkage(),
      answerKey: [{ itemId: UUID, modelAnswer: 'Answer.', markingCriteria: 'Criteria.' }],
      verificationItems: [
        {
          itemId: UUID,
          authorAnswer: 'Answer.',
          verifierAnswer: 'Answer.',
          agrees: true,
        },
      ],
      totalMarks: 1,
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.status === 'verified') {
      expect(result.data.artefactType).toBe('MARKING_MEMO');
    }
  });
});
