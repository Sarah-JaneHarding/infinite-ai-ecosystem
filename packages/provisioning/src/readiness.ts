// ---------------------------------------------------------------------------
// Readiness checks — Stage 17 step 2
//
// A school must pass all readiness checks before the platform allows go-live.
// Each check is a pure predicate so it can be tested without a database
// connection. The DB-backed equivalents (which query live tables) live in
// the integration tier.
// ---------------------------------------------------------------------------

export interface ReadinessCheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface TenantReadinessInput {
  readonly staffCount: number;
  readonly learnerCount: number;
  readonly hasConstitutionRatified: boolean;
  readonly hasAtLeastOnePhase: boolean;
  readonly hasAtLeastOneGrade: boolean;
  readonly hasAtLeastOneSubject: boolean;
  readonly hasSourceConnected: boolean;
  readonly subscriptionActive: boolean;
}

const MINIMUM_STAFF = 1;
const MINIMUM_LEARNERS = 1;

export function runReadinessChecks(input: TenantReadinessInput): ReadinessCheckResult[] {
  return [
    {
      name: 'staff_imported',
      passed: input.staffCount >= MINIMUM_STAFF,
      message:
        input.staffCount >= MINIMUM_STAFF
          ? `${String(input.staffCount)} staff member(s) imported.`
          : `At least ${String(MINIMUM_STAFF)} staff member must be imported before go-live.`,
    },
    {
      name: 'learners_imported',
      passed: input.learnerCount >= MINIMUM_LEARNERS,
      message:
        input.learnerCount >= MINIMUM_LEARNERS
          ? `${String(input.learnerCount)} learner(s) imported.`
          : `At least ${String(MINIMUM_LEARNERS)} learner must be imported before go-live.`,
    },
    {
      name: 'constitution_ratified',
      passed: input.hasConstitutionRatified,
      message: input.hasConstitutionRatified
        ? 'L0 constitution has been ratified.'
        : 'The L0 constitution must be ratified before go-live.',
    },
    {
      name: 'school_profile_complete',
      passed:
        input.hasAtLeastOnePhase &&
        input.hasAtLeastOneGrade &&
        input.hasAtLeastOneSubject,
      message:
        input.hasAtLeastOnePhase && input.hasAtLeastOneGrade && input.hasAtLeastOneSubject
          ? 'School profile is complete (phases, grades, subjects).'
          : 'School profile must include at least one phase, one grade, and one subject.',
    },
    {
      name: 'subscription_active',
      passed: input.subscriptionActive,
      message: input.subscriptionActive
        ? 'Subscription is active.'
        : 'An active subscription is required before go-live.',
    },
  ];
}

/**
 * Returns true when all readiness checks pass. The `hasSourceConnected` flag
 * is advisory only — a school may not have a MIS yet but can still go live.
 */
export function allReadinessChecksPassed(checks: ReadinessCheckResult[]): boolean {
  return checks.every((c) => c.passed);
}
