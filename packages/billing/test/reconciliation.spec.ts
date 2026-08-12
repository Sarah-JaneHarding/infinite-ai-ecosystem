import { describe, it, expect } from 'vitest';
import {
  reconcilePeriod,
  DEFAULT_TOLERANCE_PCT,
  type TelemetryRecord,
} from '../src/reconciliation';

const TENANT = 'tenant-xyz';
const PERIOD_START = new Date('2026-08-01T00:00:00Z');
const PERIOD_END = new Date('2026-09-01T00:00:00Z');

function makeTelemetry(overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    tenantId: TENANT,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    totalTokens: 1_000_000,
    totalCostCents: 100,
    ...overrides,
  };
}

describe('reconcilePeriod', () => {
  it('returns PASS when metered and telemetry agree exactly', () => {
    const report = reconcilePeriod(1_000_000, 100, makeTelemetry());
    expect(report.status).toBe('PASS');
    expect(report.tokenDelta).toBe(0);
    expect(report.costDeltaCents).toBe(0);
  });

  it('returns PASS when deviation is within default tolerance', () => {
    // 0.3% deviation — within 0.5% default
    const metered = 1_003_000;
    const report = reconcilePeriod(
      metered,
      100,
      makeTelemetry({ totalTokens: 1_000_000 }),
    );
    expect(report.status).toBe('PASS');
    expect(report.tokenDeviationPct).toBeLessThanOrEqual(DEFAULT_TOLERANCE_PCT);
  });

  it('returns FAIL when deviation exceeds default tolerance', () => {
    // 2% deviation — exceeds 0.5%
    const metered = 1_020_000;
    const report = reconcilePeriod(
      metered,
      100,
      makeTelemetry({ totalTokens: 1_000_000 }),
    );
    expect(report.status).toBe('FAIL');
    expect(report.tokenDeviationPct).toBeGreaterThan(DEFAULT_TOLERANCE_PCT);
  });

  it('returns PASS with a wider custom tolerance', () => {
    // 5% deviation but tolerance set to 10%
    const report = reconcilePeriod(
      1_050_000,
      100,
      makeTelemetry({ totalTokens: 1_000_000 }),
      10,
    );
    expect(report.status).toBe('PASS');
  });

  it('always reports cost delta even on PASS', () => {
    const report = reconcilePeriod(
      1_000_000,
      110,
      makeTelemetry({ totalCostCents: 100 }),
    );
    expect(report.costDeltaCents).toBe(10);
    expect(report.status).toBe('PASS');
  });

  it('handles the case where both metered and telemetry are zero', () => {
    const report = reconcilePeriod(
      0,
      0,
      makeTelemetry({ totalTokens: 0, totalCostCents: 0 }),
    );
    expect(report.status).toBe('PASS');
    expect(report.tokenDeviationPct).toBe(0);
  });

  it('returns FAIL at 100% deviation when telemetry is zero and metered is non-zero', () => {
    const report = reconcilePeriod(1_000, 10, makeTelemetry({ totalTokens: 0 }));
    expect(report.status).toBe('FAIL');
    expect(report.tokenDeviationPct).toBe(100);
  });

  it('reports the correct tenantId and period from telemetry', () => {
    const telemetry = makeTelemetry({ tenantId: 'other-tenant' });
    const report = reconcilePeriod(1_000_000, 100, telemetry);
    expect(report.tenantId).toBe('other-tenant');
    expect(report.periodStart).toEqual(PERIOD_START);
    expect(report.periodEnd).toEqual(PERIOD_END);
  });

  it('throws a RangeError for negative tolerance', () => {
    expect(() => reconcilePeriod(1_000_000, 100, makeTelemetry(), -1)).toThrow(
      RangeError,
    );
  });

  it('includes the tolerance in the report', () => {
    const report = reconcilePeriod(1_000_000, 100, makeTelemetry(), 2);
    expect(report.tolerancePct).toBe(2);
  });

  it('includes a human-readable reason string', () => {
    const pass = reconcilePeriod(1_000_000, 100, makeTelemetry());
    expect(pass.reason).toMatch(/agree/i);

    const fail = reconcilePeriod(1_100_000, 100, makeTelemetry());
    expect(fail.reason).toMatch(/deviation/i);
    expect(fail.reason).toMatch(/1100000/);
  });
});
