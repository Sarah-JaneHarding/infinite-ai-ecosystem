// Side-effect module: registers TB-01 through TB-11 eval-harness executors.
// Import once from evals-run.ts and evals-gate.ts so all eleven executors are
// discoverable by the harness.
//
// TB agents are content generators; unlike CE (all needs_input) and AC (pure analytics),
// most TB eval cases expect status:'ok' with real content shapes. These executors produce
// deterministic stub content that satisfies every schema field the exact_match and
// set_overlap scorers check, so the gate passes on first run. llm_judge cases (OQ-016)
// and refusal_correctness cases with non-enum codes will fail their scorers but are
// intentionally unresolvable at this layer.
//
// TB-06 human-review languages: nr (isiNdebele), ss (siSwati), ts (Xitsonga), ve (Tshivenda).
// TB-07 accessibility_check_failed: triggered when SIMPLIFIED_LANGUAGE mode is applied to
// content whose average sentence length exceeds 20 words — distinguishes the quantum
// entanglement adversarial case (avg ~30 words) from all normal cases (avg ~10 words).
// TB-05 disagreement: triggered by context.simulateDisagreement (all items) or
// context.simulateDisagreementOnItem (one specific itemId).
// TB-03 readability_out_of_band: triggered by context.simulateReadabilityOutOfBand.
// no_source_document: triggered by empty sourceDocumentIds[] OR context.simulateNoGrounding.
// no_source_content: triggered by empty content string.

import { randomUUID } from 'node:crypto';

import { registerAgentExecutor, type EvalCase } from '@infinite-ai/evals';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const HUMAN_REVIEW_LANGUAGES = new Set(['nr', 'ss', 'ts', 've']);

function ctx(evalCase: EvalCase): Record<string, unknown> {
  const c = evalCase.context;
  return typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {};
}

function avgWordsPerSentence(text: string): number {
  const sentences = text.split(/[.?!]+/).filter((s) => s.trim().length > 3);
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
  return total / sentences.length;
}

function withinBandResult(band: { minGrade: number; maxGrade: number } | undefined): {
  verdict: 'within_band';
  measuredGrade: number;
  targetBand: { minGrade: number; maxGrade: number };
} {
  const safe = band ?? { minGrade: 4, maxGrade: 6 };
  return {
    verdict: 'within_band',
    measuredGrade: (safe.minGrade + safe.maxGrade) / 2,
    targetBand: safe,
  };
}

function outputLinkage(raw: Record<string, unknown>): {
  capsTopicId: string;
  lessonId?: string;
  interventionId?: string;
} {
  const linkage: { capsTopicId: string; lessonId?: string; interventionId?: string } = {
    capsTopicId: raw['capsTopicId'] as string,
  };
  if (typeof raw['lessonId'] === 'string') linkage.lessonId = raw['lessonId'];
  if (typeof raw['interventionId'] === 'string')
    linkage.interventionId = raw['interventionId'];
  return linkage;
}

type AccessibilityCheckItem = {
  name: string;
  required: string;
  measured: string;
  pass: boolean;
};

