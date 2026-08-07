// The SIAS state machine — Stage 10 step 1.
//
// South Africa's SIAS (Screening, Identification, Assessment and Support) process is
// defined in the Education White Paper 3 and the 2014 Policy on Screening, Identification,
// Assessment and Support. This state machine enforces the mandatory sequence: no step may
// be skipped to reach a referral faster.
//
// The pipeline from the build manual:
//   screen → core-health check → tier recommendation → ◆ SBST review
//   → intervention plan → deliver → monitor → decide → ◆ referral sign-off → report
//
// Three invariants, enforced here in code:
//   1. No tier change, referral or exit commits without a stored SBST ratification.
//   2. Core-health check gates individual tiering: if < 80% of a class is in Tier 1,
//      individual tier recommendations are blocked until core health improves.
//   3. Safeguarding disclosures bypass all queues, escalate immediately, and are never
//      summarised into a report — `SAFEGUARDING_ESCALATED` is a terminal state.

/** Every state a learner's SIAS case may occupy. */
export type SiasStatus =
  /** No universal screen has been run yet for this learner this term. */
  | 'PENDING_SCREEN'
  /** Universal screen complete; core health passed for the class; tier recommended. */
  | 'SCREENED'
  /**
   * Core health failed for the learner's class (< 80% in Tier 1).
   * Individual tier recommendations are suppressed; a Tier 1 improvement task is raised
   * for the class. Cannot advance to TIER_RECOMMENDED until core health is resolved.
   */
  | 'CORE_HEALTH_BLOCKED'
  /**
   * SBST (School-Based Support Team) is reviewing the tier recommendation or a
   * monitoring decision. A stored SBST ratification is required to exit this state.
   * This is the HUMAN GATE before any tier change, exit, or referral.
   */
  | 'SBST_REVIEW'
  /**
   * An intervention plan has been approved by the SBST and is being delivered.
   * The learner is at Tier 2 or Tier 3.
   */
  | 'INTERVENTION_ACTIVE'
  /** Intervention delivered; learner is in the progress-monitoring phase. */
  | 'MONITORING'
  /**
   * SBST has recommended a formal SIAS referral. A stored sign-off is required before
   * the referral document is compiled and submitted.
   */
  | 'REFERRAL_PENDING'
  /** Formally referred externally. Terminal; the SIAS case closes here. */
  | 'REFERRED'
  /**
   * SBST has decided no further tiered support is needed; learner returns to Tier 1.
   * Terminal for this SIAS cycle; a new screen may open a fresh case next term.
   */
  | 'EXITED'
  /**
   * A safeguarding disclosure was detected. Immediate human escalation; all queues
   * bypassed. Never summarised into a report. Terminal.
   */
  | 'SAFEGUARDING_ESCALATED';

/** Terminal states — no further transitions are permitted. */
const TERMINAL_STATES = new Set<SiasStatus>([
  'REFERRED',
  'EXITED',
  'SAFEGUARDING_ESCALATED',
]);

/** Transitions that require a stored SBST ratification before they may proceed. */
const REQUIRES_RATIFICATION = new Set<string>();

function ratifiedKey(from: SiasStatus, to: SiasStatus): string {
  return `${from}→${to}`;
}

/**
 * The complete set of legal transitions.
 *
 * Every pair is listed explicitly — there is no inference from state names or ordinals.
 * A transition not in this table is illegal regardless of what a caller claims.
 */
export interface LegalTransition {
  readonly from: SiasStatus;
  readonly to: SiasStatus;
  /** True when a stored SBST ratification must accompany the transition. */
  readonly requiresRatification: boolean;
}

export const LEGAL_TRANSITIONS: ReadonlyArray<LegalTransition> = [
  // Screen phase.
  { from: 'PENDING_SCREEN', to: 'SCREENED', requiresRatification: false },
  { from: 'PENDING_SCREEN', to: 'CORE_HEALTH_BLOCKED', requiresRatification: false },
  // Core health recovery.
  { from: 'CORE_HEALTH_BLOCKED', to: 'SCREENED', requiresRatification: false },
  // Tier recommendation to SBST.
  { from: 'SCREENED', to: 'SBST_REVIEW', requiresRatification: false },
  // SBST decisions (all require stored ratification).
  { from: 'SBST_REVIEW', to: 'INTERVENTION_ACTIVE', requiresRatification: true },
  { from: 'SBST_REVIEW', to: 'EXITED', requiresRatification: true },
  { from: 'SBST_REVIEW', to: 'REFERRAL_PENDING', requiresRatification: true },
  // Intervention delivery and monitoring.
  { from: 'INTERVENTION_ACTIVE', to: 'MONITORING', requiresRatification: false },
  // Monitoring decisions — periodic SBST review.
  { from: 'MONITORING', to: 'SBST_REVIEW', requiresRatification: false },
  // Referral sign-off (requires stored ratification).
  { from: 'REFERRAL_PENDING', to: 'REFERRED', requiresRatification: true },
  // Safeguarding escalation — from any non-terminal state; no ratification needed.
  { from: 'PENDING_SCREEN', to: 'SAFEGUARDING_ESCALATED', requiresRatification: false },
  { from: 'SCREENED', to: 'SAFEGUARDING_ESCALATED', requiresRatification: false },
  {
    from: 'CORE_HEALTH_BLOCKED',
    to: 'SAFEGUARDING_ESCALATED',
    requiresRatification: false,
  },
  { from: 'SBST_REVIEW', to: 'SAFEGUARDING_ESCALATED', requiresRatification: false },
  {
    from: 'INTERVENTION_ACTIVE',
    to: 'SAFEGUARDING_ESCALATED',
    requiresRatification: false,
  },
  { from: 'MONITORING', to: 'SAFEGUARDING_ESCALATED', requiresRatification: false },
  { from: 'REFERRAL_PENDING', to: 'SAFEGUARDING_ESCALATED', requiresRatification: false },
];

