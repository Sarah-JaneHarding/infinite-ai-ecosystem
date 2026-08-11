// MOD-05 CPTD tracker tests — Stage 12 step 6.
//
// PD-08 (CPTD Tracker) must never invent or compute point values. All CPTD
// points come exclusively from L0 policy text supplied to the agent. These
// tests enforce that constraint at the contract level:
//
// 1. PD08Input requires policyDocumentIds (min 1) — the agent cannot run
//    without a policy corpus; refusing to supply one yields needs_input.
// 2. PD08Result ok always carries citedPolicyDocumentId — a policy citation
//    is mandatory, not optional, on any ok outcome.
// 3. PD08Result no_policy_match is a first-class outcome (not an error),
//    and it must NOT carry pointsAwarded — the system never fabricates points
//    when no clause is found.
// 4. An ok result without citedPolicyDocumentId is rejected at the schema level.
//
// These are schema-level tests only — no live model calls.

import { describe, expect, it } from 'vitest';

import { PD08Input, PD08Result } from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const NOW = '2026-08-11T10:00:00.000Z';

const VALID_INPUT = {
  tenantId: TENANT,
  teacherRef: 'anon-01',
  activityType: 'formal_workshop' as const,
  durationMinutes: 180,
  completedAt: NOW,
  policyDocumentIds: ['sace-cptd-2023'],
};

const VALID_OK = {
  status: 'ok' as const,
  teacherRef: 'anon-01',
  activityType: 'formal_workshop',
  pointsAwarded: 3,
  policyReference: 'SACE CPTD Policy 2023, Section 4.2: Formal Workshops',
  citedPolicyDocumentId: 'sace-cptd-2023',
  loggedAt: NOW,
  cycleTotal: 12,
};

// ---------------------------------------------------------------------------
// PD08Input — policy corpus is mandatory
// ---------------------------------------------------------------------------

describe('PD08Input', () => {
  it('accepts a valid input with at least one policyDocumentId', () => {
    expect(PD08Input.safeParse(VALID_INPUT).success).toBe(true);
  });

  it('rejects empty policyDocumentIds — policy corpus is required', () => {
    expect(PD08Input.safeParse({ ...VALID_INPUT, policyDocumentIds: [] }).success).toBe(
      false,
    );
  });

  it('rejects missing policyDocumentIds', () => {
    const { policyDocumentIds: _p, ...withoutPolicy } = VALID_INPUT;
    expect(PD08Input.safeParse(withoutPolicy).success).toBe(false);
  });

  it('accepts all valid activityType values', () => {
    const types = [
      'micro_course_completion',
      'coaching_cycle_completion',
      'peer_observation',
      'formal_workshop',
      'self_directed_study',
      'mentoring',
    ] as const;
    for (const activityType of types) {
      expect(PD08Input.safeParse({ ...VALID_INPUT, activityType }).success).toBe(true);
    }
  });

  it('rejects an unlisted activityType', () => {
    expect(
      PD08Input.safeParse({ ...VALID_INPUT, activityType: 'reading_a_book' }).success,
    ).toBe(false);
  });

  it('rejects durationMinutes <= 0', () => {
    expect(PD08Input.safeParse({ ...VALID_INPUT, durationMinutes: 0 }).success).toBe(
      false,
    );
    expect(PD08Input.safeParse({ ...VALID_INPUT, durationMinutes: -30 }).success).toBe(
      false,
    );
  });

  it('rejects a non-datetime completedAt', () => {
    expect(
      PD08Input.safeParse({ ...VALID_INPUT, completedAt: '2026-08-11' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PD08Result ok — citedPolicyDocumentId is required
// ---------------------------------------------------------------------------

describe('PD08Result ok — policy citation is mandatory', () => {
  it('accepts a valid ok result', () => {
    expect(PD08Result.safeParse(VALID_OK).success).toBe(true);
  });

  it('rejects an ok result missing citedPolicyDocumentId', () => {
    const { citedPolicyDocumentId: _c, ...withoutCited } = VALID_OK;
    expect(PD08Result.safeParse(withoutCited).success).toBe(false);
  });

  it('rejects an ok result with empty citedPolicyDocumentId', () => {
    expect(PD08Result.safeParse({ ...VALID_OK, citedPolicyDocumentId: '' }).success).toBe(
      false,
    );
  });

  it('rejects an ok result missing policyReference', () => {
    const { policyReference: _p, ...withoutRef } = VALID_OK;
    expect(PD08Result.safeParse(withoutRef).success).toBe(false);
  });

  it('rejects an ok result with empty policyReference', () => {
    expect(PD08Result.safeParse({ ...VALID_OK, policyReference: '' }).success).toBe(
      false,
    );
  });

  it('rejects negative pointsAwarded', () => {
    expect(PD08Result.safeParse({ ...VALID_OK, pointsAwarded: -1 }).success).toBe(false);
  });

  it('accepts pointsAwarded = 0 (activity found in policy but awarded zero points)', () => {
    expect(PD08Result.safeParse({ ...VALID_OK, pointsAwarded: 0 }).success).toBe(true);
  });

  it('rejects negative cycleTotal', () => {
    expect(PD08Result.safeParse({ ...VALID_OK, cycleTotal: -5 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PD08Result no_policy_match — no points fabricated
// ---------------------------------------------------------------------------

describe('PD08Result no_policy_match — first-class outcome without points', () => {
  const noPolicyMatch = {
    status: 'no_policy_match' as const,
    detail:
      'The supplied activity type does not match any clause in the provided CPTD policy documents.',
    activityType: 'something_unlisted',
  };

  it('accepts a valid no_policy_match result', () => {
    expect(PD08Result.safeParse(noPolicyMatch).success).toBe(true);
  });

  it('no_policy_match has no pointsAwarded — no fabrication of points', () => {
    const parsed = PD08Result.parse(noPolicyMatch);
    expect(parsed).not.toHaveProperty('pointsAwarded');
  });

  it('no_policy_match has no citedPolicyDocumentId', () => {
    const parsed = PD08Result.parse(noPolicyMatch);
    expect(parsed).not.toHaveProperty('citedPolicyDocumentId');
  });

  it('no_policy_match has no policyReference', () => {
    const parsed = PD08Result.parse(noPolicyMatch);
    expect(parsed).not.toHaveProperty('policyReference');
  });

  it('no_policy_match requires a non-empty detail string', () => {
    expect(PD08Result.safeParse({ ...noPolicyMatch, detail: '' }).success).toBe(false);
  });

  it('no_policy_match is a terminal outcome, not a schema error — it has a well-formed status', () => {
    const parsed = PD08Result.parse(noPolicyMatch);
    expect(parsed.status).toBe('no_policy_match');
  });
});

// ---------------------------------------------------------------------------
// PD08Result needs_input
// ---------------------------------------------------------------------------

describe('PD08Result needs_input', () => {
  const needsInput = {
    status: 'needs_input' as const,
    detail: 'policyDocumentIds is required but was empty.',
    missingFields: ['policyDocumentIds'],
  };

  it('accepts a valid needs_input result', () => {
    expect(PD08Result.safeParse(needsInput).success).toBe(true);
  });

  it('needs_input has no pointsAwarded', () => {
    const parsed = PD08Result.parse(needsInput);
    expect(parsed).not.toHaveProperty('pointsAwarded');
  });

  it('needs_input requires at least one missingField', () => {
    expect(PD08Result.safeParse({ ...needsInput, missingFields: [] }).success).toBe(
      false,
    );
  });
});