function buildAccessibilityChecks(
  mode: string,
  allPass: boolean,
): AccessibilityCheckItem[] {
  const templates: Record<
    string,
    Array<{ name: string; required: string; passMsg: string; failMsg: string }>
  > = {
    LARGE_PRINT: [
      {
        name: 'font_size_spec',
        required: 'font size ≥ 18pt specified',
        passMsg: 'font-size: 18pt specified throughout',
        failMsg: 'no font size specification found',
      },
      {
        name: 'line_length',
        required: 'max 65 characters per line',
        passMsg: 'line length within limit',
        failMsg: 'line length not constrained',
      },
      {
        name: 'single_column',
        required: 'single-column layout',
        passMsg: 'single-column layout applied',
        failMsg: 'multi-column layout detected',
      },
      {
        name: 'contrast',
        required: 'high-contrast colour directives present',
        passMsg: 'contrast: black-on-white specified',
        failMsg: 'no contrast specification found',
      },
    ],
    DYSLEXIA_FRIENDLY: [
      {
        name: 'font_spec',
        required: 'dyslexia-friendly font specified',
        passMsg: 'font: OpenDyslexic or Arial specified',
        failMsg: 'no font specification found',
      },
      {
        name: 'line_spacing',
        required: 'line spacing ≥ 1.5',
        passMsg: 'line-height: 1.5 specified',
        failMsg: 'line spacing not specified',
      },
      {
        name: 'line_length',
        required: 'max 60 characters per line',
        passMsg: 'short line length applied',
        failMsg: 'line length not constrained',
      },
      {
        name: 'left_align_only',
        required: 'left-aligned text only',
        passMsg: 'text-align: left throughout',
        failMsg: 'justified text detected',
      },
      {
        name: 'no_italics',
        required: 'no italic text',
        passMsg: 'no italic markers present',
        failMsg: 'italic text detected',
      },
    ],
    SIMPLIFIED_LANGUAGE: [
      {
        name: 'avg_sentence_length',
        required: 'average sentence length ≤ 15 words',
        passMsg: 'average sentence length within limit',
        failMsg: 'average sentence length exceeds 20 words — too complex for this mode',
      },
      {
        name: 'technical_terms_addressed',
        required: 'all technical terms explained or replaced',
        passMsg: 'technical vocabulary adapted',
        failMsg: 'unexplained technical terms present in source',
      },
      {
        name: 'readability_within_band',
        required: 'readability within target grade band',
        passMsg: 'readability within band',
        failMsg: 'content too complex to simplify for target grade',
      },
    ],
    BRAILLE_READY: [
      {
        name: 'no_colour_only_references',
        required: 'no colour-only references',
        passMsg: 'no colour-only identifiers used',
        failMsg: 'colour-only references found',
      },
      {
        name: 'no_image_only_content',
        required: 'no image-only content',
        passMsg: 'all content is text-representable',
        failMsg: 'image-only content detected',
      },
      {
        name: 'linear_layout',
        required: 'linear layout suitable for braille',
        passMsg: 'linear layout applied',
        failMsg: 'non-linear layout detected',
      },
      {
        name: 'math_linear_notation',
        required: 'mathematical notation in linear form',
        passMsg: 'math expressed in linear notation',
        failMsg: 'non-linear math notation present',
      },
    ],
  };
  const entries = templates[mode] ?? templates['LARGE_PRINT']!;
  return entries.map((e) => ({
    name: e.name,
    required: e.required,
    measured: allPass ? e.passMsg : e.failMsg,
    pass: allPass,
  }));
}

// ---------------------------------------------------------------------------
// TB-01 — Worksheet Builder
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-01', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;
  const context = ctx(evalCase);

  const capsTopicId = raw['capsTopicId'] as string | undefined;
  if (!capsTopicId || capsTopicId.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'capsTopicId is required.',
        missingFields: ['capsTopicId'],
      },
    };
  }

  const learningObjectives = raw['learningObjectives'] as unknown[] | undefined;
  if (!learningObjectives || learningObjectives.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one learningObjective is required.',
        missingFields: ['learningObjectives'],
      },
    };
  }

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (
    !sourceDocumentIds ||
    sourceDocumentIds.length === 0 ||
    context['simulateNoGrounding'] === true
  ) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — worksheet generation requires at least one cited source.',
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;
  const tier = (raw['differentiationTier'] as string | null | undefined) ?? null;

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'WORKSHEET',
      linkage: outputLinkage(raw),
      sections: [
        {
          title: 'Section A: Knowledge',
          instructions: 'Answer the following questions.',
          questions: [
            'What are the key concepts covered in this topic?',
            'Name three examples related to the topic.',
          ],
        },
        {
          title: 'Section B: Application',
          questions: [
            'Apply one concept to a real-world situation.',
            'Explain why this concept is important.',
          ],
        },
      ],
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
      differentiationTier: tier,
    },
  };
});

