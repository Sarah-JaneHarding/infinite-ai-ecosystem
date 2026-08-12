// ---------------------------------------------------------------------------
// Reconciliation — Stage 17 step 4 + 5
//
// Compares metered usage (aggregated by this module) against gateway
// telemetry for the same period. The two sources must agree within a
// configurable tolerance; any discrepancy above the threshold is a
// billing integrity failure that must be investigated before invoicing.
// ---------------------------------------------------------------------------

export interface TelemetryRecord {
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  // Tokens counted by the Model Gateway adapter (source of truth for costs).
  readonly totalTokens: number;
  // Cost in ZAR cents as recorded by the gateway adapter.
  readonly totalCostCents: number;
}

export type ReconciliationStatus = 'PASS' | 'FAIL';

export interface ReconciliationReport {
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly status: ReconciliationStatus;
  // Deltas: metered − telemetry (positive = metered higher)
  readonly tokenDelta: number;
  readonly costDeltaCents: number;
  // Percentage deviation of token count (absolute value, 0–100).
  readonly tokenDeviationPct: number;
  readonly tolerancePct: number;
  readonly reason: string;
}

// Default: allow up to 0.5 % divergence to absorb clock-skew edge events.
export const DEFAULT_TOLERANCE_PCT = 0.5;

/**
 * Reconciles metered token/cost totals against gateway telemetry for a single
 * billing period. Returns PASS when the token count diverges by less than
 * `tolerancePct` percentage points; FAIL otherwise.
 *
 * Cost delta is always reported for audit purposes even on a PASS, so that
 * invoicing can choose which figure to use.
 */
export function reconcilePeriod(
  meteredTokens: number,
  meteredCostCents: number,
  telemetry: TelemetryRecord,
  tolerancePct: number = DEFAULT_TOLERANCE_PCT,
): ReconciliationReport {
  if (tolerancePct < 0) {
    throw new RangeError('tolerancePct must be ≥ 0');
  }

  const tokenDelta = meteredTokens - telemetry.totalTokens;
  const costDeltaCents = meteredCostCents - telemetry.totalCostCents;

  // When telemetry is zero we treat any non-zero metered count as 100 %
  // deviation (cannot divide by zero).
  const tokenDeviationPct =
    telemetry.totalTokens === 0
      ? meteredTokens === 0
        ? 0
        : 100
      : (Math.abs(tokenDelta) / telemetry.totalTokens) * 100;

  const status: ReconciliationStatus =
    tokenDeviationPct <= tolerancePct ? 'PASS' : 'FAIL';

  const reason =
    status === 'PASS'
      ? `Token counts agree within ${tolerancePct}% tolerance (deviation: ${tokenDeviationPct.toFixed(3)}%)`
      : `Token count deviation ${tokenDeviationPct.toFixed(3)}% exceeds ${tolerancePct}% tolerance (metered=${meteredTokens}, telemetry=${telemetry.totalTokens}, delta=${tokenDelta})`;

  return {
    tenantId: telemetry.tenantId,
    periodStart: telemetry.periodStart,
    periodEnd: telemetry.periodEnd,
    status,
    tokenDelta,
    costDeltaCents,
    tokenDeviationPct,
    tolerancePct,
    reason,
  };
}
