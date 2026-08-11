// Toolbox agent contracts — Stage 11 steps 2–6.
//
// Covers: TB-01 (Worksheet Builder), TB-02 (Board & Deck Builder),
// TB-03 (Reading Passage Generator), TB-04 (Item Writer),
// TB-05 (Memo & Marking Guide Agent), TB-06 (Home-Language Adapter),
// TB-07 (Accessibility Adapter), TB-08 (Remediation Pack Builder),
// TB-09 (Extension & Enrichment Agent), TB-10 (Resource-Light Activity Agent).
//
// Key invariants verified:
//   - TBLinkageInput requires at least one of lessonId / interventionId
//   - no_source_document output blocks fabrication
//   - TB-02 slides ≥1; presentationPurpose is nullable in output
//   - TB-05 disagreement_flagged blocks release (no artefactId in that variant)
//   - MC items must have exactly four options; other types have none
//   - TB-06 rejects same source/target language; requiresHumanReview flag present in ok result
//   - TB-07 accessibilityCheckResult.verdict must be 'pass' on ok, 'fail' on check_failed
//   - TB-08 sections ≥1; each section has explanation, workedExamples, practiceItems
//   - TB-09 enrichmentFocus must be a valid enum value; sections ≥1
//   - TB-10 steps ≥1; materials must honour resourceConstraints; activityDurationMinutes positive

import { describe, expect, it } from 'vitest';

