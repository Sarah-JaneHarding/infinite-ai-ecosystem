// Feature flag registry — Part 5 §5.1.
//
// Rules:
//   - Every flag has an owner and an expiresAt date.
//   - A flag older than 90 days is a CI error (checked by scripts/check-feature-flags.ts).
//   - Flags are evaluated at call time; the registry itself is a compile-time constant.
//   - No flag ever widens a security control. Flags are for product features, not gates.
//
// To add a flag: add an entry to FLAGS, set owner and expiresAt within 90 days, ship
// behind it, evaluate, then remove it. Never extend an expiry without a review.

import { z } from 'zod';

export const FeatureFlagSchema = z.object({
  key: z.string().min(1),
  description: z.string().min(1),
  owner: z.string().email('owner must be an email address'),
  /** ISO-8601 date string (YYYY-MM-DD). CI fails if today is past this date. */
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiresAt must be YYYY-MM-DD'),
  defaultValue: z.boolean(),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

/**
 * The live flag registry.
 *
 * Removing a flag here is the completion of the shipping cycle — not a cleanup step.
 * Do it in the same PR that removes the flag check from product code.
 */
export const FLAGS = [
  {
    key: 'pilot_school_onboarding_wizard',
    description:
      'Enables the new multi-step onboarding wizard UI (packages/provisioning). ' +
      'Replaces the manual CSV import flow used during private beta.',
    owner: 'mrsharding@benjaminpine.co.za',
    expiresAt: '2026-11-01',
    defaultValue: false,
  },
  {
    key: 'billing_dunning_emails',
    description:
      'Activates automated dunning email notifications when a tenant enters OVERDUE or SUSPENDED status. ' +
      'Requires a configured transactional email provider (OQ-021).',
    owner: 'mrsharding@benjaminpine.co.za',
    expiresAt: '2026-11-01',
    defaultValue: false,
  },
  {
    key: 'commons_pattern_sharing',
    description:
      'Allows tenants that have opted in to share anonymised learning patterns to the Commons pool (LE-08). ' +
      'k-anonymity threshold must be met before any sharing occurs.',
    owner: 'mrsharding@benjaminpine.co.za',
    expiresAt: '2026-11-15',
    defaultValue: false,
  },
] as const satisfies readonly FeatureFlag[];

export type FlagKey = (typeof FLAGS)[number]['key'];

/**
 * Returns the runtime value for a flag.
 *
 * Evaluation order: environment override → registry defaultValue.
 * Environment overrides use the key uppercased with `FLAG_` prefix:
 * `FLAG_PILOT_SCHOOL_ONBOARDING_WIZARD=true` enables that flag in production
 * without a code deploy. Useful during a gradual rollout; remove before expiry.
 */
export function isEnabled(
  key: FlagKey,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const envKey = `FLAG_${key.toUpperCase()}`;
  const override = env[envKey];
  if (override !== undefined) {
    return override === 'true' || override === '1';
  }
  const flag = FLAGS.find((f) => f.key === key);
  return flag?.defaultValue ?? false;
}

/**
 * Returns flags that have passed their expiresAt date relative to `asOf`.
 * Used by scripts/check-feature-flags.ts to fail CI on stale flags.
 */
export function expiredFlags(asOf: Date = new Date()): readonly FeatureFlag[] {
  const today = asOf.toISOString().slice(0, 10);
  return FLAGS.filter((f) => f.expiresAt < today);
}
