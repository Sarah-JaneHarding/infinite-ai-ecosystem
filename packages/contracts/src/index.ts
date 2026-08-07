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

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;
