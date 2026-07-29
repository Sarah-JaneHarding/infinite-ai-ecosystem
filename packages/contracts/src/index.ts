// @infinite-ai/contracts — Zod schemas shared by the API, agents and UI. The POPIA
// vocabularies live here: purpose taxonomy, consent ledger shape, retention schedule.
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

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;
