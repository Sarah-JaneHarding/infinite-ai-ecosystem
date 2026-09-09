// Stage 18 §5.1 feature flag registry tests.
// Definition of Done (§0.4): happy path plus at least two failure paths.

import { describe, expect, it } from 'vitest';

import { FeatureFlagSchema, FLAGS, expiredFlags, isEnabled } from '../src/flags.js';

// ─── Registry integrity ───────────────────────────────────────────────────────

describe('FLAGS registry', () => {
  it('every entry satisfies the FeatureFlagSchema', () => {
    for (const flag of FLAGS) {
      const result = FeatureFlagSchema.safeParse(flag);
      expect(result.success, `Flag "${flag.key}" failed schema validation`).toBe(true);
    }
  });

  it('all keys are unique', () => {
    const keys = FLAGS.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all owners are valid email addresses', () => {
    for (const flag of FLAGS) {
      expect(flag.owner, `Flag "${flag.key}" owner must be an email`).toMatch(
        /^[^@]+@[^@]+\.[^@]+$/,
      );
    }
  });

  it('expiresAt values are valid YYYY-MM-DD dates', () => {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    for (const flag of FLAGS) {
      expect(flag.expiresAt, `Flag "${flag.key}" expiresAt must be YYYY-MM-DD`).toMatch(
        pattern,
      );
    }
  });
});

// ─── FeatureFlagSchema ────────────────────────────────────────────────────────

describe('FeatureFlagSchema', () => {
  const VALID = {
    key: 'some_feature',
    description: 'A test feature flag.',
    owner: 'owner@example.com',
    expiresAt: '2026-12-31',
    defaultValue: false,
  } as const;

  it('accepts a well-formed flag object', () => {
    const result = FeatureFlagSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('rejects a flag with a non-email owner', () => {
    const result = FeatureFlagSchema.safeParse({ ...VALID, owner: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a flag with a malformed expiresAt date', () => {
    const result = FeatureFlagSchema.safeParse({ ...VALID, expiresAt: '31/12/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects a flag with an empty key', () => {
    const result = FeatureFlagSchema.safeParse({ ...VALID, key: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a flag with an empty description', () => {
    const result = FeatureFlagSchema.safeParse({ ...VALID, description: '' });
    expect(result.success).toBe(false);
  });
});

// ─── isEnabled ────────────────────────────────────────────────────────────────

describe('isEnabled — happy path', () => {
  it('returns the registry defaultValue when no env override is set', () => {
    // All three flags default to false.
    expect(isEnabled('pilot_school_onboarding_wizard', {})).toBe(false);
    expect(isEnabled('billing_dunning_emails', {})).toBe(false);
    expect(isEnabled('commons_pattern_sharing', {})).toBe(false);
  });

  it('returns true when the env override is the string "true"', () => {
    const env = { FLAG_PILOT_SCHOOL_ONBOARDING_WIZARD: 'true' };
    expect(isEnabled('pilot_school_onboarding_wizard', env)).toBe(true);
  });

  it('returns true when the env override is the string "1"', () => {
    const env = { FLAG_BILLING_DUNNING_EMAILS: '1' };
    expect(isEnabled('billing_dunning_emails', env)).toBe(true);
  });

  it('uses the uppercased FLAG_ prefix for env lookup', () => {
    const env = { FLAG_COMMONS_PATTERN_SHARING: 'true' };
    expect(isEnabled('commons_pattern_sharing', env)).toBe(true);
  });
});

describe('isEnabled — failure paths', () => {
  it('returns false for any value other than "true" or "1"', () => {
    const env = { FLAG_PILOT_SCHOOL_ONBOARDING_WIZARD: 'yes' };
    expect(isEnabled('pilot_school_onboarding_wizard', env)).toBe(false);
  });

  it('returns false when env override is the string "false"', () => {
    const env = { FLAG_BILLING_DUNNING_EMAILS: 'false' };
    expect(isEnabled('billing_dunning_emails', env)).toBe(false);
  });

  it('returns false when env override is an empty string', () => {
    const env = { FLAG_COMMONS_PATTERN_SHARING: '' };
    expect(isEnabled('commons_pattern_sharing', env)).toBe(false);
  });
});

// ─── expiredFlags ─────────────────────────────────────────────────────────────

describe('expiredFlags — happy path', () => {
  it('returns no flags when checked before all expiry dates', () => {
    // billing_dunning_emails: 2026-11-01, commons_pattern_sharing: 2026-11-15,
    // pilot_school_onboarding_wizard: 2027-02-01 (extended for pilot evaluation).
    const beforeAll = new Date('2026-10-31');
    expect(expiredFlags(beforeAll)).toHaveLength(0);
  });

  it('returns billing and commons flags once they expire, but not pilot', () => {
    // pilot_school_onboarding_wizard does not expire until 2027-02-01.
    const afterBillingCommons = new Date('2026-11-20');
    const expired = expiredFlags(afterBillingCommons);
    const keys = expired.map((f) => f.key);
    expect(keys).toContain('billing_dunning_emails');
    expect(keys).toContain('commons_pattern_sharing');
    expect(keys).not.toContain('pilot_school_onboarding_wizard');
  });

  it('returns all flags when checked after the last expiry date (2027-02-01)', () => {
    const afterAll = new Date('2027-02-20');
    expect(expiredFlags(afterAll)).toHaveLength(FLAGS.length);
  });
});

describe('expiredFlags — failure paths', () => {
  it('does not return a flag on the day of its expiry (boundary — not yet expired)', () => {
    // expiresAt < today (strict less-than), so flags expiring today are not stale.
    const onBillingExpiry = new Date('2026-11-01');
    const expired = expiredFlags(onBillingExpiry);
    const keys = expired.map((f) => f.key);
    expect(keys).not.toContain('billing_dunning_emails');
    expect(keys).not.toContain('pilot_school_onboarding_wizard');
  });

  it('returns flags in a far-future check', () => {
    const farFuture = new Date('2030-01-01');
    expect(expiredFlags(farFuture)).toHaveLength(FLAGS.length);
  });
});
