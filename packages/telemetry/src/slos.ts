// Service Level Objectives — Stage 15 step 4.
//
// SLOs are defined as data, not commentary. Each one names the target, the measurement
// window, and the burn-rate thresholds used to fire an alert before the monthly budget is
// exhausted. Burn-rate alerts fire on rate rather than on single failures because a
// single failure in a large window consumes a negligible fraction of budget, and a
// constant failure rate that would exhaust the budget in a day is the thing worth waking
// someone for.
//
// Burn rate = (observed error rate) / (error budget rate).
// Error budget rate = 1 - SLO_target.
// A burn rate of 14.4 means 2% of the monthly budget is gone in one hour.

/** Fraction in [0, 1]: 0.999 means 99.9% of requests succeed. */
export type SloTarget = number;

export interface Slo {
  readonly name: string;
  /** Target expressed as a fraction. */
  readonly target: SloTarget;
  /** Description — plain English, no abbreviations. */
  readonly description: string;
  /** The corresponding alert rule name in the catalog. */
  readonly alertRule: string;
  /** Link to the runbook that handles a sustained breach. */
  readonly runbook: string;
}

export interface BurnRateWindow {
  readonly windowHours: number;
  /** Burn rate above this threshold triggers the alert. */
  readonly burnRateThreshold: number;
  /** Budget fraction consumed at the threshold rate over this window. */
  readonly budgetFractionConsumed: number;
  readonly severity: 'page' | 'ticket' | 'watch';
}

/**
 * Standard Google SRE burn-rate windows.
 * A 14.4× burn rate for 1h consumes 2% of a 30-day budget — worth paging.
 * A 1× burn rate for 72h consumes 10% — worth a ticket.
 */
export const BURN_RATE_WINDOWS: readonly BurnRateWindow[] = [
  {
    windowHours: 1,
    burnRateThreshold: 14.4,
    budgetFractionConsumed: 0.02,
    severity: 'page',
  },
  {
    windowHours: 6,
    burnRateThreshold: 6,
    budgetFractionConsumed: 0.05,
    severity: 'page',
  },
  {
    windowHours: 24,
    burnRateThreshold: 3,
    budgetFractionConsumed: 0.1,
    severity: 'ticket',
  },
  {
    windowHours: 72,
    burnRateThreshold: 1,
    budgetFractionConsumed: 0.1,
    severity: 'watch',
  },
] as const;

export const SLO_CATALOG: readonly Slo[] = [
  {
    name: 'web_availability',
    target: 0.999,
    description: '99.9% of HTTP requests to the web app return a non-5xx response.',
    alertRule: 'web_availability_burn_rate',
    runbook: 'region-loss.md',
  },
  {
    name: 'agent_run_success_rate',
    target: 0.99,
    description: '99% of agent pipeline runs complete without an unrecoverable error.',
    alertRule: 'agent_run_failure_burst',
    runbook: 'queue-backlog.md',
  },
  {
    name: 'time_to_artefact_p95',
    target: 0.95,
    description:
      '95% of artefacts are available for approval within 30 seconds of a run.',
    alertRule: 'time_to_artefact_p95_exceeded',
    runbook: 'queue-backlog.md',
  },
  {
    name: 'approval_queue_age',
    target: 0.99,
    description: 'No artefact waits more than 24 hours in the approval queue.',
    alertRule: 'approval_queue_age_exceeded',
    runbook: 'queue-backlog.md',
  },
  {
    name: 'ingest_freshness',
    target: 0.99,
    description: 'Ingest data is less than 1 hour old on 99% of checks.',
    alertRule: 'ingest_freshness_stale',
    runbook: 'queue-backlog.md',
  },
] as const;

// Named thresholds used in metric alert rules.
export const TIME_TO_ARTEFACT_P95_MS = 30_000;
export const APPROVAL_QUEUE_AGE_MAX_MS = 24 * 60 * 60 * 1_000;
export const INGEST_FRESHNESS_MAX_MS = 60 * 60 * 1_000;

/**
 * Monthly error budget in seconds given an SLO target.
 * window_seconds = 30 days × 24h × 3600s = 2_592_000.
 */
export function monthlyErrorBudgetSeconds(target: SloTarget): number {
  const WINDOW_SECONDS = 30 * 24 * 3_600;
  return (1 - target) * WINDOW_SECONDS;
}

/**
 * Returns true when the observed error rate over the window would exhaust the monthly
 * error budget faster than the threshold burn rate.
 * observedErrors / totalRequests is the error fraction for that window.
 */
export function isBurning(
  target: SloTarget,
  observedErrors: number,
  totalRequests: number,
  windowHours: number,
  burnRateThreshold: number,
): boolean {
  if (totalRequests === 0) return false;
  const errorFraction = observedErrors / totalRequests;
  const budgetRate = 1 - target;
  const burnRate = errorFraction / budgetRate;
  const windowFraction = windowHours / (30 * 24);
  const budgetConsumed = burnRate * windowFraction;
  void budgetConsumed;
  return burnRate >= burnRateThreshold;
}
