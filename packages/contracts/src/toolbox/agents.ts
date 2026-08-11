// TB agent input/output schemas — Stage 11 steps 2–6.
//
// TB-01 (Worksheet Builder), TB-02 (Board & Deck Builder),
// TB-03 (Reading Passage Generator), TB-04 (Item Writer),
// TB-05 (Memo & Marking Guide Agent), TB-06 (Home-Language Adapter),
// TB-10 (Resource-Light Activity Agent).
//
// Every input enforces the strict parameter: capsTopicId is required, and at least one of
// lessonId or interventionId must be present. Every 'no_source_document' output variant
// enforces the "no fabricated sources" rule — an agent with no grounding documents must
// refuse rather than invent content.
//
// TB-05's 'disagreement_flagged' output blocks release to the teacher: the marking memo
// is never seen until the independent-verification pass agrees on every item.
//
// TB-06's 'requiresHumanReview' flag is set when adapting to a language where the model's
// quality is below the shipping threshold — the output is produced but must be reviewed by
// a qualified human translator before delivery. No language is shipped without an eval set.

import { z } from 'zod';

import { CognitiveLevel } from '../curriculum/planning.js';
import { GradeLabel } from '../curriculum/framework.js';
import { ToolboxArtefactType } from './artefact.js';
import { AccessibilityCheckResult, AccessibilityMode } from './accessibility.js';
import { GradeBand, ReadabilityCheckResult } from './readability.js';

// ---------------------------------------------------------------------------
// Shared input fragment (used by all four TB agents)
// ---------------------------------------------------------------------------

/**
 * CAPS topic linkage base object — extended by each TB agent's input schema.
 * The refinement is applied after extension so `.extend()` is called on a ZodObject.
 */
const TBLinkageBase = z.object({
  capsTopicId: z.string().min(1),
  lessonId: z.string().uuid().optional(),
  interventionId: z.string().uuid().optional(),
});

/** Shared superRefine that enforces at least one linkage field. */
const requireOneLinkage = (
  v: { lessonId?: string | undefined; interventionId?: string | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (v.lessonId === undefined && v.interventionId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'At least one of lessonId or interventionId must be present.',
    });
  }
};

/** The linkage fields that appear inside every TB-agent output's 'ok' variant. */
export const TBOutputLinkage = z.object({
  capsTopicId: z.string().min(1),
  lessonId: z.string().uuid().optional(),
  interventionId: z.string().uuid().optional(),
});
export type TBOutputLinkage = z.infer<typeof TBOutputLinkage>;

// ---------------------------------------------------------------------------
// TB-01 — Worksheet Builder
// ---------------------------------------------------------------------------

export const WorksheetDifferentiationTier = z.enum(['SUPPORT', 'STANDARD', 'EXTENSION']);
export type WorksheetDifferentiationTier = z.infer<typeof WorksheetDifferentiationTier>;

export const WorksheetSection = z.object({
  title: z.string().min(1),
  instructions: z.string().optional(),
  /** Ordered question or task prompts within this section. */
  questions: z.array(z.string().min(1)).min(1),
});
export type WorksheetSection = z.infer<typeof WorksheetSection>;

export const TB01Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  targetReadabilityBand: GradeBand,
  /** ISO 639-1 language code. */
  language: z.string().min(2).max(5),
  /** All content must be grounded in at least one cited document. */
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
  differentiationTier: WorksheetDifferentiationTier.optional(),
}).superRefine(requireOneLinkage);
export type TB01Input = z.infer<typeof TB01Input>;

export const TB01Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('WORKSHEET'),
    linkage: TBOutputLinkage,
    sections: z.array(WorksheetSection).min(1),
    readabilityCheckResult: ReadabilityCheckResult,
    /** Every cited source must appear in the input's `sourceDocumentIds`. */
    citedSourceIds: z.array(z.string().min(1)).min(1),
    differentiationTier: WorksheetDifferentiationTier.nullable(),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB01Result = z.infer<typeof TB01Result>;

// ---------------------------------------------------------------------------
// TB-02 — Board & Deck Builder
// ---------------------------------------------------------------------------

/**
 * The instructional purpose of the presentation deck.
 * INTRODUCTION — opens a new topic or concept.
 * LESSON — delivers the core lesson content.
 * REVIEW — revisits and consolidates prior learning.
 * CONSOLIDATION — synthesises and checks understanding at the end of a unit.
 */
