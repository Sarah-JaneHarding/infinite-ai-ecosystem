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
  DataSufficiencyVerdictSchema,
  DeliveredSession,
  DomainReading,
  EarlyWarningReading,
  EarlyWarningSignal,
  InterventionDosage,
  LearnerTierSummary,
  MonitoringRecommendation,
  PlannedSession,
  ProgressMeasurement,
  RiskLevel,
  ScreeningDomainSchema,
  SupportTierSchema,
  TrendDirection,
} from './agent-schemas.js';

export const PACKAGE_NAME = '@infinite-ai/analytics' as const;
