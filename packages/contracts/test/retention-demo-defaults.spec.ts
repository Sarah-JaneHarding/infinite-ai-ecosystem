// DEMO_RETENTION_ESTIMATES / buildDemoRetentionSchedule — the onboarding-time starting
// template, not a shipped default (see this file's own header for the distinction).

import { describe, expect, it } from 'vitest';

import { DataCategory } from '../src/popia/purpose.js';
import { reviewSchedule } from '../src/popia/retention.js';
import {
  DEMO_RETENTION_ESTIMATES,
  buildDemoRetentionSchedule,
} from '../src/popia/retention-demo-defaults.js';

describe('DEMO_RETENTION_ESTIMATES', () => {
  it('covers every DataCategory exactly once', () => {
    const categories = DEMO_RETENTION_ESTIMATES.map((e) => e.category).toSorted();
    expect(categories).toEqual([...DataCategory.options].toSorted());
  });

  it('gives every estimate a positive whole-month period and a non-empty rationale', () => {
    for (const estimate of DEMO_RETENTION_ESTIMATES) {
      expect(Number.isInteger(estimate.retainMonths)).toBe(true);
      expect(estimate.retainMonths).toBeGreaterThan(0);
      expect(estimate.rationale.length).toBeGreaterThan(0);
    }
  });
});

describe('buildDemoRetentionSchedule', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const ratifiedBy = '20000000-0000-4000-8000-000000000002';
  const now = new Date('2026-08-31T00:00:00.000Z');

  it('produces a schema-valid schedule covering every category', () => {
    const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, now);
    const review = reviewSchedule(schedule);
    expect(review.valid).toBe(true);
    if (review.valid) {
      expect(review.unscheduled).toEqual([]);
      expect(review.scheduled.toSorted()).toEqual([...DataCategory.options].toSorted());
    }
  });

  it('stamps the real ratifiedBy/ratifiedAt supplied, not an invented one', () => {
    const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, now);
    for (const rule of schedule.rules) {
      expect(rule.ratifiedBy).toBe(ratifiedBy);
      expect(rule.ratifiedAt).toEqual(now);
    }
  });

  it("marks every non-overridden rule's authority as a demo estimate, not a legal citation", () => {
    const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, now);
    for (const rule of schedule.rules) {
      expect(rule.authority).toMatch(/DEMO ESTIMATE/);
    }
  });

  it('lets a school override one category before accepting, and leaves the rest as estimates', () => {
    const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, now, {
      ATTENDANCE: {
        retainMonths: 12,
        authority: 'Gauteng Department of Education Circular 14 of 2024, schedule 2',
      },
    });
    const attendance = schedule.rules.find((r) => r.category === 'ATTENDANCE');
    expect(attendance?.retainMonths).toBe(12);
    expect(attendance?.authority).not.toMatch(/DEMO ESTIMATE/);

    const other = schedule.rules.find((r) => r.category === 'BEHAVIOUR');
    expect(other?.authority).toMatch(/DEMO ESTIMATE/);
  });

  it('flags none of its own default authorities as a placeholder (reviewSchedule would refuse those)', () => {
    const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, now);
    const review = reviewSchedule(schedule);
    expect(review.valid).toBe(true);
    if (review.valid) {
      expect(review.findings).toEqual([]);
    }
  });
});
