// @infinite-ai/analytics — MOD-02 Support Analytics Centre.
//
// The tier model and the SIAS state machine are pure, synchronous modules: a score and
// data readings in, a tier or a transition verdict out. No database, no model calls, no
// I/O. That is what makes the question "was this tier recommendation justified by the
// data?" answerable after the fact without archaeology.

export {
  DEFAULT_TIER_BANDS,
  SCREENING_DOMAINS,
  DATA_SUFFICIENCY_REQUIREMENTS,
  assignTier,
  checkAllDomainsSufficiency,
  checkDataSufficiency,
  type DataSufficiency,
  type DataSufficiencyVerdict,
  type ScreeningDomain,
  type SupportTier,
  type TierBand,
} from './tier-model.js';

export {
  LEGAL_TRANSITIONS,
  SiasStatusSchema,
  SiasTransitionError,
  isSiasTerminal,
  legalNextStates,
  transitionSias,
  type LegalTransition,
  type SbstRatification,
  type SiasStatus,
  type SiasTransitionAudit,
} from './sias-state.js';

export {
  ActiveInterventionItem,
  AC01Input,
  AC01Result,
  AC02Input,
  AC02Result,
  AC03Input,
  AC03Result,
  AC04Input,
  AC04Result,
  AC05Input,
  AC05Result,
  AC06Input,
  AC06Result,
  AC07Input,
  AC07Result,
  AC08Input,
  AC08Result,
  AC09Input,
  AC09Result,
  AC10Input,
  AC10Result,
  DataSufficiencyVerdictSchema,
  DeliveredSession,
  DomainReading,
  EarlyWarningReading,
  EarlyWarningSignal,
  InterventionDosage,
  InterventionHistoryEntry,
  LearnerTierSummary,
  MeetingAgendaItem,
  MeetingDecisionRecord,
  MonitoringRecommendation,
  ParentProgressSummary,
  PlannedSession,
  ProgressMeasurement,
  ProgressSummary,
  RiskLevel,
  SA_HOME_LANGUAGE_CODES,
  SaHomeLanguageCodeSchema,
  SbstDecisionType,
  ScreenHistoryEntry,
  ScreeningDomainSchema,
  SiasSection,
  SupportTierSchema,
  TrendDirection,
} from './agent-schemas.js';

export {
  buildCaseFile,
  type CaseFileInput,
  type FidelityEntry,
  type InterventionEntry,
  type LearnerCaseFile,
  type MeetingEntry,
  type ParentReportEntry,
  type ProgressEntry,
  type ReferralEntry,
  type ScreenEntry,
  type TierEntry,
} from './case-file.js';

export {
  MIN_COHORT_SIZE,
  rollupClass,
  rollupGrade,
  rollupSchool,
  type ClassReport,
  type CohortDistribution,
  type GradeReport,
  type LearnerReport,
  type SchoolReport,
  type SuppressedCohort,
  type TierDistribution,
  type VisibleDistribution,
} from './reporting.js';

export {
  BIAS_RATIO_THRESHOLD,
  MIN_POPULATION_FOR_BIAS_CHECK,
  monitorBias,
  type BiasMonitorFinding,
  type BiasMonitorInput,
  type BiasMonitorResult,
  type GroupTierCounts,
} from './bias-monitor.js';

export const PACKAGE_NAME = '@infinite-ai/analytics' as const;
