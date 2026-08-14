// @infinite-ai/pd-journal — PD Journal types.
//
// PdJournalEntry records a single professional-development activity for an educator.
// Points are earned by completing SACE-recognised activities across three types defined
// in the PD Points Schedule; whether those points have been verified by the reporting
// authority (school for Type 2, SACE-endorsed provider for Type 3, future point-table
// lookup for Type 1 when OQ-006 is resolved) is tracked by pointsStatus.
//
// CycleProgress is the computed view of a single educator's standing at a point in time.
// PdCycleSummary is the multi-educator shape produced by buildPdCycleSummary — it is
// structurally compatible with the PdPointsInput schema in @infinite-ai/compliance and
// can be passed directly to runComplianceChecks / checkPdPoints.

import { z } from 'zod';

import { SacePdActivityType } from '@infinite-ai/contracts';

export const PdPointsStatus = z.enum(['VERIFIED', 'PENDING_VERIFICATION', 'REJECTED']);
export type PdPointsStatus = z.infer<typeof PdPointsStatus>;

export const PdJournalEntry = z.object({
  /** Opaque entry identifier — never a real name or SA ID number. */
  entryToken: z.string().min(1),
  /** Opaque educator identifier — never a real name or SA ID number. */
  educatorToken: z.string().min(1),
  activityType: SacePdActivityType,
  /** ISO calendar date YYYY-MM-DD on which the activity took place. */
  activityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'activityDate must be YYYY-MM-DD'),
  description: z.string().min(1),
  /**
   * Points claimed for this activity.
   * - Type 1 (Teacher-Initiated): claimed by the educator; set to PENDING_VERIFICATION
   *   until the Type 1 pre-determined point table (OQ-006) is ingested and applied.
   * - Type 2 (School-Initiated): awarded by the school; VERIFIED when the school has
   *   submitted the record to SACE.
   * - Type 3 (Externally-Initiated): awarded by the SACE-endorsed provider; VERIFIED
   *   when the provider has reported to SACE.
   */
  claimedPoints: z.number().int().min(0),
  pointsStatus: PdPointsStatus,
});
export type PdJournalEntry = z.infer<typeof PdJournalEntry>;

export type SacePdActivityTypeLiteral = z.infer<typeof SacePdActivityType>;

export interface TypeBreakdown {
  verified: number;
  pending: number;
}

export interface CycleProgress {
  educatorToken: string;
  /** Which year of the current 3-year CPTD cycle the educator is in, as at `asOf`. */
  cycleYear: 1 | 2 | 3;
  /** Points with status VERIFIED — the value passed to the compliance engine. */
  verifiedPoints: number;
  /** Points with status PENDING_VERIFICATION — awaiting authority confirmation. */
  pendingPoints: number;
  /** verifiedPoints + pendingPoints (REJECTED entries excluded). */
  totalClaimedPoints: number;
  /** Breakdown of verified and pending points by SACE activity type. */
  breakdownByType: Record<SacePdActivityTypeLiteral, TypeBreakdown>;
}

/**
 * Structurally compatible with PdPointsInput from @infinite-ai/compliance.
 * Pass educators[].pdPointsAccumulated (which equals verifiedPoints) to the
 * compliance engine — only verified points count for regulatory purposes.
 */
export interface PdCycleSummary {
  tenantId: string;
  educators: Array<{
    educatorToken: string;
    pdPointsAccumulated: number;
    cycleYear: 1 | 2 | 3;
  }>;
}