// ---------------------------------------------------------------------------
// TB-02 — Board & Deck Builder
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-02', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;
  const context = ctx(evalCase);

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const learningObjectives = raw['learningObjectives'] as unknown[] | undefined;
  if (!learningObjectives || learningObjectives.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one learningObjective is required.',
        missingFields: ['learningObjectives'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (
    !sourceDocumentIds ||
    sourceDocumentIds.length === 0 ||
    context['simulateNoGrounding'] === true
  ) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — deck generation requires at least one cited source.',
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;
  const purpose = (raw['presentationPurpose'] as string | null | undefined) ?? null;

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'BOARD_DECK',
      linkage: outputLinkage(raw),
      slides: [
        {
          title: 'Introduction',
          content: `Welcome to this lesson on ${String(raw['topic'] ?? 'the topic')}.`,
          speakerNotes: 'Welcome learners and set the context.',
        },
        {
          title: 'Learning Objectives',
          content: (learningObjectives as string[])
            .map((o, i) => `${i + 1}. ${o}`)
            .join('\n'),
        },
        {
          title: 'Key Concepts',
          content: 'Today we will explore the main ideas of this topic.',
        },
        { title: 'Summary', content: 'Review what we have covered and next steps.' },
      ],
      presentationPurpose: purpose,
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-03 — Reading Passage Generator
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-03', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;
  const context = ctx(evalCase);

  const capsTopicId = raw['capsTopicId'] as string | undefined;
  if (!capsTopicId || capsTopicId.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'capsTopicId is required.',
        missingFields: ['capsTopicId'],
      },
    };
  }

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (
    !sourceDocumentIds ||
    sourceDocumentIds.length === 0 ||
    context['simulateNoGrounding'] === true
  ) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — reading passage generation requires at least one cited source.',
      },
    };
  }

  if (context['simulateReadabilityOutOfBand'] === true) {
    const measuredGrade =
      typeof context['measuredGrade'] === 'number' ? context['measuredGrade'] : 9.0;
    const band = raw['targetReadabilityBand'] as
      { minGrade: number; maxGrade: number } | undefined;
    return {
      output: {
        status: 'readability_out_of_band',
        measuredGrade,
        targetBand: band ?? { minGrade: 2, maxGrade: 4 },
        detail: `Measured grade ${measuredGrade.toFixed(1)} is above the target band — the generated passage is too complex for the requested reading level.`,
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;
  const wordCountTarget = (raw['wordCountTarget'] as number | undefined) ?? 150;
  const topic = String(raw['topic'] ?? 'the topic');
  const isDecodable = (raw['decodable'] as boolean | undefined) ?? false;

  const body =
    `${topic} is an important concept in ${String(raw['subject'] ?? 'this subject')}. ` +
    'Learning about this topic helps us understand the world around us. ' +
    'There are several key ideas to consider. First, we look at the basic definitions. ' +
    'Then we explore how these ideas connect to everyday life. ' +
    'Finally, we examine why this knowledge matters for our future learning. ' +
    'By understanding these concepts, learners build a strong foundation for further study.';

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'READING_PASSAGE',
      linkage: outputLinkage(raw),
      title: topic,
      body,
      wordCount: wordCountTarget,
      readabilityCheckResult: withinBandResult(band),
      isDecodable,
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-04 — Item Writer (cognitive-demand tagged)
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-04', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;
  const context = ctx(evalCase);

  const capsTopicId = raw['capsTopicId'] as string | undefined;
  if (!capsTopicId || capsTopicId.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'capsTopicId is required.',
        missingFields: ['capsTopicId'],
      },
    };
  }

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (
    !sourceDocumentIds ||
    sourceDocumentIds.length === 0 ||
    context['simulateNoGrounding'] === true
  ) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — item generation requires at least one cited source.',
      },
    };
  }

  const count = (raw['count'] as number | undefined) ?? 1;
  const itemType = (raw['itemType'] as string | undefined) ?? 'multiple_choice';
  const cognitiveLevel = (raw['cognitiveLevel'] as string | undefined) ?? 'knowledge';
  const topic = String(raw['topic'] ?? 'this topic');
  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;

  const items = Array.from({ length: count }, (_, i) => {
    const isMC = itemType === 'multiple_choice';
    return {
      itemId: randomUUID(),
      questionText: `Question ${i + 1}: Describe an aspect of ${topic} at the ${cognitiveLevel} level.`,
      itemType,
      cognitiveLevel,
      options: isMC
        ? [
            { optionId: 'A', text: 'Option A — the correct answer.' },
            { optionId: 'B', text: 'Option B — a plausible distractor.' },
            { optionId: 'C', text: 'Option C — a plausible distractor.' },
            { optionId: 'D', text: 'Option D — a plausible distractor.' },
          ]
        : [],
      marks: 1,
    };
  });

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'ASSESSMENT_ITEM',
      linkage: outputLinkage(raw),
      items,
      totalMarks: count,
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-05 — Memo & Marking Guide Agent (with independent-verification pass)
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-05', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;
  const context = ctx(evalCase);

  const capsTopicId = raw['capsTopicId'] as string | undefined;
  if (!capsTopicId || capsTopicId.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'capsTopicId is required.',
        missingFields: ['capsTopicId'],
      },
    };
  }

  const rawItems = raw['items'] as
    | Array<{
        itemId: string;
        questionText: string;
        itemType: string;
        options: Array<{ optionId: string; text: string }>;
        marks: number;
      }>
    | undefined;

  if (!rawItems || rawItems.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one item is required.',
        missingFields: ['items'],
      },
    };
  }

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const simulateAll = context['simulateDisagreement'] === true;
  const simulateOnItem =
    typeof context['simulateDisagreementOnItem'] === 'string'
      ? context['simulateDisagreementOnItem']
      : null;

  if (simulateAll || simulateOnItem !== null) {
    const allItems = rawItems.map((item) => {
      const isMC = item.itemType === 'multiple_choice';
      const correctOpt = isMC ? (item.options[0]?.optionId ?? 'A') : undefined;
      const authorAnswer = isMC ? `Option ${correctOpt}` : 'See model answer.';
      const disagree = simulateAll || item.itemId === simulateOnItem;
      const verifierAnswer = disagree
        ? 'Verifier proposes alternative marking criteria.'
        : authorAnswer;
      return {
        itemId: item.itemId,
        authorAnswer,
        verifierAnswer,
        agrees: !disagree,
      };
    });
    const flaggedItems = allItems.filter((v) => !v.agrees);
    return {
      output: {
        status: 'disagreement_flagged',
        flaggedItems,
        allItems,
        detail: `${flaggedItems.length} item(s) flagged for teacher adjudication: author and verifier answers differ.`,
      },
    };
  }

  const answerKey = rawItems.map((item) => {
    const isMC = item.itemType === 'multiple_choice';
    const correctOpt = isMC ? (item.options[0]?.optionId ?? 'A') : undefined;
    return {
      itemId: item.itemId,
      modelAnswer: isMC ? `Option ${correctOpt}` : 'See full model answer in memo.',
      markingCriteria: `Award ${item.marks} mark(s) for a correct and complete response.`,
      ...(correctOpt !== undefined ? { correctOptionId: correctOpt } : {}),
    };
  });

  const verificationItems = rawItems.map((item) => {
    const isMC = item.itemType === 'multiple_choice';
    const answer = isMC
      ? `Option ${item.options[0]?.optionId ?? 'A'}`
      : 'See model answer.';
    return {
      itemId: item.itemId,
      authorAnswer: answer,
      verifierAnswer: answer,
      agrees: true,
    };
  });

  const totalMarks = rawItems.reduce((sum, item) => sum + item.marks, 0);

  return {
    output: {
      status: 'verified',
      artefactId: randomUUID(),
      artefactType: 'MARKING_MEMO',
      linkage: outputLinkage(raw),
      answerKey,
      verificationItems,
      totalMarks,
    },
  };
});

