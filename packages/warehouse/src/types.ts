// Stage 09 step 1 — warehouse domain types, mirroring the Prisma models in packages/db.
//
// These Zod schemas validate data at the warehouse package boundary: connector output
// before it hits the landing zone, conformed events before they enter domain_event_log,
// and Learner-360 profiles before they are persisted. The Prisma client types are the
// authoritative DB shape; these are the application-layer contracts above it.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror the Prisma enums)
// ---------------------------------------------------------------------------

export const ConnectorKindSchema = z.enum([
  'FILE_CSV',
  'FILE_XLSX',
  'SIS_API',
  'SCREENER_API',
  'ATTENDANCE_API',
  'BEHAVIOUR_API',
  'MANUAL_UPLOAD',
]);
export type ConnectorKind = z.infer<typeof ConnectorKindSchema>;

export const IngestSourceStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'ERROR']);
export type IngestSourceStatus = z.infer<typeof IngestSourceStatusSchema>;

export const IngestRunStatusSchema = z.enum([
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIALLY_SUCCEEDED',
  'QUARANTINED',
]);
export type IngestRunStatus = z.infer<typeof IngestRunStatusSchema>;

export const DataDomainSchema = z.enum([
  'ATTENDANCE',
  'ASSESSMENT',
  'BEHAVIOUR',
  'WELLBEING',
  'DEMOGRAPHIC',
  'SCREENER',
]);
export type DataDomain = z.infer<typeof DataDomainSchema>;

// ---------------------------------------------------------------------------
// Raw record (landing zone output from a connector)
// ---------------------------------------------------------------------------

export const RawRecord = z.object({
  sourceRef: z.string().min(1),
  payload: z.record(z.unknown()),
  schemaVersion: z.string().optional(),
});
export type RawRecord = z.infer<typeof RawRecord>;

// ---------------------------------------------------------------------------
// Conformed event (output of DW-02 schema mapping)
// ---------------------------------------------------------------------------

export const ConformedEvent = z.object({
  learnerId: z.string().uuid(),
  domain: DataDomainSchema,
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
  rawRecordId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
});
export type ConformedEvent = z.infer<typeof ConformedEvent>;

// ---------------------------------------------------------------------------
// Quality issue (DW-05 Data Quality Sentinel)
// ---------------------------------------------------------------------------

export const QualityIssueKind = z.enum([
  'MISSING_FIELD',
  'OUT_OF_RANGE',
  'DUPLICATE_RECORD',
  'REFERENTIAL_INTEGRITY',
  'IMPOSSIBLE_VALUE',
  'DISTRIBUTION_DRIFT',
]);
export type QualityIssueKind = z.infer<typeof QualityIssueKind>;

export const QualityIssue = z.object({
  kind: QualityIssueKind,
  field: z.string().optional(),
  sourceRef: z.string().optional(),
  detail: z.string().min(1),
  severity: z.enum(['WARNING', 'ERROR']),
});
export type QualityIssue = z.infer<typeof QualityIssue>;

export const QualityReport = z.object({
  qualityScore: z.number().min(0).max(100),
  issues: z.array(QualityIssue),
  blockedDownstream: z.boolean(),
  totalRecords: z.number().int().nonnegative(),
  rejectedRecords: z.number().int().nonnegative(),
});
export type QualityReport = z.infer<typeof QualityReport>;

// ---------------------------------------------------------------------------
// Learner-360 profile (DW-06 output)
// ---------------------------------------------------------------------------

export const AttendanceSummary = z.object({
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  presentDays: z.number().int().nonnegative(),
  absentDays: z.number().int().nonnegative(),
  lateDays: z.number().int().nonnegative(),
  attendanceRatePct: z.number().min(0).max(100),
});
export type AttendanceSummary = z.infer<typeof AttendanceSummary>;