export const PresentationPurpose = z.enum([
  'INTRODUCTION',
  'LESSON',
  'REVIEW',
  'CONSOLIDATION',
]);
export type PresentationPurpose = z.infer<typeof PresentationPurpose>;

/** One slide in a board or presentation deck. */
export const Slide = z.object({
  title: z.string().min(1),
  /** Body text, bullet points, or narrative content for this slide. */
  content: z.string().min(1),
  /** Optional presenter notes — spoken context not shown to learners. */
  speakerNotes: z.string().min(1).optional(),
});
export type Slide = z.infer<typeof Slide>;

export const TB02Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  targetReadabilityBand: GradeBand,
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
  presentationPurpose: PresentationPurpose.optional(),
  /** Desired number of slides. The agent should aim for this count ±2. */
  slideCount: z.number().int().min(3).max(30).optional(),
}).superRefine(requireOneLinkage);
export type TB02Input = z.infer<typeof TB02Input>;

export const TB02Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('BOARD_DECK'),
    linkage: TBOutputLinkage,
    slides: z.array(Slide).min(1),
    presentationPurpose: PresentationPurpose.nullable(),
    readabilityCheckResult: ReadabilityCheckResult,
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB02Result = z.infer<typeof TB02Result>;

// ---------------------------------------------------------------------------
// TB-03 — Reading Passage Generator
// ---------------------------------------------------------------------------

export const TB03Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  targetReadabilityBand: GradeBand,
  /** Target number of words. The agent should aim within ±10% of this value. */
  wordCountTarget: z.number().int().positive(),
  language: z.string().min(2).max(5),
  /**
   * When true, the passage must use only decodable letter-sound correspondences up to the
   * learner's current phase — Foundation Phase only. Defaults to false.
   */
  decodable: z.boolean().default(false),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB03Input = z.infer<typeof TB03Input>;

export const TB03Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('READING_PASSAGE'),
    linkage: TBOutputLinkage,
    title: z.string().min(1),
    body: z.string().min(1),
    wordCount: z.number().int().positive(),
    readabilityCheckResult: ReadabilityCheckResult,
    isDecodable: z.boolean(),
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('readability_out_of_band'),
    measuredGrade: z.number(),
    targetBand: GradeBand,
    detail: z.string().min(1),
  }),
]);
export type TB03Result = z.infer<typeof TB03Result>;

// ---------------------------------------------------------------------------
// TB-04 — Item Writer (cognitive-demand tagged)
// ---------------------------------------------------------------------------

export const AssessmentItemType = z.enum([
  'multiple_choice',
  'short_answer',
  'extended_response',
  'true_false',
]);
export type AssessmentItemType = z.infer<typeof AssessmentItemType>;

/** One option in a multiple-choice item. The answer key lives in TB-05, not here. */
export const MCOption = z.object({
  optionId: z.string().min(1),
  text: z.string().min(1),
});
export type MCOption = z.infer<typeof MCOption>;

/** One written assessment item — question only, no answer. Answer key is TB-05's domain. */
export const AssessmentItem = z.object({
  itemId: z.string().uuid(),
  questionText: z.string().min(1),
  itemType: AssessmentItemType,
  cognitiveLevel: CognitiveLevel,
  /** For multiple_choice, exactly four options. For other types, empty. */
  options: z.array(MCOption),
  marks: z.number().int().positive(),
});
export type AssessmentItem = z.infer<typeof AssessmentItem>;

export const TB04Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  cognitiveLevel: CognitiveLevel,
  itemType: AssessmentItemType,
  /** How many items to produce. */
  count: z.number().int().min(1).max(20),
  targetReadabilityBand: GradeBand,
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB04Input = z.infer<typeof TB04Input>;

export const TB04Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('ASSESSMENT_ITEM'),
    linkage: TBOutputLinkage,
    items: z.array(AssessmentItem).min(1),
    totalMarks: z.number().int().positive(),
    readabilityCheckResult: ReadabilityCheckResult,
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB04Result = z.infer<typeof TB04Result>;

// ---------------------------------------------------------------------------
// TB-05 — Memo & Marking Guide Agent (with independent-verification pass)
// ---------------------------------------------------------------------------

/** One item sent to TB-05 for answer-key production (questions + mark allocation). */
export const TB05ItemInput = z.object({
  itemId: z.string().uuid(),
  questionText: z.string().min(1),
  itemType: AssessmentItemType,
  options: z.array(MCOption),
  marks: z.number().int().positive(),
});
export type TB05ItemInput = z.infer<typeof TB05ItemInput>;