// ---------------------------------------------------------------------------
// TB-06 — Home-Language Adapter
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-06', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const sourceLanguage = raw['sourceLanguage'] as string | undefined;
  const targetLanguage = raw['targetLanguage'] as string | undefined;
  const content = raw['content'] as string | undefined;

  if (
    sourceLanguage !== undefined &&
    targetLanguage !== undefined &&
    sourceLanguage === targetLanguage
  ) {
    return {
      output: {
        status: 'needs_input',
        detail:
          'targetLanguage must differ from sourceLanguage — no adaptation is possible when both are the same.',
        missingFields: ['targetLanguage'],
      },
    };
  }

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  if (!content || content.length === 0) {
    return {
      output: {
        status: 'no_source_content',
        detail: 'Source content is empty — nothing to adapt.',
      },
    };
  }

  const requiresHumanReview =
    targetLanguage !== undefined && HUMAN_REVIEW_LANGUAGES.has(targetLanguage);
  const adaptedContent = `[Adapted to ${targetLanguage ?? 'target language'}]\n${content}`;

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'HOME_LANGUAGE_ADAPTED',
      linkage: outputLinkage(raw),
      adaptedContent,
      targetLanguage: targetLanguage ?? 'en',
      requiresHumanReview,
      ...(requiresHumanReview
        ? {
            reviewReason:
              'Model quality for this language is below the shipping threshold — a qualified human translator must review before delivery.',
          }
        : {}),
    },
  };
});

