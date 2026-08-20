// @infinite-ai/contracts — Zod schemas shared by the API, agents and UI. Three families
// live here: the POPIA vocabularies (purpose taxonomy, consent ledger, retention schedule),
// the curriculum framework, and the Model Gateway's OpenAI-compatible wire contract.
//
// These are contracts rather than implementations on purpose. `packages/policy` decides,
// `packages/db` stores and the modules consume — and all three agree because each agrees
// with this package, rather than with one another.

export {
  DataCategory,
  PURPOSES,
  Purpose,
  definitionOf,
  permits,
  projectCategories,
  type CategoryProjection,
  type PurposeDefinition,
} from './popia/purpose.js';

export {
  ConsentDecision,
  ConsentEntry,
  ConsentEntryDraft,
  ConsentSource,
  LawfulBasis,
  WITHDRAWABLE_BASES,
  isWithdrawable,
} from './popia/consent.js';

export {
  RetentionAnchor,
  RetentionRule,
  RetentionSchedule,
  addMonths,
  evaluateRetention,
  reviewSchedule,
  ruleFor,
  unscheduledCategories,
  type RetainableRecord,
  type RetentionVerdict,
  type ScheduleFinding,
  type ScheduleReview,
} from './popia/retention.js';

export {
  AssessmentWeighting,
  CurriculumFramework,
  FrameworkNeedsInput,
  FrameworkResult,
  GradeFramework,
  GradeLabel,
  Phase,
  SourceRef,
  Sourced,
  SubjectFramework,
  TimeAllocation,
} from './curriculum/framework.js';

export {
  ArtefactType,
  TemplateDefinition,
  TemplateField,
  TemplateSection,
  checkArtefactStructure,
  type ArtefactStructure,
  type TemplateFidelityViolation,
} from './curriculum/template.js';

export {
  ATPNeedsInput,
  ATPResult,
  ATPSchedule,
  ATPTopicEntry,
  ATPWeek,
  CE01Input,
  CE02Input,
  SchoolCalendarBlock,
  WeekKind,
} from './curriculum/atp.js';

export {
  CE03Input,
  CE04Input,
  CognitiveLevel,
  EvidenceItem,
  SuccessCriterion,
  TermAssessmentTask,
  TermPlan,
  TermPlanNeedsInput,
  TermPlanResult,
  TermPlanSubject,
  TermPlanWeekEntry,
  UnitBlueprint,
  UnitBlueprintResult,
  UnitNeedsInput,
} from './curriculum/planning.js';

export {
  ActivityKind,
  CE05Input,
  CE08Input,
  DifferentiatedSet,
  DifferentiatedTier,
  DifferentiationNeedsInput,
  DifferentiationResult,
  DifferentiationTierName,
  Lesson,
  LessonActivity,
  LessonPlan,
  LessonPlanNeedsInput,
  LessonPlanResult,
} from './curriculum/lesson.js';

export {
  AssessmentDesignNeedsInput,
  AssessmentQuestion,
  AssessmentSection,
  AssessmentTaskDesign,
  AssessmentTaskDesignResult,
  AssessmentTaskKind,
  CE06Input,
  CE07Input,
  CognitiveLevelSpread,
  Rubric,
  RubricCriterion,
  RubricDescriptors,
  RubricNeedsInput,
  RubricResult,
} from './curriculum/assessment.js';

export {
  CE09Input,
  CoverageAudit,
  CoverageAuditNeedsInput,
  CoverageAuditResult,
  DriftItem,
  DriftKind,
  EpisodeLog,
  EpisodeLogEntry,
} from './curriculum/coverage.js';

export {
  BINARY_FORMATS,
  ExportFormat,
  ExportJob,
  ExportJobStatus,
  ExportRequest,
  ExportResult,
  PUBLICATION_CHANNELS,
  PublicationTarget,
} from './curriculum/export.js';

export {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamEvent,
  ChatCompletionUsage,
  ChatMessage,
  ChatRole,
  DeidentificationProvenance,
  EmbeddingsRequest,
  EmbeddingsResponse,
  GatewayErrorBody,
  GatewayErrorCode,
  LogicalModel,
  ToolCall,
  ToolDefinition,
} from './gateway/chat.js';