/** One item in the produced answer key (before or after verification). */
export const AnswerKeyEntry = z.object({
  itemId: z.string().uuid(),
  modelAnswer: z.string().min(1),
  markingCriteria: z.string().min(1),
  /** For multiple_choice, the optionId of the correct answer. */
  correctOptionId: z.string().optional(),
});
export type AnswerKeyEntry = z.infer<typeof AnswerKeyEntry>;

/** One verifier's independent answers for comparison. */
export const VerifierAnswers = z.object({
  itemId: z.string().uuid(),
  verifierAnswer: z.string().min(1),
  correctOptionId: z.string().optional(),
});
export type VerifierAnswers = z.infer<typeof VerifierAnswers>;

/** Per-item verification comparison result. */
export const TB05VerificationItem = z.object({
  itemId: z.string().uuid(),
  authorAnswer: z.string().min(1),
  verifierAnswer: z.string().min(1),
  agrees: z.boolean(),
});
export type TB05VerificationItem = z.infer<typeof TB05VerificationItem>;

export const TB05Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  /** The TB-04 output artefact this memo is built for. */
  assessmentArtefactId: z.string().uuid(),
  items: z.array(TB05ItemInput).min(1),
  language: z.string().min(2).max(5),
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB05Input = z.infer<typeof TB05Input>;

export const TB05Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('verified'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('MARKING_MEMO'),
    linkage: TBOutputLinkage,
    answerKey: z.array(AnswerKeyEntry).min(1),
    /** Every item agreed between author and verifier. */
    verificationItems: z.array(TB05VerificationItem).min(1),
    totalMarks: z.number().int().positive(),
  }),
  z.object({
    status: z.literal('disagreement_flagged'),
    /** Items where author and verifier answers differ — blocks release. Teacher adjudicates. */
    flaggedItems: z.array(TB05VerificationItem).min(1),
    allItems: z.array(TB05VerificationItem).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type TB05Result = z.infer<typeof TB05Result>;

// ---------------------------------------------------------------------------
// TB-06 — Home-Language Adapter (all eleven official South African languages)
// ---------------------------------------------------------------------------

/** The eleven official South African languages (ISO 639-1 / ISO 639-3 codes). */
export const OfficialLanguage = z.enum([
  'af', // Afrikaans
  'en', // English
  'nr', // isiNdebele
  'xh', // isiXhosa
  'zu', // isiZulu
  'nso', // Sesotho sa Leboa (Northern Sotho / Sepedi)
  'st', // Sesotho
  'tn', // Setswana
  'ss', // siSwati
  've', // Tshivenda
  'ts', // Xitsonga
]);
export type OfficialLanguage = z.infer<typeof OfficialLanguage>;

export const TB06Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  /** UUID of the source artefact being adapted. */
  sourceArtefactId: z.string().uuid(),
  /** Type of the source artefact — determines how content is structured for adaptation. */
  sourceArtefactType: ToolboxArtefactType,
  /** Full text content of the source artefact to adapt. */
  content: z.string().min(1),
  /** ISO code of the source language. */
  sourceLanguage: OfficialLanguage,
  /** ISO code of the target language. Must differ from sourceLanguage. */
  targetLanguage: OfficialLanguage,
  /** The school's declared Language of Learning and Teaching for this class. */
  loltLanguage: OfficialLanguage,
  requestedBy: z.string().min(1),
})
  .superRefine(requireOneLinkage)
  .superRefine((v, ctx) => {
    if (v.sourceLanguage === v.targetLanguage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetLanguage'],
        message: 'targetLanguage must differ from sourceLanguage.',
      });
    }
  });
export type TB06Input = z.infer<typeof TB06Input>;

export const TB06Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('HOME_LANGUAGE_ADAPTED'),
    linkage: TBOutputLinkage,
    adaptedContent: z.string().min(1),
    targetLanguage: OfficialLanguage,
    /**
     * When true, a qualified human translator must review this output before it is delivered.
     * Set for languages where the model's quality is below the shipping threshold.
     * The artefact pipeline must not deliver a requiresHumanReview=true artefact without a
     * recorded human-review approval.
     */
    requiresHumanReview: z.boolean(),
    /** Present whenever requiresHumanReview is true — explains which quality concern applies. */
    reviewReason: z.string().min(1).optional(),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_content'),
    detail: z.string().min(1),
  }),
]);
export type TB06Result = z.infer<typeof TB06Result>;