// Populate the ratification-required set from the table so there is one source of truth.
for (const t of LEGAL_TRANSITIONS) {
  if (t.requiresRatification) {
    REQUIRES_RATIFICATION.add(ratifiedKey(t.from, t.to));
  }
}

// Build a fast lookup map: from → Set<to>.
const ALLOWED_TARGETS = new Map<SiasStatus, Set<SiasStatus>>();
for (const t of LEGAL_TRANSITIONS) {
  const targets = ALLOWED_TARGETS.get(t.from) ?? new Set();
  targets.add(t.to);
  ALLOWED_TARGETS.set(t.from, targets);
}

/** Thrown when a requested transition is not in the legal transitions table. */
export class SiasTransitionError extends Error {
  public override readonly name = 'SiasTransitionError';

  constructor(
    public readonly from: SiasStatus,
    public readonly to: SiasStatus,
    reason: string,
  ) {
    super(`SIAS transition ${from} → ${to} refused: ${reason}`);
  }
}

/**
 * A stored SBST ratification record.
 *
 * This is the evidence that a qualified SBST member recorded a decision before any
 * tier change, exit, or referral committed. It is stored separately and passed to
 * `transitionSias` as proof of the gate having been cleared.
 */
export interface SbstRatification {
  /** Unique identifier of this ratification event. */
  readonly ratificationId: string;
  /** The SBST member who recorded the decision. */
  readonly ratifiedBy: string;
  readonly ratifiedAt: Date;
}

/**
 * An immutable record of a SIAS state transition, suitable for writing to the audit
 * ledger. The caller is responsible for persisting this record.
 */
export interface SiasTransitionAudit {
  readonly learnerId: string;
  readonly fromStatus: SiasStatus;
  readonly toStatus: SiasStatus;
  /** The agent or user that triggered the transition. */
  readonly triggeredBy: string;
  readonly triggeredAt: Date;
  /** Present when the transition required SBST ratification. */
  readonly ratificationId: string | null;
}

/**
 * Validates and executes a single SIAS state transition.
 *
 * Throws {@link SiasTransitionError} if:
 *   - `current` is a terminal state.
 *   - The `current → target` pair is not in {@link LEGAL_TRANSITIONS}.
 *   - The transition requires SBST ratification and no `ratification` was provided.
 *
 * On success returns the new status and an audit record. The caller must persist both
 * atomically — `nextStatus` is not valid until the audit record is stored.
 */
export function transitionSias(
  learnerId: string,
  current: SiasStatus,
  target: SiasStatus,
  triggeredBy: string,
  at: Date,
  ratification?: SbstRatification,
): { readonly nextStatus: SiasStatus; readonly audit: SiasTransitionAudit } {
  if (TERMINAL_STATES.has(current)) {
    throw new SiasTransitionError(
      current,
      target,
      `case is in terminal state ${current} and cannot be advanced`,
    );
  }

  const allowed = ALLOWED_TARGETS.get(current);
  if (!allowed?.has(target)) {
    throw new SiasTransitionError(
      current,
      target,
      'transition is not in the legal transitions table',
    );
  }

  if (REQUIRES_RATIFICATION.has(ratifiedKey(current, target)) && !ratification) {
    throw new SiasTransitionError(
      current,
      target,
      'this transition requires a stored SBST ratification',
    );
  }

  const audit: SiasTransitionAudit = {
    learnerId,
    fromStatus: current,
    toStatus: target,
    triggeredBy,
    triggeredAt: at,
    ratificationId: ratification?.ratificationId ?? null,
  };

  return { nextStatus: target, audit };
}

/** Returns true when the given status is terminal (no further transitions permitted). */
export function isSiasTerminal(status: SiasStatus): boolean {
  return TERMINAL_STATES.has(status);
}

/** Returns every legal next state for the given current state. */
export function legalNextStates(current: SiasStatus): ReadonlyArray<SiasStatus> {
  if (TERMINAL_STATES.has(current)) return [];
  const targets = ALLOWED_TARGETS.get(current);
  return targets ? Array.from(targets) : [];
}