export {
  ARTEFACT_TYPE_TO_AGENT,
  AccessibilityCheckItem,
  AccessibilityCheckResult,
  AccessibilityMode,
  ActivityStep,
  AnswerKeyEntry,
  AnswerKeyItem,
  AnswerKeyVerificationResult,
  ArtefactLinkage,
  AssessmentItem,
  AssessmentItemType,
  EnrichmentFocus,
  ExtensionSection,
  FORMAT_SUPPORT,
  GradeBand,
  MCOption,
  OfficialLanguage,
  PresentationPurpose,
  ReadabilityCheckInput,
  ReadabilityCheckResult,
  RemediationSection,
  RenderRequest,
  RenderResult,
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
  TeacherEditSignal,
  ToolboxArtefact,
  ToolboxArtefactType,
  ToolboxEditDiff,
  ToolboxEditField,
  ToolboxOutputFormat,
  VerifierAnswers,
  VisualBrief,
  WorksheetDifferentiationTier,
  WorksheetSection,
  dispatchRender,
} from './toolbox/index.js';

export {
  ArtefactEditRate,
  AssessmentItemSignal,
  AssessmentSignal,
  CoachingSession,
  CohortSuppressionResult,
  CoverageSignal,
  FlaggedItem,
  MINIMUM_COHORT_SIZE,
  MicroCourseModule,
  ObservationTheme,
  PD01Input,
  PD01Result,
  PD02CognitiveLevelCounts,
  PD02Input,
  PD02Result,
  PD03Input,
  PD03Result,
  PD04Input,
  PD04Result,
  PD05Input,
  PD05Result,
  PD06Input,
  PD06Result,
  PD07Input,
  PD07Result,
  PD08Input,
  PD08Result,
  PDNeedArea,
  PriorityGap,
  TeachingSignal,
  TopicDeliveryStatus,
  TopicGap,
  WalkthroughFocus,
  WalkthroughNote,
} from './mod-05/index.js';

export {
  AttributionMethod,
  COMMONS_K_ANONYMITY_THRESHOLD,
  CorrectionType,
  DecayReason,
  ExemplarCandidate,
  FieldCorrection,
  GatekeeperVerdict,
  HITLEventType,
  LabelledLearningEvent,
  LE01Input,
  LE01Result,
  LE02Input,
  LE02Result,
  LE03Input,
  LE03Result,
  LE04Input,
  LE04Result,
  LE05Input,
  LE05Result,
  LE06Input,
  LE06Result,
  LE07Input,
  LE07Result,
  LE08Input,
  LE08Result,
  LE09Input,
  LE09Result,
  MaturityLevel,
  MaturityReport,
  MinedPattern,
  PATTERN_MIN_SAMPLE_SIZE,
  PromotionLogEntry,
  PromptChallenger,
  PublishedPattern,
} from './learning/index.js';

export {
  CAPS_CODING_ROBOTICS_R3_DOC_ID,
  CAPS_CODING_ROBOTICS_R3_VERSION,
  CAPS_CR_R3_METADATA,
  CAPS_CR_R3_STRANDS,
  CodingRoboticsStrandId,
  EXPECTED_TERM_HOURS,
  StrandTermAllocation,
  type CapsCodingRoboticsR3Metadata,
} from './curriculum/sources/caps-coding-robotics-r3.js';

export {
  CAPS_IP_LIFE_SKILLS_GR46_DOC_ID,
  CAPS_IP_LIFE_SKILLS_GR46_METADATA,
  CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS,
  CAPS_IP_LIFE_SKILLS_GR46_VERSION,
  EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS,
  IPLifeSkillsStudyAreaId,
  StudyAreaAnnualAllocation,
  type CapsIPLifeSkillsGr46Metadata,
} from './curriculum/sources/caps-life-skills-ip-gr46.js';

export {
  CAPS_ISIZULU_FAL_GR13_DOC_ID,
  CAPS_ISIZULU_FAL_GR13_METADATA,
  CAPS_ISIZULU_FAL_GR13_SKILLS,
  CAPS_ISIZULU_FAL_GR13_VERSION,
  EXPECTED_FAL_WEEKLY_HOURS,
  FALSkillWeeklyAllocation,
  IsiZuluFALSkillId,
  type CapsIsiZuluFALGr13Metadata,
} from './curriculum/sources/caps-isizulu-fal-gr1-3.js';

export {
  CAPS_LIFE_SKILLS_R3_DOC_ID,
  CAPS_LIFE_SKILLS_R3_METADATA,
  CAPS_LIFE_SKILLS_R3_STUDY_AREAS,
  CAPS_LIFE_SKILLS_R3_VERSION,
  EXPECTED_LIFE_SKILLS_TERM_HOURS,
  LifeSkillsStudyAreaId,
  StudyAreaTermAllocation,
  type CapsLifeSkillsR3Metadata,
} from './curriculum/sources/caps-life-skills-r3.js';

