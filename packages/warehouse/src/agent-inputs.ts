// Stage 09 step 2 — input schemas for the eight DW agents.
//
// These complement the DWxxResult discriminated unions already in types.ts. Together they
// define the full contract boundary for each agent: what it accepts and what it returns.

import { z } from 'zod';

import { DataDomainSchema, InsightScope } from './types.js';

// ---------------------------------------------------------------------------
// DW-01 Ingestion Agent
// ---------------------------------------------------------------------------

export const DW01Input = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid(),
  configRef: z.string().min(1),
  cursor: z.string().optional(),
});
export type DW01Input = z.infer<typeof DW01Input>;

// ---------------------------------------------------------------------------
// DW-02 Schema Mapper
// ---------------------------------------------------------------------------

export const DW02Input = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().uuid(),
  rawRecordId: z.string().uuid(),
  sourceId: z.string().uuid(),
  connectorKind: z.string().min(1),
  sourceFields: z.record(z.unknown()),
  targetDomain: DataDomainSchema,
});
export type DW02Input = z.infer<typeof DW02Input>;

export const DW02Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    learnerId: z.string().uuid(),
    eventType: z.string().min(1),
    occurredAt: z.string().datetime(),
    canonicalPayload: z.record(z.unknown()),
    mappingsApplied: z.array(
      z.object({ sourceField: z.string(), canonicalField: z.string() }),
    ),
  }),
  z.object({
    status: z.literal('needs_input'),
    unmappedFields: z.array(z.string()).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('rejected'),
    reason: z.string().min(1),
  }),
]);
export type DW02Result = z.infer<typeof DW02Result>;

// ---------------------------------------------------------------------------
// DW-03 Consent Ledger Agent
// ---------------------------------------------------------------------------

export const DW03Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  domain: DataDomainSchema,
  purpose: z.string().min(1),
  fields: z.array(z.string()).min(1),
});
export type DW03Input = z.infer<typeof DW03Input>;

export const DW03Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    consentBasis: z.string().min(1),
    permittedFields: z.array(z.string()),
  }),
  z.object({
    status: z.literal('blocked'),
    blockedFields: z.array(z.string()).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type DW03Result = z.infer<typeof DW03Result>;

// ---------------------------------------------------------------------------
// DW-04 De-identification Agent
// ---------------------------------------------------------------------------

export const DW04Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  payload: z.record(z.unknown()),
  domain: DataDomainSchema,
});
export type DW04Input = z.infer<typeof DW04Input>;

export const DW04Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    deidentifiedPayload: z.record(z.unknown()),
    learnerToken: z.string().min(1),
    deidentified: z.literal(true),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type DW04Result = z.infer<typeof DW04Result>;

// ---------------------------------------------------------------------------
// DW-05 Data Quality Sentinel
// ---------------------------------------------------------------------------

export const DW05Input = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().uuid(),
  domain: DataDomainSchema,
  sampleRecords: z.array(z.record(z.unknown())).min(1),
});
export type DW05Input = z.infer<typeof DW05Input>;

export const DW05Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    qualityScore: z.number().min(0).max(100),
    blockedDownstream: z.boolean(),
    totalRecords: z.number().int().nonnegative(),
    rejectedRecords: z.number().int().nonnegative(),
    issues: z.array(
      z.object({
        kind: z.string().min(1),
        field: z.string().optional(),
        detail: z.string().min(1),
        severity: z.enum(['WARNING', 'ERROR']),
      }),
    ),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type DW05Result = z.infer<typeof DW05Result>;

// ---------------------------------------------------------------------------
// DW-06 Learner-360 Builder
// ---------------------------------------------------------------------------

export const DW06Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
});
export type DW06Input = z.infer<typeof DW06Input>;

// DW06Result is already defined in types.ts

// ---------------------------------------------------------------------------
// DW-07 Insight Synthesiser
// ---------------------------------------------------------------------------

export const DW07Input = z.object({
  tenantId: z.string().uuid(),
  scope: InsightScope,
  scopeId: z.string().uuid(),
  domain: DataDomainSchema,
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
});
export type DW07Input = z.infer<typeof DW07Input>;

// DW07Result is already defined in types.ts

// ---------------------------------------------------------------------------
// DW-08 Next-Step Recommender
// ---------------------------------------------------------------------------

export const DW08Input = z.object({
  tenantId: z.string().uuid(),
  insightId: z.string().uuid(),
  scope: InsightScope,
  scopeId: z.string().uuid(),
  domain: DataDomainSchema,
});
export type DW08Input = z.infer<typeof DW08Input>;

// DW08Result is already defined in types.ts