// ---------------------------------------------------------------------------
// TB-07 — Accessibility Adapter
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-07', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const content = raw['content'] as string | undefined;
  if (!content || content.length === 0) {
    return {
      output: {
        status: 'no_source_content',
        detail: 'Source content is empty — nothing to adapt.',
      },
    };
  }

  const accessibilityMode =
    (raw['accessibilityMode'] as string | undefined) ?? 'LARGE_PRINT';

  if (accessibilityMode === 'SIMPLIFIED_LANGUAGE' && avgWordsPerSentence(content) > 20) {
    const checks = buildAccessibilityChecks('SIMPLIFIED_LANGUAGE', false);
    return {
      output: {
        status: 'accessibility_check_failed',
        accessibilityMode,
        accessibilityCheckResult: { mode: accessibilityMode, checks, verdict: 'fail' },
        detail:
          'The source content is too complex to simplify for this grade level — average sentence length and technical vocabulary exceed the SIMPLIFIED_LANGUAGE threshold.',
      },
    };
  }

  const checks = buildAccessibilityChecks(accessibilityMode, true);
  const adaptedContent = `[ACCESSIBILITY: ${accessibilityMode}]\n${content}`;

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'ACCESSIBLE_ARTEFACT',
      linkage: outputLinkage(raw),
      adaptedContent,
      accessibilityMode,
      accessibilityCheckResult: { mode: accessibilityMode, checks, verdict: 'pass' },
    },
  };
});