export {
  CAPS_LO_SP_GR79_DOC_ID,
  CAPS_LO_SP_GR79_METADATA,
  CAPS_LO_SP_GR79_TOPICS,
  CAPS_LO_SP_GR79_VERSION,
  EXPECTED_LO_CONTACT_HOURS,
  LifeOrientationTopicId,
  TopicAnnualAllocation,
  type CapsLOSpGr79Metadata,
} from './curriculum/sources/caps-life-orientation-sp-gr79.js';

export type { PolicyDocKind, PolicyDocMetadata } from './policy/types.js';

export {
  BELA_ACT_2024_DOC_ID,
  BELA_ACT_2024_METADATA,
  BELA_ACT_2024_SECTIONS,
  BELA_ACT_2024_VERSION,
} from './policy/sources/bela-act-32-of-2024.js';

export {
  DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
  DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA,
  DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS,
  DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
} from './policy/sources/dbe-learner-diversity-caps-2011.js';

export {
  DBE_NPFTED_2007_DOC_ID,
  DBE_NPFTED_2007_METADATA,
  DBE_NPFTED_2007_SECTIONS,
  DBE_NPFTED_2007_VERSION,
} from './policy/sources/dbe-npfted-2007.js';

export {
  DBE_PRIVACY_POLICY_2023_DOC_ID,
  DBE_PRIVACY_POLICY_2023_METADATA,
  DBE_PRIVACY_POLICY_2023_SECTIONS,
  DBE_PRIVACY_POLICY_2023_VERSION,
} from './policy/sources/dbe-privacy-policy-2023.js';

export {
  DBE_SIAS_2014_DOC_ID,
  DBE_SIAS_2014_METADATA,
  DBE_SIAS_2014_SECTIONS,
  DBE_SIAS_2014_VERSION,
  SiasSupportLevel,
} from './policy/sources/dbe-sias-2014.js';

export {
  DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
  DOE_FREE_QUALITY_EDUCATION_2003_METADATA,
  DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS,
  DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
} from './policy/sources/doe-free-quality-education-2003.js';

export {
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
} from './policy/sources/doe-public-school-policy-guide.js';

export {
  DOE_WSE_POLICY_2001_DOC_ID,
  DOE_WSE_POLICY_2001_METADATA,
  DOE_WSE_POLICY_2001_SECTIONS,
  DOE_WSE_POLICY_2001_VERSION,
  WSE_EVALUATION_AREAS,
  WsePerformanceRating,
  type WseEvaluationArea,
} from './policy/sources/doe-wse-policy-2001.js';

export {
  EEA_1998_DOC_ID,
  EEA_1998_METADATA,
  EEA_1998_SECTIONS,
  EEA_1998_VERSION,
} from './policy/sources/eea-76-of-1998.js';

export {
  GENFETQA_2001_DOC_ID,
  GENFETQA_2001_METADATA,
  GENFETQA_2001_SECTIONS,
  GENFETQA_2001_VERSION,
} from './policy/sources/genfetqa-58-of-2001.js';

export {
  NEPA_1996_DOC_ID,
  NEPA_1996_METADATA,
  NEPA_1996_SECTIONS,
  NEPA_1996_VERSION,
} from './policy/sources/nepa-27-of-1996.js';

export {
  SACE_ACT_2000_DOC_ID,
  SACE_ACT_2000_METADATA,
  SACE_ACT_2000_SECTIONS,
  SACE_ACT_2000_VERSION,
} from './policy/sources/sace-act-31-of-2000.js';

export {
  SACE_CPTD_CYCLE_YEARS,
  SACE_CPTD_TOTAL_PD_POINTS,
  SACE_PD_POINTS_SCHEDULE_DOC_ID,
  SACE_PD_POINTS_SCHEDULE_METADATA,
  SACE_PD_POINTS_SCHEDULE_SECTIONS,
  SACE_PD_POINTS_SCHEDULE_VERSION,
  SacePdActivityType,
} from './policy/sources/sace-pd-points-schedule.js';

export {
  SASA_1996_DOC_ID,
  SASA_1996_METADATA,
  SASA_1996_SECTIONS,
  SASA_1996_VERSION,
} from './policy/sources/sasa-84-of-1996.js';