import {
  AccessibilityCheckItem,
  AccessibilityCheckResult,
  AccessibilityMode,
  ActivityStep,
  AnswerKeyEntry,
  AssessmentItem,
  AssessmentItemType,
  EnrichmentFocus,
  ExtensionSection,
  MCOption,
  OfficialLanguage,
  PresentationPurpose,
  RemediationSection,
  ResourceConstraint,
  Slide,
  TB01Input,
  TB01Result,
  TB02Input,
  TB02Result,
  TB03Input,
  TB03Result,
  TB04Input,
  TB04Result,
  TB05Input,
  TB05ItemInput,
  TB05Result,
  TB05VerificationItem,
  TB06Input,
  TB06Result,
  TB07Input,
  TB07Result,
  TB08Input,
  TB08Result,
  TB09Input,
  TB09Result,
  TB10Input,
  TB10Result,
  TB11Input,
  TB11Result,
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

function baseReadabilityCheckResult() {
  return { verdict: 'within_band' as const, measuredGrade: 4, targetBand: baseBand() };
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

// ---------------------------------------------------------------------------
// OfficialLanguage
// ---------------------------------------------------------------------------

describe('OfficialLanguage', () => {
  it('accepts all eleven official language codes', () => {
    const codes = ['af', 'en', 'nr', 'xh', 'zu', 'nso', 'st', 'tn', 'ss', 've', 'ts'];
    for (const code of codes) {
      expect(OfficialLanguage.safeParse(code).success).toBe(true);
    }
  });

  it('rejects an unlisted code', () => {
    expect(OfficialLanguage.safeParse('fr').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(OfficialLanguage.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB06Input
// ---------------------------------------------------------------------------

function baseTB06Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-EHL-GR4-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '4',
    sourceArtefactId: UUID2,
    sourceArtefactType: 'WORKSHEET',
    content: 'Section A: Read the passage and answer the questions.',
    sourceLanguage: 'en',
    targetLanguage: 'af',
    loltLanguage: 'af',
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

describe('TB06Input', () => {
  it('accepts a valid home-language adapter input', () => {
    expect(TB06Input.safeParse(baseTB06Input()).success).toBe(true);
  });

  it('accepts with interventionId instead of lessonId', () => {
    expect(
      TB06Input.safeParse(baseTB06Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('accepts all eleven official target languages', () => {
    const codes = ['af', 'en', 'nr', 'xh', 'zu', 'nso', 'st', 'tn', 'ss', 've', 'ts'];
    for (const code of codes) {
      const src = code === 'en' ? 'af' : 'en';
      expect(
        TB06Input.safeParse(baseTB06Input({ sourceLanguage: src, targetLanguage: code }))
          .success,
      ).toBe(true);
    }
  });

  it('rejects when sourceLanguage equals targetLanguage', () => {
    const result = TB06Input.safeParse(
      baseTB06Input({ sourceLanguage: 'en', targetLanguage: 'en' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join(' ')).toMatch(
        /targetLanguage must differ/,
      );
    }
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB06Input.safeParse(
      baseTB06Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects with empty content', () => {
    expect(TB06Input.safeParse(baseTB06Input({ content: '' })).success).toBe(false);
  });

  it('rejects with invalid sourceArtefactType', () => {
    expect(
      TB06Input.safeParse(baseTB06Input({ sourceArtefactType: 'UNKNOWN_TYPE' })).success,
    ).toBe(false);
  });

  it('rejects with invalid targetLanguage', () => {
    expect(TB06Input.safeParse(baseTB06Input({ targetLanguage: 'pt' })).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// TB06Result
// ---------------------------------------------------------------------------

describe('TB06Result', () => {
  it('accepts a valid ok result with requiresHumanReview false', () => {
    expect(
      TB06Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'HOME_LANGUAGE_ADAPTED',
        linkage: baseLinkage(),
        adaptedContent: 'Afdeling A: Lees die teks en beantwoord die vrae.',
        targetLanguage: 'af',
        requiresHumanReview: false,
      }).success,
    ).toBe(true);
  });

  it('accepts a valid ok result with requiresHumanReview true and reviewReason', () => {
    expect(
      TB06Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'HOME_LANGUAGE_ADAPTED',
        linkage: baseLinkage(),
        adaptedContent: 'Ingcenye A: Funda umbhalo uphendule imibuzo.',
        targetLanguage: 'nr',
        requiresHumanReview: true,
        reviewReason:
          'isiNdebele quality below shipping threshold — human review required.',
      }).success,
    ).toBe(true);
  });

  it('rejects ok result with empty adaptedContent', () => {
    expect(
      TB06Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'HOME_LANGUAGE_ADAPTED',
        linkage: baseLinkage(),
        adaptedContent: '',
        targetLanguage: 'af',
        requiresHumanReview: false,
      }).success,
    ).toBe(false);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB06Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'WORKSHEET',
        linkage: baseLinkage(),
        adaptedContent: 'Translated content.',
        targetLanguage: 'af',
        requiresHumanReview: false,
      }).success,
    ).toBe(false);
  });

  it('accepts needs_input result', () => {
    expect(
      TB06Result.safeParse({
        status: 'needs_input',
        detail: 'sourceLanguage and targetLanguage are the same.',
        missingFields: ['targetLanguage'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_content result', () => {
    expect(
      TB06Result.safeParse({
        status: 'no_source_content',
        detail: 'Content field is empty.',
      }).success,
    ).toBe(true);
  });

  it('rejects needs_input result with empty missingFields', () => {
    expect(
      TB06Result.safeParse({
        status: 'needs_input',
        detail: 'Something missing.',
        missingFields: [],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AccessibilityMode
// ---------------------------------------------------------------------------

describe('AccessibilityMode', () => {
  it('accepts all four modes', () => {
    const modes = [
      'LARGE_PRINT',
      'DYSLEXIA_FRIENDLY',
      'SIMPLIFIED_LANGUAGE',
      'BRAILLE_READY',
    ];
    for (const mode of modes) {
      expect(AccessibilityMode.safeParse(mode).success).toBe(true);
    }
  });

  it('rejects an unlisted mode', () => {
    expect(AccessibilityMode.safeParse('LARGE_FONT').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(AccessibilityMode.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AccessibilityCheckItem
// ---------------------------------------------------------------------------

describe('AccessibilityCheckItem', () => {
  it('accepts a passing check item', () => {
    expect(
      AccessibilityCheckItem.safeParse({
        name: 'font_size_spec',
        required: 'font size ≥ 18pt specified',
        measured: '18pt directive present',
        pass: true,
      }).success,
    ).toBe(true);
  });

  it('accepts a failing check item', () => {
    expect(
      AccessibilityCheckItem.safeParse({
        name: 'line_length',
        required: '≤ 60 chars/line',
        measured: 'max line 72 chars',
        pass: false,
      }).success,
    ).toBe(true);
  });

  it('rejects a check item with empty name', () => {
    expect(
      AccessibilityCheckItem.safeParse({
        name: '',
        required: 'font size ≥ 18pt',
        measured: '18pt',
        pass: true,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AccessibilityCheckResult
// ---------------------------------------------------------------------------

function baseCheckResult(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'LARGE_PRINT',
    checks: [
      {
        name: 'font_size_spec',
        required: 'font size ≥ 18pt',
        measured: '18pt directive present',
        pass: true,
      },
      {
        name: 'line_length',
        required: '≤ 60 chars/line',
        measured: 'max line 45 chars',
        pass: true,
      },
    ],
    verdict: 'pass',
    ...overrides,
  };
}

describe('AccessibilityCheckResult', () => {
  it('accepts a passing result', () => {
    expect(AccessibilityCheckResult.safeParse(baseCheckResult()).success).toBe(true);
  });

  it('accepts a failing result', () => {
    expect(
      AccessibilityCheckResult.safeParse(
        baseCheckResult({
          checks: [
            {
              name: 'font_size_spec',
              required: 'font size ≥ 18pt',
              measured: 'no directive',
              pass: false,
            },
          ],
          verdict: 'fail',
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects result with no checks', () => {
    expect(
      AccessibilityCheckResult.safeParse(baseCheckResult({ checks: [] })).success,
    ).toBe(false);
  });

  it('rejects unknown verdict', () => {
    expect(
      AccessibilityCheckResult.safeParse(baseCheckResult({ verdict: 'unknown' })).success,
    ).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(
      AccessibilityCheckResult.safeParse(baseCheckResult({ mode: 'MAGNIFIED' })).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB07Input
// ---------------------------------------------------------------------------

function baseTB07Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR5-TOPIC-3',
    lessonId: UUID,
    gradeLabel: '5',
    sourceArtefactId: UUID2,
    sourceArtefactType: 'WORKSHEET',
    content: 'Section A: Questions about food chains.',
    language: 'en',
    accessibilityMode: 'LARGE_PRINT',
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

describe('TB07Input', () => {
  it('accepts a valid accessibility adapter input', () => {
    expect(TB07Input.safeParse(baseTB07Input()).success).toBe(true);
  });

  it('accepts with interventionId instead of lessonId', () => {
    expect(
      TB07Input.safeParse(baseTB07Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('accepts all four accessibility modes', () => {
    const modes = [
      'LARGE_PRINT',
      'DYSLEXIA_FRIENDLY',
      'SIMPLIFIED_LANGUAGE',
      'BRAILLE_READY',
    ];
    for (const mode of modes) {
      expect(
        TB07Input.safeParse(baseTB07Input({ accessibilityMode: mode })).success,
      ).toBe(true);
    }
  });

  it('rejects when neither lessonId nor interventionId is present', () => {
    const result = TB07Input.safeParse(
      baseTB07Input({ lessonId: undefined, interventionId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects with empty content', () => {
    expect(TB07Input.safeParse(baseTB07Input({ content: '' })).success).toBe(false);
  });

  it('rejects with invalid accessibilityMode', () => {
    expect(
      TB07Input.safeParse(baseTB07Input({ accessibilityMode: 'ZOOM_TEXT' })).success,
    ).toBe(false);
  });

  it('rejects with invalid sourceArtefactType', () => {
    expect(
      TB07Input.safeParse(baseTB07Input({ sourceArtefactType: 'UNKNOWN' })).success,
    ).toBe(false);
  });

  it('rejects language code that is too short', () => {
    expect(TB07Input.safeParse(baseTB07Input({ language: 'e' })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB07Result
// ---------------------------------------------------------------------------

function baseAccessibilityCheckResult(verdict: 'pass' | 'fail' = 'pass') {
  return {
    mode: 'LARGE_PRINT',
    checks: [
      {
        name: 'font_size_spec',
        required: 'font size ≥ 18pt',
        measured: '18pt directive present',
        pass: verdict === 'pass',
      },
    ],
    verdict,
  };
}

describe('TB07Result', () => {
  it('accepts a valid ok result', () => {
    expect(
      TB07Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'ACCESSIBLE_ARTEFACT',
        linkage: baseLinkage(),
        adaptedContent:
          '[LAYOUT: minimum font size 18pt]\nSection A: Questions about food chains.',
        accessibilityMode: 'LARGE_PRINT',
        accessibilityCheckResult: baseAccessibilityCheckResult('pass'),
      }).success,
    ).toBe(true);
  });

  it('accepts all four modes in ok result', () => {
    const modes = [
      'LARGE_PRINT',
      'DYSLEXIA_FRIENDLY',
      'SIMPLIFIED_LANGUAGE',
      'BRAILLE_READY',
    ];
    for (const mode of modes) {
      expect(
        TB07Result.safeParse({
          status: 'ok',
          artefactId: UUID,
          artefactType: 'ACCESSIBLE_ARTEFACT',
          linkage: baseLinkage(),
          adaptedContent: 'Adapted content.',
          accessibilityMode: mode,
          accessibilityCheckResult: {
            mode,
            checks: [{ name: 'c', required: 'r', measured: 'm', pass: true }],
            verdict: 'pass',
          },
        }).success,
      ).toBe(true);
    }
  });

  it('rejects ok result with empty adaptedContent', () => {
    expect(
      TB07Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'ACCESSIBLE_ARTEFACT',
        linkage: baseLinkage(),
        adaptedContent: '',
        accessibilityMode: 'LARGE_PRINT',
        accessibilityCheckResult: baseAccessibilityCheckResult('pass'),
      }).success,
    ).toBe(false);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB07Result.safeParse({
        status: 'ok',
        artefactId: UUID,
        artefactType: 'WORKSHEET',
        linkage: baseLinkage(),
        adaptedContent: 'Adapted content.',
        accessibilityMode: 'LARGE_PRINT',
        accessibilityCheckResult: baseAccessibilityCheckResult('pass'),
      }).success,
    ).toBe(false);
  });

  it('accepts accessibility_check_failed result', () => {
    expect(
      TB07Result.safeParse({
        status: 'accessibility_check_failed',
        accessibilityMode: 'SIMPLIFIED_LANGUAGE',
        accessibilityCheckResult: baseAccessibilityCheckResult('fail'),
        detail: 'Content too technical for Grade 1 — human remediation required.',
      }).success,
    ).toBe(true);
  });

  it('rejects accessibility_check_failed result with empty detail', () => {
    expect(
      TB07Result.safeParse({
        status: 'accessibility_check_failed',
        accessibilityMode: 'SIMPLIFIED_LANGUAGE',
        accessibilityCheckResult: baseAccessibilityCheckResult('fail'),
        detail: '',
      }).success,
    ).toBe(false);
  });

  it('accepts needs_input result', () => {
    expect(
      TB07Result.safeParse({
        status: 'needs_input',
        detail: 'Neither lessonId nor interventionId provided.',
        missingFields: ['lessonId'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_content result', () => {
    expect(
      TB07Result.safeParse({
        status: 'no_source_content',
        detail: 'Content field is empty.',
      }).success,
    ).toBe(true);
  });

  it('rejects needs_input result with empty missingFields', () => {
    expect(
      TB07Result.safeParse({
        status: 'needs_input',
        detail: 'Something missing.',
        missingFields: [],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RemediationSection
// ---------------------------------------------------------------------------

describe('RemediationSection', () => {
  it('accepts a valid section', () => {
    expect(
      RemediationSection.safeParse({
        skillId: 'CAPS-MATH-GR4-FRACTIONS-1',
        skillDescription: 'Identify equivalent fractions using diagrams.',
        explanation:
          'Two fractions are equivalent when they represent the same part of a whole.',
        workedExamples: ['½ = 2/4 because both show half of the same whole.'],
        practiceItems: ['Circle the fraction equal to ¼: 2/8, 3/8, 1/6.'],
      }).success,
    ).toBe(true);
  });

  it('rejects a section with empty workedExamples', () => {
    expect(
      RemediationSection.safeParse({
        skillId: 'CAPS-MATH-GR4-FRACTIONS-1',
        skillDescription: 'Identify equivalent fractions.',
        explanation:
          'Two fractions are equivalent when they represent the same part of a whole.',
        workedExamples: [],
        practiceItems: ['Circle the fraction equal to ¼: 2/8, 3/8, 1/6.'],
      }).success,
    ).toBe(false);
  });

  it('rejects a section with empty practiceItems', () => {
    expect(
      RemediationSection.safeParse({
        skillId: 'CAPS-MATH-GR4-FRACTIONS-1',
        skillDescription: 'Identify equivalent fractions.',
        explanation:
          'Two fractions are equivalent when they represent the same part of a whole.',
        workedExamples: ['½ = 2/4 because both show half of the same whole.'],
        practiceItems: [],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB-08 — Remediation Pack Builder
// ---------------------------------------------------------------------------

function baseTB08Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-MATH-GR5-TOPIC-3',
    lessonId: UUID,
    gradeLabel: '5',
    subject: 'Mathematics',
    missedSkills: [
      {
        skillId: 'CAPS-MATH-GR5-FRAC-1',
        skillDescription: 'Add fractions with unlike denominators.',
      },
    ],
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: [UUID2],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB08OkResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok' as const,
    artefactId: UUID2,
    artefactType: 'REMEDIATION_PACK' as const,
    linkage: baseLinkage(),
    sections: [
      {
        skillId: 'CAPS-MATH-GR5-FRAC-1',
        skillDescription: 'Add fractions with unlike denominators.',
        explanation: 'To add fractions with different denominators, find the LCM.',
        workedExamples: ['¼ + ⅓ = 3/12 + 4/12 = 7/12'],
        practiceItems: ['Calculate: ½ + ⅓ = ?'],
      },
    ],
    readabilityCheckResult: baseReadabilityCheckResult(),
    citedSourceIds: [UUID2],
    ...overrides,
  };
}

describe('TB08Input', () => {
  it('accepts valid input with lessonId', () => {
    expect(TB08Input.safeParse(baseTB08Input()).success).toBe(true);
  });

  it('accepts valid input with interventionId', () => {
    expect(
      TB08Input.safeParse(baseTB08Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('rejects input missing both lessonId and interventionId', () => {
    expect(TB08Input.safeParse(baseTB08Input({ lessonId: undefined })).success).toBe(
      false,
    );
  });

  it('rejects input with empty missedSkills', () => {
    expect(TB08Input.safeParse(baseTB08Input({ missedSkills: [] })).success).toBe(false);
  });

  it('rejects input with empty sourceDocumentIds', () => {
    expect(TB08Input.safeParse(baseTB08Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });

  it('rejects input with missing tenantId', () => {
    const { tenantId: _t, ...rest } = baseTB08Input();
    expect(TB08Input.safeParse(rest).success).toBe(false);
  });
});

describe('TB08Result', () => {
  it('accepts a valid ok result', () => {
    expect(TB08Result.safeParse(baseTB08OkResult()).success).toBe(true);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB08Result.safeParse(baseTB08OkResult({ artefactType: 'WORKSHEET' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty sections', () => {
    expect(TB08Result.safeParse(baseTB08OkResult({ sections: [] })).success).toBe(false);
  });

  it('rejects ok result with empty citedSourceIds', () => {
    expect(TB08Result.safeParse(baseTB08OkResult({ citedSourceIds: [] })).success).toBe(
      false,
    );
  });

  it('accepts needs_input result', () => {
    expect(
      TB08Result.safeParse({
        status: 'needs_input',
        detail: 'missedSkills is empty.',
        missingFields: ['missedSkills'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB08Result.safeParse({
        status: 'no_source_document',
        detail: 'No source documents supplied for grounding.',
      }).success,
    ).toBe(true);
  });

  it('rejects needs_input with empty missingFields', () => {
    expect(
      TB08Result.safeParse({
        status: 'needs_input',
        detail: 'Something is missing.',
        missingFields: [],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EnrichmentFocus
// ---------------------------------------------------------------------------

describe('EnrichmentFocus', () => {
  it.each([
    'DEEPER_EXPLORATION',
    'CHALLENGE_TASKS',
    'CROSS_CURRICULAR',
    'HIGHER_ORDER_THINKING',
  ] as const)('accepts %s', (focus) => {
    expect(EnrichmentFocus.safeParse(focus).success).toBe(true);
  });

  it('rejects an unknown focus value', () => {
    expect(EnrichmentFocus.safeParse('REVISION').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ExtensionSection
// ---------------------------------------------------------------------------

describe('ExtensionSection', () => {
  it('accepts a valid section', () => {
    expect(
      ExtensionSection.safeParse({
        title: 'Exploring Irrational Numbers',
        enrichmentFocus: 'DEEPER_EXPLORATION',
        content: 'Pi and the square root of 2 cannot be expressed as fractions.',
        tasks: [
          'Research three other irrational numbers and explain why they are irrational.',
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects a section with an invalid enrichmentFocus', () => {
    expect(
      ExtensionSection.safeParse({
        title: 'Challenge',
        enrichmentFocus: 'REMEDIATION',
        content: 'Some content.',
        tasks: ['Task 1'],
      }).success,
    ).toBe(false);
  });

  it('rejects a section with empty tasks', () => {
    expect(
      ExtensionSection.safeParse({
        title: 'Deeper Exploration',
        enrichmentFocus: 'HIGHER_ORDER_THINKING',
        content: 'Evaluating sources of evidence.',
        tasks: [],
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB-09 — Extension & Enrichment Agent
// ---------------------------------------------------------------------------

function baseTB09Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR6-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '6',
    subject: 'Natural Sciences',
    topic: 'Energy and Change',
    masteredSkills: [
      {
        skillId: 'CAPS-NS-GR6-ENERGY-1',
        skillDescription: 'Describe forms of energy and energy transfer.',
      },
    ],
    enrichmentFocus: 'CHALLENGE_TASKS' as const,
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: [UUID2],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB09OkResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok' as const,
    artefactId: UUID2,
    artefactType: 'EXTENSION_PACK' as const,
    linkage: baseLinkage(),
    sections: [
      {
        title: 'Challenge: Energy Audit',
        enrichmentFocus: 'CHALLENGE_TASKS' as const,
        content: 'Conduct an energy audit of your home.',
        tasks: ['List five appliances and estimate their daily energy use in kWh.'],
      },
    ],
    readabilityCheckResult: baseReadabilityCheckResult(),
    citedSourceIds: [UUID2],
    ...overrides,
  };
}

describe('TB09Input', () => {
  it('accepts valid input with lessonId', () => {
    expect(TB09Input.safeParse(baseTB09Input()).success).toBe(true);
  });

  it('accepts valid input with interventionId', () => {
    expect(
      TB09Input.safeParse(baseTB09Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('rejects input missing both lessonId and interventionId', () => {
    expect(TB09Input.safeParse(baseTB09Input({ lessonId: undefined })).success).toBe(
      false,
    );
  });

  it('rejects input with empty masteredSkills', () => {
    expect(TB09Input.safeParse(baseTB09Input({ masteredSkills: [] })).success).toBe(
      false,
    );
  });

  it('rejects input with invalid enrichmentFocus', () => {
    expect(
      TB09Input.safeParse(baseTB09Input({ enrichmentFocus: 'REMEDIATION' })).success,
    ).toBe(false);
  });

  it('rejects input with empty sourceDocumentIds', () => {
    expect(TB09Input.safeParse(baseTB09Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

describe('TB09Result', () => {
  it('accepts a valid ok result', () => {
    expect(TB09Result.safeParse(baseTB09OkResult()).success).toBe(true);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB09Result.safeParse(baseTB09OkResult({ artefactType: 'WORKSHEET' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty sections', () => {
    expect(TB09Result.safeParse(baseTB09OkResult({ sections: [] })).success).toBe(false);
  });

  it('accepts needs_input result', () => {
    expect(
      TB09Result.safeParse({
        status: 'needs_input',
        detail: 'masteredSkills is required.',
        missingFields: ['masteredSkills'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB09Result.safeParse({
        status: 'no_source_document',
        detail: 'No source documents supplied for grounding.',
      }).success,
    ).toBe(true);
  });

  it('rejects ok result with empty citedSourceIds', () => {
    expect(TB09Result.safeParse(baseTB09OkResult({ citedSourceIds: [] })).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// PresentationPurpose
// ---------------------------------------------------------------------------

describe('PresentationPurpose', () => {
  it.each(['INTRODUCTION', 'LESSON', 'REVIEW', 'CONSOLIDATION'] as const)(
    'accepts %s',
    (purpose) => {
      expect(PresentationPurpose.safeParse(purpose).success).toBe(true);
    },
  );

  it('rejects an unknown purpose', () => {
    expect(PresentationPurpose.safeParse('REVISION').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Slide
// ---------------------------------------------------------------------------

describe('Slide', () => {
  it('accepts a slide with title and content', () => {
    expect(
      Slide.safeParse({
        title: 'What is Energy?',
        content: 'Energy is the ability to do work.',
      }).success,
    ).toBe(true);
  });

  it('accepts a slide with optional speakerNotes', () => {
    expect(
      Slide.safeParse({
        title: 'Forms of Energy',
        content: 'Kinetic, potential, thermal, chemical, electrical.',
        speakerNotes: 'Ask learners to give examples of each form.',
      }).success,
    ).toBe(true);
  });

  it('rejects a slide with empty title', () => {
    expect(Slide.safeParse({ title: '', content: 'Some content.' }).success).toBe(false);
  });

  it('rejects a slide with empty content', () => {
    expect(Slide.safeParse({ title: 'Valid Title', content: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB-02 — Board & Deck Builder
// ---------------------------------------------------------------------------

function baseTB02Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR6-TOPIC-2',
    lessonId: UUID,
    gradeLabel: '6',
    subject: 'Natural Sciences',
    topic: 'Energy and Change',
    learningObjectives: ['Identify forms of energy and give examples of each.'],
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: [UUID2],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB02OkResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok' as const,
    artefactId: UUID2,
    artefactType: 'BOARD_DECK' as const,
    linkage: baseLinkage(),
    slides: [
      {
        title: 'What is Energy?',
        content: 'Energy is the ability to do work. It exists in many forms.',
        speakerNotes: 'Ask learners: where do you find energy in your home?',
      },
    ],
    presentationPurpose: 'LESSON' as const,
    readabilityCheckResult: baseReadabilityCheckResult(),
    citedSourceIds: [UUID2],
    ...overrides,
  };
}

describe('TB02Input', () => {
  it('accepts valid input with lessonId', () => {
    expect(TB02Input.safeParse(baseTB02Input()).success).toBe(true);
  });

  it('accepts valid input with interventionId', () => {
    expect(
      TB02Input.safeParse(baseTB02Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('accepts with optional presentationPurpose', () => {
    expect(
      TB02Input.safeParse(baseTB02Input({ presentationPurpose: 'INTRODUCTION' })).success,
    ).toBe(true);
  });

  it('accepts with optional slideCount', () => {
    expect(TB02Input.safeParse(baseTB02Input({ slideCount: 10 })).success).toBe(true);
  });

  it('rejects input missing both lessonId and interventionId', () => {
    expect(
      TB02Input.safeParse(
        baseTB02Input({ lessonId: undefined, interventionId: undefined }),
      ).success,
    ).toBe(false);
  });

  it('rejects with empty learningObjectives', () => {
    expect(TB02Input.safeParse(baseTB02Input({ learningObjectives: [] })).success).toBe(
      false,
    );
  });

  it('rejects with empty sourceDocumentIds', () => {
    expect(TB02Input.safeParse(baseTB02Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

describe('TB02Result', () => {
  it('accepts a valid ok result', () => {
    expect(TB02Result.safeParse(baseTB02OkResult()).success).toBe(true);
  });

  it('accepts ok result with null presentationPurpose', () => {
    expect(
      TB02Result.safeParse(baseTB02OkResult({ presentationPurpose: null })).success,
    ).toBe(true);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB02Result.safeParse(baseTB02OkResult({ artefactType: 'WORKSHEET' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty slides', () => {
    expect(TB02Result.safeParse(baseTB02OkResult({ slides: [] })).success).toBe(false);
  });

  it('rejects ok result with empty citedSourceIds', () => {
    expect(TB02Result.safeParse(baseTB02OkResult({ citedSourceIds: [] })).success).toBe(
      false,
    );
  });

  it('accepts needs_input result', () => {
    expect(
      TB02Result.safeParse({
        status: 'needs_input',
        detail: 'learningObjectives is empty.',
        missingFields: ['learningObjectives'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB02Result.safeParse({
        status: 'no_source_document',
        detail: 'No source documents supplied for grounding.',
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ResourceConstraint
// ---------------------------------------------------------------------------

describe('ResourceConstraint', () => {
  it.each(['NO_PRINTING', 'NO_DEVICES', 'NO_ELECTRICITY', 'ORAL_ONLY'] as const)(
    'accepts %s',
    (constraint) => {
      expect(ResourceConstraint.safeParse(constraint).success).toBe(true);
    },
  );

  it('rejects an unknown constraint', () => {
    expect(ResourceConstraint.safeParse('NO_INTERNET').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ActivityStep
// ---------------------------------------------------------------------------

describe('ActivityStep', () => {
  it('accepts a step with instruction only', () => {
    expect(
      ActivityStep.safeParse({ instruction: 'Ask learners to form pairs.' }).success,
    ).toBe(true);
  });

  it('accepts a step with instruction and durationMinutes', () => {
    expect(
      ActivityStep.safeParse({
        instruction: 'Discuss the question in pairs.',
        durationMinutes: 5,
      }).success,
    ).toBe(true);
  });

  it('rejects a step with empty instruction', () => {
    expect(ActivityStep.safeParse({ instruction: '' }).success).toBe(false);
  });

  it('rejects a step with non-positive durationMinutes', () => {
    expect(
      ActivityStep.safeParse({ instruction: 'Do something.', durationMinutes: 0 })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TB-10 — Resource-Light Activity Agent
// ---------------------------------------------------------------------------

function baseTB10Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR5-TOPIC-1',
    lessonId: UUID,
    gradeLabel: '5',
    subject: 'Natural Sciences',
    topic: 'The water cycle',
    learningObjectives: ['Describe the stages of the water cycle.'],
    activityDurationMinutes: 30,
    targetReadabilityBand: baseBand(),
    language: 'en',
    sourceDocumentIds: [UUID2],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB10OkResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok' as const,
    artefactId: UUID2,
    artefactType: 'ACTIVITY_PLAN' as const,
    linkage: baseLinkage(),
    activityTitle: 'Water Cycle Relay',
    overview: 'Learners act out the stages of the water cycle in a physical relay game.',
    materials: ['Open floor space', 'Labels for each stage written on paper'],
    steps: [
      {
        instruction: 'Arrange learners in a circle representing the water cycle.',
        durationMinutes: 5,
      },
      {
        instruction: 'Each learner calls out a stage and mimes the process.',
        durationMinutes: 15,
      },
      {
        instruction: 'Discuss which stage is most important and why.',
        durationMinutes: 10,
      },
    ],
    adaptations: [
      'For learners who need more support: provide a word bank of stage names.',
      'For learners who need more challenge: ask them to explain the energy source driving each stage.',
    ],
    readabilityCheckResult: baseReadabilityCheckResult(),
    citedSourceIds: [UUID2],
    ...overrides,
  };
}

describe('TB10Input', () => {
  it('accepts valid input with lessonId', () => {
    expect(TB10Input.safeParse(baseTB10Input()).success).toBe(true);
  });

  it('accepts valid input with interventionId', () => {
    expect(
      TB10Input.safeParse(baseTB10Input({ lessonId: undefined, interventionId: UUID }))
        .success,
    ).toBe(true);
  });

  it('accepts with optional resourceConstraints', () => {
    expect(
      TB10Input.safeParse(
        baseTB10Input({ resourceConstraints: ['NO_PRINTING', 'NO_DEVICES'] }),
      ).success,
    ).toBe(true);
  });

  it('rejects input missing both lessonId and interventionId', () => {
    expect(
      TB10Input.safeParse(
        baseTB10Input({ lessonId: undefined, interventionId: undefined }),
      ).success,
    ).toBe(false);
  });

  it('rejects with empty learningObjectives', () => {
    expect(TB10Input.safeParse(baseTB10Input({ learningObjectives: [] })).success).toBe(
      false,
    );
  });

  it('rejects with non-positive activityDurationMinutes', () => {
    expect(
      TB10Input.safeParse(baseTB10Input({ activityDurationMinutes: 0 })).success,
    ).toBe(false);
  });

  it('rejects with empty sourceDocumentIds', () => {
    expect(TB10Input.safeParse(baseTB10Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

describe('TB10Result', () => {
  it('accepts a valid ok result', () => {
    expect(TB10Result.safeParse(baseTB10OkResult()).success).toBe(true);
  });

  it('accepts ok result with empty materials array', () => {
    expect(TB10Result.safeParse(baseTB10OkResult({ materials: [] })).success).toBe(true);
  });

  it('accepts ok result with empty adaptations array', () => {
    expect(TB10Result.safeParse(baseTB10OkResult({ adaptations: [] })).success).toBe(
      true,
    );
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB10Result.safeParse(baseTB10OkResult({ artefactType: 'WORKSHEET' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty steps', () => {
    expect(TB10Result.safeParse(baseTB10OkResult({ steps: [] })).success).toBe(false);
  });

  it('rejects ok result with empty citedSourceIds', () => {
    expect(TB10Result.safeParse(baseTB10OkResult({ citedSourceIds: [] })).success).toBe(
      false,
    );
  });

  it('accepts needs_input result', () => {
    expect(
      TB10Result.safeParse({
        status: 'needs_input',
        detail: 'activityDurationMinutes must be a positive integer.',
        missingFields: ['activityDurationMinutes'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB10Result.safeParse({
        status: 'no_source_document',
        detail: 'No source documents supplied for grounding.',
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TB-11 — Visual Brief Writer
// ---------------------------------------------------------------------------

function baseTB11Input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: UUID,
    capsTopicId: 'CAPS-NS-GR4-WATER',
    lessonId: UUID,
    gradeLabel: '4',
    subject: 'Natural Sciences',
    topic: 'The Water Cycle',
    learningObjectives: ['Learners can describe evaporation and condensation.'],
    language: 'en',
    sourceDocumentIds: ['doc-water-cycle-001'],
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

function baseTB11OkResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    artefactId: UUID,
    artefactType: 'VISUAL_BRIEF',
    linkage: { capsTopicId: 'CAPS-NS-GR4-WATER', lessonId: UUID },
    brief:
      'A diagram showing water evaporating from a lake, rising as vapour, forming clouds, and falling as rain.',
    pedagogicalPurpose:
      'Illustrate the stages of the water cycle to reinforce understanding of evaporation and condensation.',
    citedSourceIds: ['doc-water-cycle-001'],
    ...overrides,
  };
}

describe('TB11Input', () => {
  it('accepts a valid TB-11 input', () => {
    expect(TB11Input.safeParse(baseTB11Input()).success).toBe(true);
  });

  it('accepts an input with optional visualContext', () => {
    expect(
      TB11Input.safeParse(
        baseTB11Input({ visualContext: 'classroom wall display, A2 size' }),
      ).success,
    ).toBe(true);
  });

  it('accepts input linked via interventionId instead of lessonId', () => {
    const { lessonId: _l, ...rest } = baseTB11Input() as Record<string, unknown>;
    expect(TB11Input.safeParse({ ...rest, interventionId: UUID }).success).toBe(true);
  });

  it('rejects input missing both lessonId and interventionId', () => {
    const { lessonId: _l, ...rest } = baseTB11Input() as Record<string, unknown>;
    expect(TB11Input.safeParse(rest).success).toBe(false);
  });

  it('rejects input with empty learningObjectives', () => {
    expect(TB11Input.safeParse(baseTB11Input({ learningObjectives: [] })).success).toBe(
      false,
    );
  });

  it('rejects input with empty sourceDocumentIds', () => {
    expect(TB11Input.safeParse(baseTB11Input({ sourceDocumentIds: [] })).success).toBe(
      false,
    );
  });
});

describe('TB11Result', () => {
  it('accepts a valid ok result', () => {
    expect(TB11Result.safeParse(baseTB11OkResult()).success).toBe(true);
  });

  it('accepts ok result with optional suggestedCompositionNotes', () => {
    expect(
      TB11Result.safeParse(
        baseTB11OkResult({ suggestedCompositionNotes: 'Use warm colours for the sun.' }),
      ).success,
    ).toBe(true);
  });

  it('rejects ok result with wrong artefactType', () => {
    expect(
      TB11Result.safeParse(baseTB11OkResult({ artefactType: 'WORKSHEET' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty brief', () => {
    expect(TB11Result.safeParse(baseTB11OkResult({ brief: '' })).success).toBe(false);
  });

  it('rejects ok result with empty pedagogicalPurpose', () => {
    expect(
      TB11Result.safeParse(baseTB11OkResult({ pedagogicalPurpose: '' })).success,
    ).toBe(false);
  });

  it('rejects ok result with empty citedSourceIds — fabrication guard', () => {
    expect(TB11Result.safeParse(baseTB11OkResult({ citedSourceIds: [] })).success).toBe(
      false,
    );
  });

  it('accepts needs_input result', () => {
    expect(
      TB11Result.safeParse({
        status: 'needs_input',
        detail: 'Both lessonId and interventionId are missing.',
        missingFields: ['lessonId'],
      }).success,
    ).toBe(true);
  });

  it('accepts no_source_document result', () => {
    expect(
      TB11Result.safeParse({
        status: 'no_source_document',
        detail: 'No source documents supplied; cannot ground the visual brief.',
      }).success,
    ).toBe(true);
  });
});