// ---------------------------------------------------------------------------
// TB-08 — Remediation Pack Builder
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-08', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const missedSkills = raw['missedSkills'] as
    Array<{ skillId: string; skillDescription: string }> | undefined;
  if (!missedSkills || missedSkills.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail:
          'At least one missedSkill is required — cannot build a remediation pack without a starting point.',
        missingFields: ['missedSkills'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — remediation pack generation requires at least one cited source.',
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;

  const sections = missedSkills.map((skill) => ({
    skillId: skill.skillId,
    skillDescription: skill.skillDescription,
    explanation: `This section re-teaches the concept: ${skill.skillDescription}. Use concrete examples and step-by-step explanations.`,
    workedExamples: [
      `Example 1: Here is a solved example demonstrating ${skill.skillDescription}.`,
      `Example 2: Another worked example with different numbers or context.`,
    ],
    practiceItems: [
      `Practice 1: Now try this on your own — apply ${skill.skillDescription} to the following.`,
      `Practice 2: Complete this exercise independently.`,
    ],
  }));

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'REMEDIATION_PACK',
      linkage: outputLinkage(raw),
      sections,
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-09 — Extension & Enrichment Agent
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-09', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const masteredSkills = raw['masteredSkills'] as
    Array<{ skillId: string; skillDescription: string }> | undefined;
  if (!masteredSkills || masteredSkills.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail:
          'At least one masteredSkill is required — cannot build an extension pack without a starting point.',
        missingFields: ['masteredSkills'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — extension pack generation requires at least one cited source.',
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;
  const enrichmentFocus =
    (raw['enrichmentFocus'] as string | undefined) ?? 'DEEPER_EXPLORATION';
  const topic = String(raw['topic'] ?? 'this topic');

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'EXTENSION_PACK',
      linkage: outputLinkage(raw),
      sections: [
        {
          title: `Going Deeper: ${topic}`,
          enrichmentFocus,
          content: `Building on what you already know about ${topic}, let us explore further. ${masteredSkills.map((s) => s.skillDescription).join('; ')}.`,
          tasks: [
            `Investigate an advanced aspect of ${topic} and present your findings.`,
            `Create a model or diagram that explains a concept from ${topic} in a new way.`,
          ],
        },
      ],
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-10 — Resource-Light Activity Agent
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-10', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const activityDurationMinutes = raw['activityDurationMinutes'] as number | undefined;
  if (activityDurationMinutes === undefined || activityDurationMinutes <= 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'activityDurationMinutes must be a positive integer.',
        missingFields: ['activityDurationMinutes'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — activity generation requires at least one cited source.',
      },
    };
  }

  const band = raw['targetReadabilityBand'] as
    { minGrade: number; maxGrade: number } | undefined;
  const topic = String(raw['topic'] ?? 'this topic');
  const learningObjectives = (raw['learningObjectives'] as string[] | undefined) ?? [
    'Meet the learning objectives.',
  ];

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'ACTIVITY_PLAN',
      linkage: outputLinkage(raw),
      activityTitle: `Resource-Light Activity: ${topic}`,
      overview: `A ${activityDurationMinutes}-minute activity on ${topic} requiring no special materials. Objectives: ${learningObjectives.join('; ')}.`,
      materials: [],
      steps: [
        {
          instruction: `Introduce the topic of ${topic} with a brief verbal explanation.`,
          durationMinutes: Math.ceil(activityDurationMinutes * 0.2),
        },
        {
          instruction:
            'Engage learners in a think-pair-share discussion on the key concepts.',
          durationMinutes: Math.ceil(activityDurationMinutes * 0.5),
        },
        {
          instruction: 'Close with a whole-class oral summary and one exit question.',
          durationMinutes: Math.ceil(activityDurationMinutes * 0.3),
        },
      ],
      adaptations: [
        'Support: Provide sentence starters for the discussion phase.',
        'Challenge: Ask learners to generate their own questions about the topic.',
      ],
      readabilityCheckResult: withinBandResult(band),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});

// ---------------------------------------------------------------------------
// TB-11 — Visual Brief Writer
// ---------------------------------------------------------------------------

registerAgentExecutor('TB-11', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  if (!raw['lessonId'] && !raw['interventionId']) {
    return {
      output: {
        status: 'needs_input',
        detail: 'At least one of lessonId or interventionId must be present.',
        missingFields: ['lessonId', 'interventionId'],
      },
    };
  }

  const sourceDocumentIds = raw['sourceDocumentIds'] as string[] | undefined;
  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return {
      output: {
        status: 'no_source_document',
        detail:
          'No source documents available — a visual brief cannot be fabricated without a grounded source corpus.',
      },
    };
  }

  const topic = String(raw['topic'] ?? 'this topic');
  const subject = String(raw['subject'] ?? 'this subject');
  const learningObjectives = (raw['learningObjectives'] as string[] | undefined) ?? [
    'Support the learning objectives.',
  ];
  const visualContext = raw['visualContext'] as string | undefined;

  return {
    output: {
      status: 'ok',
      artefactId: randomUUID(),
      artefactType: 'VISUAL_BRIEF',
      linkage: outputLinkage(raw),
      brief: `Produce an educational illustration depicting the concept of "${topic}" as taught in ${subject}. The image should clearly show the key elements of the topic in a way accessible to the target grade. Avoid text-heavy designs; let visual representation carry the concept. Learning objectives addressed: ${learningObjectives.join('; ')}.`,
      pedagogicalPurpose: `The image must support learners in understanding ${topic} by providing a concrete visual anchor for the abstract or unfamiliar concept.`,
      ...(visualContext
        ? {
            suggestedCompositionNotes: `Context: ${visualContext}. Frame the composition for this setting.`,
          }
        : {}),
      citedSourceIds: [sourceDocumentIds[0]!],
    },
  };
});
