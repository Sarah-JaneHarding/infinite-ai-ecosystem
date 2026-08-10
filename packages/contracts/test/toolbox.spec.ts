// Toolbox contracts — Stage 11 step 1.
//
// Covers: artefact linkage constraint, VisualBrief, render dispatch (format support and
// template gate), readability band schema, and answer-key verification result.

import { describe, expect, it } from 'vitest';

import {
  ARTEFACT_TYPE_TO_AGENT,
  AnswerKeyItem,
  AnswerKeyVerificationResult,
  ArtefactLinkage,
  FORMAT_SUPPORT,
  GradeBand,
  ReadabilityCheckInput,
  ReadabilityCheckResult,
  ToolboxArtefact,
  ToolboxArtefactType,
  VisualBrief,
  dispatchRender,
} from '../src/toolbox/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID = '11111111-2222-3333-4444-555555555555';
const UUID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function baseLinkage(overrides: Record<string, unknown> = {}) {
  return { capsTopicId: 'CAPS-EN-GR4-TOPIC-1', lessonId: UUID, ...overrides };
}

function baseArtefact(overrides: Record<string, unknown> = {}) {
  return {
    artefactId: UUID,
    artefactType: 'WORKSHEET',
    tenantId: UUID,
    linkage: baseLinkage(),
    language: 'en',
    createdBy: 'teacher@school.za',
    createdAt: '2026-08-07T08:00:00Z',
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

function renderRequest(overrides: Record<string, unknown> = {}) {
  return {
    artefact: { artefactId: UUID, artefactType: 'WORKSHEET', tenantId: UUID },
    format: 'PDF',
    templateVersion: '1.0.0',
    requestedBy: 'teacher@school.za',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ToolboxArtefactType
// ---------------------------------------------------------------------------

describe('ToolboxArtefactType', () => {
  it('accepts all eleven artefact type values', () => {
    const types = [
      'WORKSHEET',
      'BOARD_DECK',
      'READING_PASSAGE',
      'ASSESSMENT_ITEM',
      'MARKING_MEMO',
      'HOME_LANGUAGE_ADAPTED',
      'ACCESSIBLE_ARTEFACT',
      'REMEDIATION_PACK',
      'EXTENSION_PACK',
      'ACTIVITY_PLAN',
      'VISUAL_BRIEF',
    ];
    for (const t of types) {
      expect(ToolboxArtefactType.safeParse(t).success).toBe(true);
    }
  });

  it('rejects an unknown artefact type', () => {
    expect(ToolboxArtefactType.safeParse('POSTER').success).toBe(false);
  });

  it('ARTEFACT_TYPE_TO_AGENT maps every type to a TB-NN string', () => {
    for (const [, agent] of Object.entries(ARTEFACT_TYPE_TO_AGENT)) {
      expect(agent).toMatch(/^TB-\d{2}$/);
    }
    expect(Object.keys(ARTEFACT_TYPE_TO_AGENT)).toHaveLength(11);
  });
});

// ---------------------------------------------------------------------------
// ArtefactLinkage
// ---------------------------------------------------------------------------

describe('ArtefactLinkage', () => {
  it('accepts linkage with lessonId only', () => {
    const result = ArtefactLinkage.safeParse({
      capsTopicId: 'CAPS-EN-GR4-TOPIC-1',
      lessonId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it('accepts linkage with interventionId only', () => {
    const result = ArtefactLinkage.safeParse({
      capsTopicId: 'CAPS-EN-GR4-TOPIC-1',
      interventionId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it('accepts linkage with both lessonId and interventionId', () => {
    const result = ArtefactLinkage.safeParse({
      capsTopicId: 'CAPS-EN-GR4-TOPIC-1',
      lessonId: UUID,
      interventionId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects linkage with neither lessonId nor interventionId', () => {
    const result = ArtefactLinkage.safeParse({ capsTopicId: 'CAPS-EN-GR4-TOPIC-1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/lessonId or interventionId/);
    }
  });

  it('rejects linkage with an empty capsTopicId', () => {
    const result = ArtefactLinkage.safeParse({
      capsTopicId: '',
      lessonId: UUID,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ToolboxArtefact
// ---------------------------------------------------------------------------

describe('ToolboxArtefact', () => {
  it('accepts a valid artefact', () => {
    expect(ToolboxArtefact.safeParse(baseArtefact()).success).toBe(true);
  });

  it('accepts a valid artefact with interventionId linkage', () => {
    expect(
      ToolboxArtefact.safeParse(
        baseArtefact({
          linkage: baseLinkage({ lessonId: undefined, interventionId: UUID2 }),
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects an artefact with invalid linkage (no lesson or intervention)', () => {
    const result = ToolboxArtefact.safeParse(
      baseArtefact({ linkage: { capsTopicId: 'CAPS-EN-GR4-TOPIC-1' } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an artefact missing artefactId', () => {
    const { artefactId: _omit, ...rest } = baseArtefact() as Record<string, unknown>;
    expect(ToolboxArtefact.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VisualBrief
// ---------------------------------------------------------------------------

describe('VisualBrief', () => {
  it('accepts a valid visual brief', () => {
    const result = VisualBrief.safeParse({
      ...baseArtefact({ artefactType: 'VISUAL_BRIEF' }),
      brief: 'A South African township street scene with children playing.',
      pedagogicalPurpose: 'Provides context for the reading passage on community life.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a visual brief with artefactType other than VISUAL_BRIEF', () => {
    const result = VisualBrief.safeParse({
      ...baseArtefact({ artefactType: 'WORKSHEET' }),
      brief: 'Some image description.',
      pedagogicalPurpose: 'context',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a visual brief with an empty brief', () => {
    const result = VisualBrief.safeParse({
      ...baseArtefact({ artefactType: 'VISUAL_BRIEF' }),
      brief: '',
      pedagogicalPurpose: 'Provides context.',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FORMAT_SUPPORT
// ---------------------------------------------------------------------------

describe('FORMAT_SUPPORT', () => {
  it('BOARD_DECK supports only SLIDES', () => {
    expect(FORMAT_SUPPORT.BOARD_DECK).toEqual(['SLIDES']);
  });

  it('VISUAL_BRIEF supports only PRINT_HTML', () => {
    expect(FORMAT_SUPPORT.VISUAL_BRIEF).toEqual(['PRINT_HTML']);
  });

  it('MARKING_MEMO does not support SLIDES', () => {
    expect(FORMAT_SUPPORT.MARKING_MEMO).not.toContain('SLIDES');
  });

  it('WORKSHEET supports PRINT_HTML, PDF, and DOCX', () => {
    expect(FORMAT_SUPPORT.WORKSHEET).toContain('PRINT_HTML');
    expect(FORMAT_SUPPORT.WORKSHEET).toContain('PDF');
    expect(FORMAT_SUPPORT.WORKSHEET).toContain('DOCX');
  });
});

// ---------------------------------------------------------------------------
// dispatchRender
// ---------------------------------------------------------------------------

describe('dispatchRender', () => {
  it('accepts a worksheet rendered to PDF when a template version is supplied', () => {
    const result = dispatchRender(
      renderRequest() as Parameters<typeof dispatchRender>[0],
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.format).toBe('PDF');
      expect(result.artefactId).toBe(UUID);
      expect(result.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it('returns format_not_supported for BOARD_DECK rendered to PDF', () => {
    const result = dispatchRender(
      renderRequest({
        artefact: { artefactId: UUID, artefactType: 'BOARD_DECK', tenantId: UUID },
        format: 'PDF',
      }) as Parameters<typeof dispatchRender>[0],
    );
    expect(result.status).toBe('format_not_supported');
    if (result.status === 'format_not_supported') {
      expect(result.supportedFormats).toEqual(['SLIDES']);
    }
  });

  it('returns format_not_supported for VISUAL_BRIEF rendered to DOCX', () => {
    const result = dispatchRender(
      renderRequest({
        artefact: { artefactId: UUID, artefactType: 'VISUAL_BRIEF', tenantId: UUID },
        format: 'DOCX',
      }) as Parameters<typeof dispatchRender>[0],
    );
    expect(result.status).toBe('format_not_supported');
    if (result.status === 'format_not_supported') {
      expect(result.supportedFormats).toEqual(['PRINT_HTML']);
    }
  });

  it('returns needs_template when templateVersion is absent', () => {
    const result = dispatchRender(
      renderRequest({ templateVersion: undefined }) as Parameters<
        typeof dispatchRender
      >[0],
    );
    expect(result.status).toBe('needs_template');
    if (result.status === 'needs_template') {
      expect(result.artefactType).toBe('WORKSHEET');
      expect(result.detail).toContain('template');
    }
  });

  it('format_not_supported is checked before needs_template', () => {
    // BOARD_DECK + PDF + no template → format_not_supported (format check wins)
    const result = dispatchRender(
      renderRequest({
        artefact: { artefactId: UUID, artefactType: 'BOARD_DECK', tenantId: UUID },
        format: 'PDF',
        templateVersion: undefined,
      }) as Parameters<typeof dispatchRender>[0],
    );
    expect(result.status).toBe('format_not_supported');
  });
});

// ---------------------------------------------------------------------------
// GradeBand
// ---------------------------------------------------------------------------

describe('GradeBand', () => {
  it('accepts a valid band where minGrade <= maxGrade', () => {
    expect(GradeBand.safeParse({ minGrade: 1, maxGrade: 3 }).success).toBe(true);
    expect(GradeBand.safeParse({ minGrade: 4, maxGrade: 4 }).success).toBe(true);
  });

  it('rejects a band where maxGrade < minGrade', () => {
    const result = GradeBand.safeParse({ minGrade: 5, maxGrade: 3 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/maxGrade.*minGrade/);
    }
  });
});

// ---------------------------------------------------------------------------
// ReadabilityCheckInput
// ---------------------------------------------------------------------------

describe('ReadabilityCheckInput', () => {
  it('accepts valid English readability input', () => {
    const result = ReadabilityCheckInput.safeParse({
      text: 'The dog sat on the mat.',
      targetBand: { minGrade: 1, maxGrade: 3 },
      language: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = ReadabilityCheckInput.safeParse({
      text: '',
      targetBand: { minGrade: 1, maxGrade: 3 },
      language: 'en',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid grade band (maxGrade < minGrade)', () => {
    const result = ReadabilityCheckInput.safeParse({
      text: 'Some text.',
      targetBand: { minGrade: 8, maxGrade: 3 },
      language: 'en',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReadabilityCheckResult
// ---------------------------------------------------------------------------

describe('ReadabilityCheckResult', () => {
  it('parses within_band result', () => {
    const result = ReadabilityCheckResult.safeParse({
      verdict: 'within_band',
      measuredGrade: 2.5,
      targetBand: { minGrade: 1, maxGrade: 3 },
    });
    expect(result.success).toBe(true);
  });

  it('parses cannot_measure result', () => {
    const result = ReadabilityCheckResult.safeParse({
      verdict: 'cannot_measure',
      language: 'zu',
      reason: 'No validated readability metric available for Zulu.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown verdict', () => {
    const result = ReadabilityCheckResult.safeParse({
      verdict: 'inconclusive',
      measuredGrade: 2.5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnswerKeyItem
// ---------------------------------------------------------------------------

describe('AnswerKeyItem', () => {
  it('parses a matching item (agrees = true)', () => {
    const result = AnswerKeyItem.safeParse({
      itemId: 'q1',
      question: 'What is 2 + 2?',
      authorAnswer: '4',
      verifierAnswer: '4',
      agrees: true,
    });
    expect(result.success).toBe(true);
  });

  it('parses a disagreeing item (agrees = false)', () => {
    const result = AnswerKeyItem.safeParse({
      itemId: 'q2',
      question: 'What is the capital of South Africa?',
      authorAnswer: 'Pretoria',
      verifierAnswer: 'Cape Town',
      agrees: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an item with an empty question', () => {
    const result = AnswerKeyItem.safeParse({
      itemId: 'q3',
      question: '',
      authorAnswer: '4',
      verifierAnswer: '4',
      agrees: true,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnswerKeyVerificationResult
// ---------------------------------------------------------------------------

describe('AnswerKeyVerificationResult', () => {
  const agreeItem = {
    itemId: 'q1',
    question: 'What is 2+2?',
    authorAnswer: '4',
    verifierAnswer: '4',
    agrees: true,
  };
  const disagreedItem = {
    itemId: 'q2',
    question: 'What is the capital?',
    authorAnswer: 'Pretoria',
    verifierAnswer: 'Cape Town',
    agrees: false,
  };

  it('parses a verified result with all items agreeing', () => {
    const result = AnswerKeyVerificationResult.safeParse({
      verdict: 'verified',
      items: [agreeItem],
    });
    expect(result.success).toBe(true);
  });

  it('parses a disagreement result with flagged and all items', () => {
    const result = AnswerKeyVerificationResult.safeParse({
      verdict: 'disagreement',
      flaggedItems: [disagreedItem],
      allItems: [agreeItem, disagreedItem],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a verified result with zero items', () => {
    const result = AnswerKeyVerificationResult.safeParse({
      verdict: 'verified',
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a disagreement result with no flagged items', () => {
    const result = AnswerKeyVerificationResult.safeParse({
      verdict: 'disagreement',
      flaggedItems: [],
      allItems: [agreeItem],
    });
    expect(result.success).toBe(false);
  });
});