export {
  CAPS_ENG_HL_FP_CONTENT_AREAS,
  CAPS_ENG_HL_FP_DOC_ID,
  CAPS_ENG_HL_FP_ISBN,
  CAPS_ENG_HL_FP_METADATA,
  CAPS_ENG_HL_FP_TOPIC_PROGRESSIONS,
  CAPS_ENG_HL_FP_VERSION,
  type CapsenghlfpContentArea,
  type CapsenghlfpTopicProgression,
} from './curriculum/sources/caps-english-hl-fp-gr-r3.js';

export {
  CAPS_FAL_FP_CONTENT_AREAS,
  CAPS_FAL_FP_DOC_ID,
  CAPS_FAL_FP_METADATA,
  CAPS_FAL_FP_TOPIC_PROGRESSIONS,
  CAPS_FAL_FP_VERSION,
  type CapsfalfpContentArea,
  type CapsfalfpTopicProgression,
} from './curriculum/sources/caps-fal-fp-gr-r3.js';

export {
  CAPS_MATHS_FP_CONTENT_AREAS,
  CAPS_MATHS_FP_DOC_ID,
  CAPS_MATHS_FP_ISBN,
  CAPS_MATHS_FP_METADATA,
  CAPS_MATHS_FP_SKILLS,
  CAPS_MATHS_FP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_FP_VERSION,
  CAPS_MATHS_FP_WEIGHTINGS,
  type CapsmathsfpContentArea,
  type CapsmathsfpSkill,
  type CapsmathsfpTopicProgression,
  type CapsmathsfpWeighting,
} from './curriculum/sources/caps-mathematics-fp-gr-r3.js';

export {
  CAPS_ENG_HL_IP_CONTENT_AREAS,
  CAPS_ENG_HL_IP_DOC_ID,
  CAPS_ENG_HL_IP_ISBN,
  CAPS_ENG_HL_IP_METADATA,
  CAPS_ENG_HL_IP_TOPIC_PROGRESSIONS,
  CAPS_ENG_HL_IP_VERSION,
  type CapsenghlipContentArea,
  type CapsenghlipTopicProgression,
} from './curriculum/sources/caps-english-hl-ip-gr46.js';

export {
  CAPS_ENG_FAL_IP_CONTENT_AREAS,
  CAPS_ENG_FAL_IP_DOC_ID,
  CAPS_ENG_FAL_IP_ISBN,
  CAPS_ENG_FAL_IP_METADATA,
  CAPS_ENG_FAL_IP_TOPIC_PROGRESSIONS,
  CAPS_ENG_FAL_IP_VERSION,
  type CapsengfalipContentArea,
  type CapsengfalipTopicProgression,
} from './curriculum/sources/caps-english-fal-ip-gr46.js';

export {
  CAPS_MATHS_IP_CONTENT_AREAS,
  CAPS_MATHS_IP_DOC_ID,
  CAPS_MATHS_IP_ISBN,
  CAPS_MATHS_IP_METADATA,
  CAPS_MATHS_IP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_IP_VERSION,
  CAPS_MATHS_IP_WEIGHTINGS,
  type CapsmathsipContentArea,
  type CapsmathsipTopicProgression,
  type CapsmathsipWeighting,
} from './curriculum/sources/caps-mathematics-ip-gr46.js';

export {
  CAPS_NST_IP_CONTENT_AREAS,
  CAPS_NST_IP_DOC_ID,
  CAPS_NST_IP_METADATA,
  CAPS_NST_IP_TOPIC_PROGRESSIONS,
  CAPS_NST_IP_VERSION,
  type CapsnstipContentArea,
  type CapsnstipTopicProgression,
} from './curriculum/sources/caps-nst-ip-gr46.js';

export {
  CAPS_SS_IP_CONTENT_AREAS,
  CAPS_SS_IP_DOC_ID,
  CAPS_SS_IP_ISBN,
  CAPS_SS_IP_METADATA,
  CAPS_SS_IP_TOPIC_PROGRESSIONS,
  CAPS_SS_IP_VERSION,
  type CapsssipContentArea,
  type CapsssipTopicProgression,
} from './curriculum/sources/caps-social-sciences-ip-gr46.js';

export {
  CAPS_HL_SP_CONTENT_AREAS,
  CAPS_HL_SP_DOC_ID,
  CAPS_HL_SP_METADATA,
  CAPS_HL_SP_TOPIC_PROGRESSIONS,
  CAPS_HL_SP_VERSION,
  type CapshlspContentArea,
  type CapshlspTopicProgression,
} from './curriculum/sources/caps-hl-sp-gr7.js';

