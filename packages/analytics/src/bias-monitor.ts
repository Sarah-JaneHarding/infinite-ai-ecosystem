// Bias monitor — Stage 10 step 7.
//
// "Bias monitor fires on the skewed fixture." The monitor computes whether any demographic
// group's tier assignment rate deviates from the population baseline by more than a
// defined threshold. It is deliberately conservative: it fires loudly on a skewed fixture
// so a human investigates, rather than silently passing data that could encode systematic
// bias. The caller provides both the group distribution and the population baseline;
// the monitor itself has no opinion on what "baseline" should be — that is the school's
// data, not an invented policy.
//
// The monitored tier is REFERRAL, which carries the highest consequence for a learner.
// A group whose REFERRAL rate exceeds BIAS_RATIO_THRESHOLD × the population REFERRAL
// rate triggers a monitor event.

/** Tier counts for one demographic group (or the whole population as a baseline). */
export interface GroupTierCounts {
  readonly TIER_1: number;
  readonly TIER_2: number;
  readonly TIER_3: number;
  readonly REFERRAL: number;
}

export interface BiasMonitorInput {
  /** The overall population distribution used as the baseline. */
  readonly populationCounts: GroupTierCounts;
  /** Per-group distributions. Key is a group label (e.g., a home-language code or a
   *  grade level). Values must not include any direct identifier. */
  readonly groupCounts: Record<string, GroupTierCounts>;
}

export interface BiasMonitorFinding {
  readonly group: string;
  readonly groupReferralRate: number;
  readonly populationReferralRate: number;
  /** groupReferralRate / populationReferralRate, or null when baseline rate is zero. */
  readonly ratio: number | null;
}

export interface BiasMonitorResult {
  /** True when any group exceeds the bias threshold. */
  readonly fired: boolean;
  readonly findings: readonly BiasMonitorFinding[];
}

/** A group REFERRAL rate that exceeds this multiple of the population rate triggers the
 *  monitor. 2.0 means "twice the population rate". */
export const BIAS_RATIO_THRESHOLD = 2.0;

/** Minimum population count below which the monitor does not fire for that group (too few
 *  observations to draw a reliable conclusion). */
export const MIN_POPULATION_FOR_BIAS_CHECK = 10;

function referralRate(counts: GroupTierCounts): number {
  const total = counts.TIER_1 + counts.TIER_2 + counts.TIER_3 + counts.REFERRAL;
  if (total === 0) return 0;
  return counts.REFERRAL / total;
}

function totalCount(counts: GroupTierCounts): number {
  return counts.TIER_1 + counts.TIER_2 + counts.TIER_3 + counts.REFERRAL;
}

/**
 * Scans each group's REFERRAL rate against the population baseline. Returns `fired: true`
 * when any group with at least `MIN_POPULATION_FOR_BIAS_CHECK` learners has a REFERRAL
 * rate above `BIAS_RATIO_THRESHOLD × populationReferralRate`.
 */
export function monitorBias(input: BiasMonitorInput): BiasMonitorResult {
  const populationReferralRate = referralRate(input.populationCounts);
  const findings: BiasMonitorFinding[] = [];
  let fired = false;

  for (const [group, counts] of Object.entries(input.groupCounts)) {
    if (totalCount(counts) < MIN_POPULATION_FOR_BIAS_CHECK) continue;

    const groupReferralRate = referralRate(counts);
    const ratio =
      populationReferralRate > 0 ? groupReferralRate / populationReferralRate : null;

    const exceeds =
      ratio !== null &&
      ratio > BIAS_RATIO_THRESHOLD &&
      groupReferralRate > populationReferralRate;

    if (exceeds) {
      fired = true;
      findings.push({ group, groupReferralRate, populationReferralRate, ratio });
    }
  }

  return { fired, findings };
}
