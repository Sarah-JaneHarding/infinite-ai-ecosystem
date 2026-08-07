// @infinite-ai/warehouse — Stage 09 MOD-03 Data Collection & Warehouse.
//
// Exports the warehouse domain types, Zod schemas, and the connector interface.
// Implementations (quality sentinel, Learner-360 materialiser, insight synthesiser)
// are added in subsequent Stage 09 steps.

export {
  AttendanceSummary,
  AcademicSummary,
  BehaviourSummary,
  ConnectorKindSchema,
  ConformedEvent,
  DataDomainSchema,
  DW01Result,
  DW06Result,
  DW07Result,
  DW08Result,
  IngestRunStatusSchema,
  IngestSourceStatusSchema,
  Insight,
  InsightScope,
  Learner360Profile,
  NextStep,
  QualityIssue,
  QualityIssueKind,
  QualityReport,
  RawRecord,
  ScreeningFeatureRecord,
  WellbeingSummary,
  type ConnectorKind,
  type DataDomain,
  type IngestRunStatus,
  type IngestSourceStatus,
} from './types.js';

export {
  FileConnector,
  SisApiConnector,
  getConnector,
  type ConnectorConfig,
  type ConnectorFactory,
  type IngestConnector,
  type PullResult,
} from './ingest/connector.js';