// ---------------------------------------------------------------------------
// TB-07 — Accessibility Adapter
// ---------------------------------------------------------------------------

export const TB07Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  /** UUID of the source artefact being adapted. */
  sourceArtefactId: z.string().uuid(),
  /** Type of the source artefact — determines how content is structured for adaptation. */
  sourceArtefactType: ToolboxArtefactType,
  /** Full text content of the source artefact to adapt. */
  content: z.string().min(1),
  /** ISO 639-1 language code the content is written in. */
  language: z.string().min(2).max(5),
  /** The accessibility mode to apply. */
  accessibilityMode: AccessibilityMode,
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB07Input = z.infer<typeof TB07Input>;

export const TB07Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('ACCESSIBLE_ARTEFACT'),
    linkage: TBOutputLinkage,
    adaptedContent: z.string().min(1),
    accessibilityMode: AccessibilityMode,
    /** All checks must pass when status is 'ok'. */
    accessibilityCheckResult: AccessibilityCheckResult,
  }),
  z.object({
    status: z.literal('accessibility_check_failed'),
    accessibilityMode: AccessibilityMode,
    /** One or more checks failed; the adapted content cannot meet the mode's requirements. */
    accessibilityCheckResult: AccessibilityCheckResult,
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_content'),
    detail: z.string().min(1),
  }),
]);
export type TB07Result = z.infer<typeof TB07Result>;

// ---------------------------------------------------------------------------
// TB-08 — Remediation Pack Builder
// ---------------------------------------------------------------------------

/**
 * One remediation section, targeting a single missed skill.
 * Explanation re-teaches the concept; worked examples model it; practice items
 * let the learner attempt it independently.
 */
export const RemediationSection = z.object({
  skillId: z.string().min(1),
  skillDescription: z.string().min(1),
  /** Plain-language re-teaching of the concept. */
  explanation: z.string().min(1),
  /** Step-by-step solved examples showing the skill applied. */
  workedExamples: z.array(z.string().min(1)).min(1),
  /** Practice questions the learner attempts independently after the examples. */
  practiceItems: z.array(z.string().min(1)).min(1),
});
export type RemediationSection = z.infer<typeof RemediationSection>;

export const TB08Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  /**
   * Skills identified as missed in assessment. Each entry has a CAPS sub-skill
   * identifier and a human-readable description of what the learner could not do.
   * The sub-skill graph in L1 is used to select prerequisite concepts where needed.
   */
  missedSkills: z
    .array(
      z.object({
        skillId: z.string().min(1),
        skillDescription: z.string().min(1),
      }),
    )
    .min(1),
  targetReadabilityBand: GradeBand,
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB08Input = z.infer<typeof TB08Input>;

export const TB08Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('REMEDIATION_PACK'),
    linkage: TBOutputLinkage,
    /** One section per missed skill, in the order supplied in the input. */
    sections: z.array(RemediationSection).min(1),
    readabilityCheckResult: ReadabilityCheckResult,
    /** Every cited source must appear in the input's sourceDocumentIds. */
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB08Result = z.infer<typeof TB08Result>;

// ---------------------------------------------------------------------------
// TB-09 — Extension & Enrichment Agent
// ---------------------------------------------------------------------------

/**
 * The kind of extension activity the agent should produce.
 * DEEPER_EXPLORATION — goes further within the same topic.
 * CHALLENGE_TASKS — harder versions of the same skill type.
 * CROSS_CURRICULAR — applies the skill in a different subject context.
 * HIGHER_ORDER_THINKING — synthesis, evaluation, or creation tasks (top Bloom tiers).
 */
export const EnrichmentFocus = z.enum([
  'DEEPER_EXPLORATION',
  'CHALLENGE_TASKS',
  'CROSS_CURRICULAR',
  'HIGHER_ORDER_THINKING',
]);
export type EnrichmentFocus = z.infer<typeof EnrichmentFocus>;

/** One enrichment section, targeting a particular focus type. */
export const ExtensionSection = z.object({
  title: z.string().min(1),
  enrichmentFocus: EnrichmentFocus,
  /** Explanatory text, background, or challenge framing for this section. */
  content: z.string().min(1),
  /** Ordered tasks or challenge questions the learner works through. */
  tasks: z.array(z.string().min(1)).min(1),
});
export type ExtensionSection = z.infer<typeof ExtensionSection>;

