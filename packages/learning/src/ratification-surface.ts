// Ratification Surface — Stage 13 step 6.
//
// Pure assembly of the data a ratifier (HoD, SMT, curriculum board) needs to review
// before approving a challenger promotion. Only a 'promote' verdict from LE-07 produces
// a package — all rejected verdicts return not_eligible.
//
// The ratification package is display data only; it does not store anything. The
// PromotionLog (promotion-log.ts) records the post-ratification entry after human approval.

import type { GatekeeperVerdict } from '@infinite-ai/contracts';

export interface RatificationPackageInput {
  readonly tenantId: string;
  readonly agentId: string;
  readonly challengerId: string;
  readonly challengerVersion: string;
  readonly previousChampionVersion: string;
  /** Eval delta summary from LE-07 gateChallenger result. */
  readonly evalDeltaSummary: string;
  /** Verdict from the gatekeeper — only 'promote' produces a package. */
  readonly gatekeeperVerdict: GatekeeperVerdict;
  /** Optional human-readable evidence summary (pattern context, outcome deltas, etc.). */
  readonly evidenceSummary?: string;
  /** ISO-8601 datetime injected for deterministic testing. */
  readonly now: string;
}

export type RatificationSurfaceDecision =
  | {
      readonly status: 'ok';
      readonly tenantId: string;
      readonly agentId: string;
      readonly challengerId: string;
      readonly challengerVersion: string;
      readonly previousChampionVersion: string;
      readonly evalDeltaSummary: string;
      readonly evidenceSummary: string;
      /** Preview of the rollback command a ratifier can run if promotion is later reverted. */
      readonly rollbackPreview: string;
      readonly proposedAt: string;
    }
  | {
      readonly status: 'not_eligible';
      readonly gatekeeperVerdict: GatekeeperVerdict;
      readonly detail: string;
    }
  | {
      readonly status: 'needs_input';
      readonly missingFields: readonly string[];
    };

const FALLBACK_EVIDENCE = 'No additional evidence summary provided.';

/**
 * Assembles the ratification package for display to a HoD, SMT member, or curriculum board.
 *
 * Returns `needs_input` when required identifying fields are absent.
 * Returns `not_eligible` when the gatekeeper verdict is not 'promote'.
 * Returns `ok` with the full display package (candidate metadata, eval delta, evidence,
 * and a rollback command preview) only when the challenger has cleared LE-07.
 */
export function composeRatificationPackage(
  input: RatificationPackageInput,
): RatificationSurfaceDecision {
  const missingFields: string[] = [];
  if (!input.challengerVersion) missingFields.push('challengerVersion');
  if (!input.previousChampionVersion) missingFields.push('previousChampionVersion');
  if (!input.evalDeltaSummary) missingFields.push('evalDeltaSummary');

  if (missingFields.length > 0) {
    return { status: 'needs_input', missingFields };
  }

  if (input.gatekeeperVerdict !== 'promote') {
    return {
      status: 'not_eligible',
      gatekeeperVerdict: input.gatekeeperVerdict,
      detail: `Challenger did not pass LE-07 gate: verdict was '${input.gatekeeperVerdict}'. Only a 'promote' verdict proceeds to ratification.`,
    };
  }

  const rollbackPreview =
    `le:rollback --agent ${input.agentId} ` +
    `--to-version ${input.previousChampionVersion} ` +
    `--challenger ${input.challengerId}`;

  return {
    status: 'ok',
    tenantId: input.tenantId,
    agentId: input.agentId,
    challengerId: input.challengerId,
    challengerVersion: input.challengerVersion,
    previousChampionVersion: input.previousChampionVersion,
    evalDeltaSummary: input.evalDeltaSummary,
    evidenceSummary: input.evidenceSummary ?? FALLBACK_EVIDENCE,
    rollbackPreview,
    proposedAt: input.now,
  };
}
