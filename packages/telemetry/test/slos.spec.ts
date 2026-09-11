import { describe, it, expect } from 'vitest';
import {
  SLO_CATALOG,
  BURN_RATE_WINDOWS,
  TIME_TO_ARTEFACT_P95_MS,
  APPROVAL_QUEUE_AGE_MAX_MS,
  INGEST_FRESHNESS_MAX_MS,
  isBurning,
  monthlyErrorBudgetSeconds,
} from '../src/slos.js';

describe('SLO_CATALOG', () => {
  it('contains all five named SLOs from the manual', () => {
    const names = SLO_CATALOG.map((s) => s.name);
    expect(names).toContain('web_availability');
    expect(names).toContain('agent_run_success_rate');
    expect(names).toContain('time_to_artefact_p95');
    expect(names).toContain('approval_queue_age');
    expect(names).toContain('ingest_freshness');
  });

  it('every SLO target is a fraction strictly between 0 and 1', () => {
    for (const slo of SLO_CATALOG) {
      expect(slo.target).toBeGreaterThan(0);
      expect(slo.target).toBeLessThan(1);
    }
  });

  it('every SLO references an alert rule and a runbook', () => {
    for (const slo of SLO_CATALOG) {
      expect(slo.alertRule.length).toBeGreaterThan(0);
      expect(slo.runbook.length).toBeGreaterThan(0);
    }
  });

  it('web availability target is 99.9%', () => {
    const slo = SLO_CATALOG.find((s) => s.name === 'web_availability')!;
    expect(slo.target).toBe(0.999);
  });
});

describe('BURN_RATE_WINDOWS', () => {
  it('has the four standard SRE windows', () => {
    const hours = BURN_RATE_WINDOWS.map((w) => w.windowHours);
    expect(hours).toContain(1);
    expect(hours).toContain(6);
    expect(hours).toContain(24);
    expect(hours).toContain(72);
  });

  it('1h window has page severity and 14.4× threshold', () => {
    const w = BURN_RATE_WINDOWS.find((w) => w.windowHours === 1)!;
    expect(w.severity).toBe('page');
    expect(w.burnRateThreshold).toBe(14.4);
  });

  it('72h window has watch severity and 1× threshold', () => {
    const w = BURN_RATE_WINDOWS.find((w) => w.windowHours === 72)!;
    expect(w.severity).toBe('watch');
    expect(w.burnRateThreshold).toBe(1);
  });
});

describe('named thresholds', () => {
  it('TIME_TO_ARTEFACT_P95_MS is 30 seconds', () => {
    expect(TIME_TO_ARTEFACT_P95_MS).toBe(30_000);
  });

  it('APPROVAL_QUEUE_AGE_MAX_MS is 24 hours', () => {
    expect(APPROVAL_QUEUE_AGE_MAX_MS).toBe(24 * 60 * 60 * 1_000);
  });

  it('INGEST_FRESHNESS_MAX_MS is 1 hour', () => {
    expect(INGEST_FRESHNESS_MAX_MS).toBe(60 * 60 * 1_000);
  });
});

describe('monthlyErrorBudgetSeconds', () => {
  it('99.9% target gives 2592 seconds (43.2 minutes)', () => {
    expect(monthlyErrorBudgetSeconds(0.999)).toBeCloseTo(2592, 0);
  });

  it('99% target gives 25920 seconds (7.2 hours)', () => {
    expect(monthlyErrorBudgetSeconds(0.99)).toBeCloseTo(25920, 0);
  });

  it('100% target gives 0 budget', () => {
    expect(monthlyErrorBudgetSeconds(1)).toBe(0);
  });
});

describe('isBurning', () => {
  it('returns false when there are no requests', () => {
    expect(isBurning(0.999, 0, 0, 1, 14.4)).toBe(false);
  });

  it('returns true when burn rate exceeds the threshold', () => {
    // 50% error rate against a 0.1% budget = 500× burn rate >> 14.4
    expect(isBurning(0.999, 500, 1000, 1, 14.4)).toBe(true);
  });

  it('returns false when burn rate is below the threshold', () => {
    // 0.05% error rate against a 0.1% budget = 0.5× burn rate << 14.4
    expect(isBurning(0.999, 5, 10000, 1, 14.4)).toBe(false);
  });

  it('returns false at exactly the target error rate (burn rate = 1)', () => {
    // 0.1% error rate against a 0.1% budget = 1× burn rate, threshold is 14.4
    expect(isBurning(0.999, 10, 10000, 1, 14.4)).toBe(false);
  });
});