export const TB09Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  /**
   * Skills the learner has already mastered — the starting point for extension.
   * The agent builds on these rather than re-teaching them.
   */
  masteredSkills: z
    .array(
      z.object({
        skillId: z.string().min(1),
        skillDescription: z.string().min(1),
      }),
    )
    .min(1),
  enrichmentFocus: EnrichmentFocus,
  targetReadabilityBand: GradeBand,
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}).superRefine(requireOneLinkage);
export type TB09Input = z.infer<typeof TB09Input>;

export const TB09Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('EXTENSION_PACK'),
    linkage: TBOutputLinkage,
    sections: z.array(ExtensionSection).min(1),
    readabilityCheckResult: ReadabilityCheckResult,
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB09Result = z.infer<typeof TB09Result>;

// ---------------------------------------------------------------------------
// TB-10 — Resource-Light Activity Agent
// ---------------------------------------------------------------------------

/**
 * Classroom resource constraints the activity must respect.
 * NO_PRINTING — no printed materials; everything oral or on the board.
 * NO_DEVICES — no phones, tablets, or computers.
 * NO_ELECTRICITY — no mains power; no projectors, no electric devices.
 * ORAL_ONLY — everything delivered and responded to verbally; no writing.
 */
export const ResourceConstraint = z.enum([
  'NO_PRINTING',
  'NO_DEVICES',
  'NO_ELECTRICITY',
  'ORAL_ONLY',
]);
export type ResourceConstraint = z.infer<typeof ResourceConstraint>;

/** One step in a resource-light classroom activity. */
export const ActivityStep = z.object({
  instruction: z.string().min(1),
  /** Expected duration for this step in minutes. */
  durationMinutes: z.number().int().positive().optional(),
});
export type ActivityStep = z.infer<typeof ActivityStep>;

export const TB10Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  /** Target total duration of the activity in minutes. */
  activityDurationMinutes: z.number().int().positive(),
  targetReadabilityBand: GradeBand,
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
  /** Resource constraints the activity must respect. Absent means no special constraints. */
  resourceConstraints: z.array(ResourceConstraint).optional(),
}).superRefine(requireOneLinkage);
export type TB10Input = z.infer<typeof TB10Input>;

export const TB10Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('ACTIVITY_PLAN'),
    linkage: TBOutputLinkage,
    activityTitle: z.string().min(1),
    /** Brief overview of the activity for the teacher. */
    overview: z.string().min(1),
    /** Materials needed — must respect any declared resourceConstraints. */
    materials: z.array(z.string().min(1)),
    steps: z.array(ActivityStep).min(1),
    /** Adaptations for learners who need more support or more challenge. */
    adaptations: z.array(z.string().min(1)),
    readabilityCheckResult: ReadabilityCheckResult,
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB10Result = z.infer<typeof TB10Result>;

// ---------------------------------------------------------------------------
// TB-11 — Visual Brief Writer
// ---------------------------------------------------------------------------

/**
 * Input for TB-11. Like other TB agents it requires CAPS topic linkage and at least
 * one source document (no image brief may be fabricated without grounding). There is
 * no targetReadabilityBand: the brief is written for a teacher/artist, not a learner.
 *
 * `visualContext` optionally describes the intended display setting (e.g. "classroom
 * display", "worksheet illustration") to help the artist frame the composition.
 */
export const TB11Input = TBLinkageBase.extend({
  tenantId: z.string().uuid(),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  topic: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  language: z.string().min(2).max(5),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
  /** Optional context about the intended display setting for the image. */
  visualContext: z.string().optional(),
}).superRefine(requireOneLinkage);
export type TB11Input = z.infer<typeof TB11Input>;

export const TB11Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    artefactType: z.literal('VISUAL_BRIEF'),
    linkage: TBOutputLinkage,
    /** Written description of the image the teacher should commission. */
    brief: z.string().min(1),
    /** What pedagogical concept or skill the image must serve. */
    pedagogicalPurpose: z.string().min(1),
    /** Optional composition notes for the artist or photographer. */
    suggestedCompositionNotes: z.string().optional(),
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal('no_source_document'),
    detail: z.string().min(1),
  }),
]);
export type TB11Result = z.infer<typeof TB11Result>;