export const AcademicSummary = z.object({
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  subjectAverages: z.record(z.number().min(0).max(100)),
  overallAverage: z.number().min(0).max(100),
});
export type AcademicSummary = z.infer<typeof AcademicSummary>;

export const BehaviourSummary = z.object({
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  incidentCount: z.number().int().nonnegative(),
  mostRecentKind: z.string().optional(),
});
export type BehaviourSummary = z.infer<typeof BehaviourSummary>;

export const WellbeingSummary = z.object({
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  screenerScores: z.record(z.number()),
  flagged: z.boolean(),
});
export type WellbeingSummary = z.infer<typeof WellbeingSummary>;

export const Learner360Profile = z.object({
  learnerId: z.string().uuid(),
  tenantId: z.string().uuid(),
  attendanceSummary: AttendanceSummary.nullable(),
  academicSummary: AcademicSummary.nullable(),
  behaviourSummary: BehaviourSummary.nullable(),
  wellbeingSummary: WellbeingSummary.nullable(),
  screenerResults: z.record(z.unknown()).nullable(),
  dataQualityNote: z.string().nullable(),
  lastMaterialisedAt: z.string().datetime(),
});
export type Learner360Profile = z.infer<typeof Learner360Profile>;

// ---------------------------------------------------------------------------
// Screening feature (feature store entry)
// ---------------------------------------------------------------------------

export const ScreeningFeatureRecord = z.object({
  learnerId: z.string().uuid(),
  featureName: z.string().min(1),
  featureValue: z.number(),
  asAt: z.string().datetime(),
  sourceRunId: z.string().uuid().optional(),
  supersedes: z.string().uuid().optional(),
});
export type ScreeningFeatureRecord = z.infer<typeof ScreeningFeatureRecord>;

// ---------------------------------------------------------------------------
// DW-01 Ingestion Agent result
// ---------------------------------------------------------------------------

export const DW01Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    runId: z.string().uuid(),
    recordsReceived: z.number().int().nonnegative(),
    recordsConformed: z.number().int().nonnegative(),
    recordsRejected: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type DW01Result = z.infer<typeof DW01Result>;

// ---------------------------------------------------------------------------
// DW-06 Learner-360 result
// ---------------------------------------------------------------------------

export const DW06Result = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), profile: Learner360Profile }),
  z.object({
    status: z.literal('needs_input'),
    learnerId: z.string().uuid(),
    detail: z.string().min(1),
  }),
]);
export type DW06Result = z.infer<typeof DW06Result>;

// ---------------------------------------------------------------------------
// DW-07 Insight Synthesiser result
// ---------------------------------------------------------------------------

export const InsightScope = z.enum(['LEARNER', 'CLASS', 'GRADE', 'SCHOOL']);
export type InsightScope = z.infer<typeof InsightScope>;

export const Insight = z.object({
  scope: InsightScope,
  scopeId: z.string().uuid(),
  domain: DataDomainSchema,
  narrative: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  dataPointCount: z.number().int().positive(),
  sourceEventIds: z.array(z.string().uuid()).min(1),
  generatedAt: z.string().datetime(),
});
export type Insight = z.infer<typeof Insight>;

export const DW07Result = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), insights: z.array(Insight).min(1) }),
  z.object({
    status: z.literal('needs_input'),
    scope: InsightScope,
    scopeId: z.string().uuid(),
    detail: z.string().min(1),
  }),
]);
export type DW07Result = z.infer<typeof DW07Result>;

// ---------------------------------------------------------------------------
// DW-08 Next-Step Recommender result
// ---------------------------------------------------------------------------

export const NextStep = z.object({
  description: z.string().min(1),
  owner: z.string().min(1),
  dueDate: z.string().datetime(),
  insightId: z.string().uuid(),
  rationale: z.string().min(1),
});
export type NextStep = z.infer<typeof NextStep>;

export const DW08Result = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), nextStep: NextStep }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type DW08Result = z.infer<typeof DW08Result>;
