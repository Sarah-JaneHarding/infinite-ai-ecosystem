// TB agent input/output schemas — Stage 11 steps 2–3.
//
// TB-01 (Worksheet Builder), TB-03 (Reading Passage Generator),
// TB-04 (Item Writer), TB-05 (Memo & Marking Guide Agent),
// TB-06 (Home-Language Adapter).
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
