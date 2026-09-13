import { z } from 'zod';

import type { SourceRef } from '@infinite-ai/contracts';

/** Broad area of policy compliance being checked. */
export type ComplianceArea =
  'ATTENDANCE' | 'SCHOOL_FEES' | 'CONDUCT' | 'SIAS_PROCESS' | 'PD_POINTS' | 'WSE_RATINGS';

/** Severity of a compliance finding.
 *
 * VIOLATION — a direct breach of a statutory obligation.
 * WARNING    — a condition that should be investigated but is not a clear breach.
 * INFO       — an advisory note (e.g. a process is in place but incomplete).
 */
export type ComplianceSeverity = 'VIOLATION' | 'WARNING' | 'INFO';

/** A single compliance finding with a policy-clause citation. */
export interface ComplianceFinding {
  readonly area: ComplianceArea;
  readonly severity: ComplianceSeverity;
  /** Machine-readable code for this finding type. */
  readonly code: string;
  /** Human-readable description of the finding. */
  readonly description: string;
  /** Source document and clause that establishes the obligation. */
  readonly basis: SourceRef;
  /** Optional context — record identifier, educator name token, or area name. */
  readonly context?: string;
}

/** Aggregate compliance report for one school at one point in time. */
export interface ComplianceReport {
  readonly tenantId: string;
  readonly generatedAt: string;
  /** All findings across all areas. Empty means fully compliant. */
  readonly findings: readonly ComplianceFinding[];
  /** Convenience count by severity. */
  readonly summary: {
    readonly violations: number;
    readonly warnings: number;
    readonly infos: number;
  };
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const AttendanceInput = z.object({
  tenantId: z.string().min(1),
  /** Academic year (e.g. 2025). BELA Grade R compulsory attendance applies from 2025. */
  academicYear: z.number().int().min(2020).max(2100),
  learners: z.array(
    z.object({
      learnerId: z.string().min(1),
      grade: z.string().min(1),
      /** Attendance rate 0-100, expressed as a percentage. */
      attendanceRatePct: z.number().min(0).max(100),
    }),
  ),
});
export type AttendanceInput = z.infer<typeof AttendanceInput>;

export const FeesInput = z.object({
  tenantId: z.string().min(1),
  /** National quintile 1-5 (1 = poorest). */
  quintile: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  schoolFeeCharged: z.boolean(),
  feeExemptionProcedureInPlace: z.boolean(),
});
export type FeesInput = z.infer<typeof FeesInput>;

export const ConductInput = z.object({
  tenantId: z.string().min(1),
  /** True if any record in the system records corporal punishment as permitted. */
  corporalPunishmentRecordedAsPermitted: z.boolean(),
  disciplinaryRecords: z.array(
    z.object({
      /** Opaque token — no real educator name or SA ID. */
      educatorToken: z.string().min(1),
      /** Has a formal charge sheet been drawn up (EEA §17 requirement)? */
      hasChargeSheet: z.boolean(),
      /** Has the educator been given opportunity to respond? */
      hasResponseOpportunity: z.boolean(),
    }),
  ),
});
export type ConductInput = z.infer<typeof ConductInput>;

export const SiasInput = z.object({
  tenantId: z.string().min(1),
  referrals: z.array(
    z.object({
      referralId: z.string().min(1),
      /** Current SIAS stage completed (1-6; 6 = placement decision). */
      stageCompleted: z.number().int().min(0).max(6),
      /** Has documentation been filed for each completed stage? */
      documentationComplete: z.boolean(),
      /** Is this referral currently active (not yet resolved)? */
      active: z.boolean(),
    }),
  ),
});
export type SiasInput = z.infer<typeof SiasInput>;

export const PdPointsInput = z.object({
  tenantId: z.string().min(1),
  educators: z.array(
    z.object({
      /** Opaque token — no real educator name or SA ID. */
      educatorToken: z.string().min(1),
      /** Total PD points accumulated in the current 3-year CPTD cycle. */
      pdPointsAccumulated: z.number().int().min(0),
      /** Year within the current cycle (1, 2, or 3). */
      cycleYear: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    }),
  ),
});
export type PdPointsInput = z.infer<typeof PdPointsInput>;

export const WseInput = z.object({
  tenantId: z.string().min(1),
  evaluationRecords: z.array(
    z.object({
      /** WSE evaluation area name (must match WSE_EVALUATION_AREAS). */
      area: z.string().min(1),
      /** Performance rating 1-4 (1 = not achieved, 4 = outstanding). */
      rating: z.number().int(),
    }),
  ),
});
export type WseInput = z.infer<typeof WseInput>;

export const ComplianceInput = z.object({
  tenantId: z.string().min(1),
  attendance: AttendanceInput.optional(),
  fees: FeesInput.optional(),
  conduct: ConductInput.optional(),
  sias: SiasInput.optional(),
  pdPoints: PdPointsInput.optional(),
  wse: WseInput.optional(),
});
export type ComplianceInput = z.infer<typeof ComplianceInput>;
