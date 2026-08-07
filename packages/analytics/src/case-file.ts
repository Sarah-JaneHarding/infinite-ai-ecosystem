// SBST case file surface — Stage 10 step 5.
//
// "One place where everyone who works with a learner sees the same history." The case file
// is a pure, read-only aggregator: it takes the successful outputs of each MOD-02 agent
// (already stored in the Brain by the orchestrator) and assembles them into a single typed
// view. No model calls, no database access, no I/O — the caller fetches the raw records
// and passes them in.
//
// Purpose limitation is enforced by the caller, not here. The orchestrator's access layer
// (`packages/policy/src/access.ts`) has already verified that the requesting role may see
// the data categories this call will assemble; this module trusts those gates as the
// authoritative check (layered defence: RLS then purpose then this aggregator).

import type { SiasStatus } from './sias-state.js';

// ---------------------------------------------------------------------------
// Entry types — one per agent whose output contributes to the case file
// ---------------------------------------------------------------------------

export interface ScreenEntry {
  readonly screenId: string;
  readonly termId: string;
  readonly compositePercentile: number;
  readonly tier: string;
  readonly overallSufficiency: 'sufficient' | 'insufficient';
}

export interface TierEntry {
  readonly recommendationId: string;
  readonly termId: string;
  readonly recommendedTier: string;
  readonly confidence: number;
  readonly evidenceIds: readonly string[];
}

export interface InterventionEntry {
  readonly planId: string;
  readonly termId: string;
  readonly goal: string;
  readonly tier: string;
  readonly strategy: string;
  readonly ownerRole: string;
  readonly sbstRatificationId: string;
  readonly evidenceIds: readonly string[];
}

export interface ProgressEntry {
  readonly monitorId: string;
  readonly termId: string;
  readonly trendDirection: 'improving' | 'stable' | 'declining';
  readonly recommendation: 'continue' | 'intensify' | 'exit';
  readonly currentPercentile: number;
  readonly goalPercentile: number;
}

export interface FidelityEntry {
  readonly fidelityId: string;
  readonly termId: string;
  readonly fidelityRate: number;
  readonly adequate: boolean;
}

export interface MeetingEntry {
  readonly minutesId: string;
  readonly termId: string;
  readonly scheduledOn: string;
  readonly decisions: ReadonlyArray<{
    readonly learnerId: string;
    readonly decision: string;
    readonly sbstRatificationId: string | null;
  }>;
}

export interface ReferralEntry {
  readonly compilationId: string;
  readonly termId: string;
  readonly sbstRatificationId: string;
  readonly sectionCount: number;
}

export interface ParentReportEntry {
  readonly reportId: string;
  readonly termId: string;
  readonly homeLanguage: string;
  readonly readabilityAdequate: boolean;
}

// ---------------------------------------------------------------------------
// Case file
// ---------------------------------------------------------------------------

export interface LearnerCaseFile {
  readonly learnerId: string;
  readonly tenantId: string;
  readonly siasStatus: SiasStatus;
  /** True when AC-01 returned status:'safeguarding' for this learner. No further
   *  processing is done once escalated; all other fields below are empty. */
  readonly safeguardingEscalated: boolean;
  readonly screenHistory: readonly ScreenEntry[];
  /** Most recent tier recommendation, or null if AC-03 has not yet run. */
  readonly latestTierRecommendation: TierEntry | null;
  /** Active intervention plan, or null if none is current. */
  readonly interventionPlan: InterventionEntry | null;
  readonly progressRecords: readonly ProgressEntry[];
  readonly fidelityRecords: readonly FidelityEntry[];
  /** SBST meeting minutes that include a decision for this learner. */
  readonly meetingMinutes: readonly MeetingEntry[];
  /** Compiled SIAS referral pack, or null if the learner has not reached REFERRAL_PENDING. */
  readonly referralPack: ReferralEntry | null;
  readonly parentReports: readonly ParentReportEntry[];
}

// ---------------------------------------------------------------------------
// Input shape — one field per contributing agent
// ---------------------------------------------------------------------------

export interface CaseFileInput {
  readonly tenantId: string;
  readonly learnerId: string;
  readonly siasStatus: SiasStatus;
  readonly safeguardingEscalated: boolean;
  readonly screenHistory: readonly ScreenEntry[];
  readonly latestTierRecommendation: TierEntry | null;
  readonly interventionPlan: InterventionEntry | null;
  readonly progressRecords: readonly ProgressEntry[];
  readonly fidelityRecords: readonly FidelityEntry[];
  readonly meetingMinutes: readonly MeetingEntry[];
  readonly referralPack: ReferralEntry | null;
  readonly parentReports: readonly ParentReportEntry[];
}

/**
 * Assembles the SBST case file from individual agent outputs. When
 * `safeguardingEscalated` is true, all history fields are cleared — a safeguarding event
 * suspends normal processing and the case file must not summarise prior support history
 * until the escalation is resolved.
 */
export function buildCaseFile(input: CaseFileInput): LearnerCaseFile {
  if (input.safeguardingEscalated) {
    return {
      learnerId: input.learnerId,
      tenantId: input.tenantId,
      siasStatus: input.siasStatus,
      safeguardingEscalated: true,
      screenHistory: [],
      latestTierRecommendation: null,
      interventionPlan: null,
      progressRecords: [],
      fidelityRecords: [],
      meetingMinutes: [],
      referralPack: null,
      parentReports: [],
    };
  }

  return {
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    siasStatus: input.siasStatus,
    safeguardingEscalated: false,
    screenHistory: input.screenHistory,
    latestTierRecommendation: input.latestTierRecommendation,
    interventionPlan: input.interventionPlan,
    progressRecords: input.progressRecords,
    fidelityRecords: input.fidelityRecords,
    meetingMinutes: input.meetingMinutes,
    referralPack: input.referralPack,
    parentReports: input.parentReports,
  };
}
