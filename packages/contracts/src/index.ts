// @infinite-ai/contracts — Zod schemas shared by the API, agents and UI. Two families
// live here: the POPIA vocabularies (purpose taxonomy, consent ledger, retention schedule)
// and the curriculum framework.
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
  ruleFor,
  unscheduledCategories,
  type RetainableRecord,
  type RetentionVerdict,
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

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;