export {
  CAPS_FAL_SP_CONTENT_AREAS,
  CAPS_FAL_SP_DOC_ID,
  CAPS_FAL_SP_METADATA,
  CAPS_FAL_SP_TOPIC_PROGRESSIONS,
  CAPS_FAL_SP_VERSION,
  type CapsfalspContentArea,
  type CapsfalspTopicProgression,
} from './curriculum/sources/caps-fal-sp-gr7.js';

export {
  CAPS_MATHS_SP_CONTENT_AREAS,
  CAPS_MATHS_SP_DOC_ID,
  CAPS_MATHS_SP_ISBN,
  CAPS_MATHS_SP_METADATA,
  CAPS_MATHS_SP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_SP_VERSION,
  CAPS_MATHS_SP_WEIGHTINGS,
  type CapsmathsspContentArea,
  type CapsmathsspTopicProgression,
  type CapsmathsspWeighting,
} from './curriculum/sources/caps-mathematics-sp-gr7.js';

export {
  CAPS_NS_SP_CONTENT_AREAS,
  CAPS_NS_SP_DOC_ID,
  CAPS_NS_SP_METADATA,
  CAPS_NS_SP_TOPIC_PROGRESSIONS,
  CAPS_NS_SP_VERSION,
  type CapsnsspContentArea,
  type CapsnsspTopicProgression,
} from './curriculum/sources/caps-natural-sciences-sp-gr7.js';

export {
  CAPS_SS_SP_CONTENT_AREAS,
  CAPS_SS_SP_DOC_ID,
  CAPS_SS_SP_METADATA,
  CAPS_SS_SP_SKILLS,
  CAPS_SS_SP_TOPIC_PROGRESSIONS,
  CAPS_SS_SP_VERSION,
  type CapsssspContentArea,
  type CapsssspSkill,
  type CapsssspTopicProgression,
} from './curriculum/sources/caps-social-sciences-sp-gr7.js';

export {
  CAPS_TECH_SP_CONTENT_AREAS,
  CAPS_TECH_SP_DOC_ID,
  CAPS_TECH_SP_METADATA,
  CAPS_TECH_SP_TOPIC_PROGRESSIONS,
  CAPS_TECH_SP_VERSION,
  type CapstechspContentArea,
  type CapstechspTopicProgression,
} from './curriculum/sources/caps-technology-sp-gr7.js';

export {
  CAPS_EMS_SP_CONTENT_AREAS,
  CAPS_EMS_SP_DOC_ID,
  CAPS_EMS_SP_METADATA,
  CAPS_EMS_SP_TOPIC_PROGRESSIONS,
  CAPS_EMS_SP_VERSION,
  CAPS_EMS_SP_WEIGHTINGS,
  type CapsemsspContentArea,
  type CapsemsspTopicProgression,
  type CapsemsspWeighting,
} from './curriculum/sources/caps-ems-sp-gr7.js';

export {
  CAPS_CA_SP_CONTENT_AREAS,
  CAPS_CA_SP_DOC_ID,
  CAPS_CA_SP_METADATA,
  CAPS_CA_SP_SKILLS,
  CAPS_CA_SP_TOPIC_PROGRESSIONS,
  CAPS_CA_SP_VERSION,
  type CapscaspContentArea,
  type CapscaspSkill,
  type CapscaspTopicProgression,
} from './curriculum/sources/caps-creative-arts-sp-gr7.js';

export type {
  ATPTopicBlock,
  ATPFatRow,
  ATPSourceDocument,
} from './curriculum/atp-source.js';

export { ATP_FOUNDATION_SOURCES } from './curriculum/sources/atp-fp-gr-r3.js';
export { ATP_INTERMEDIATE_SOURCES } from './curriculum/sources/atp-ip-gr-46.js';
export { ATP_PENDING_REGISTRY } from './curriculum/sources/atp-pending-registry.js';
export { ATP_SENIOR_SOURCES } from './curriculum/sources/atp-sp-gr-7.js';
export { LESSON_PLAN_TEMPLATE_BENJAMIN_PINE } from './curriculum/sources/template-lesson-plan-benjamin-pine.js';

export {
  CurriculumPublishInput,
  CurriculumPublishResult,
  CurriculumTombstoneInput,
  CurriculumTombstoneResult,
} from './curriculum/brain-tools.js';

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;
