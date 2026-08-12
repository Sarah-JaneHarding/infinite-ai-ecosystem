import { z } from 'zod';

// ---------------------------------------------------------------------------
// Onboarding wizard — Stage 17 step 1 + 2
//
// Each step is either PENDING, IN_PROGRESS, COMPLETED, or FAILED. Required
// steps must all be COMPLETED before go-live is possible. The readiness score
// is the fraction of required steps completed, expressed as 0–100.
// ---------------------------------------------------------------------------

export const WIZARD_STEPS = [
  'create_tenant',
  'configure_school_profile',
  'import_staff',
  'import_learners',
  'connect_sources',
  'ratify_constitution',
  'readiness_check',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const REQUIRED_STEPS: ReadonlySet<WizardStep> = new Set([
  'create_tenant',
  'configure_school_profile',
  'import_staff',
  'import_learners',
  'ratify_constitution',
  'readiness_check',
]);

export const StepStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export interface WizardStepRecord {
  readonly step: WizardStep;
  readonly status: StepStatus;
  readonly completedAt?: Date;
  readonly errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Step-specific input schemas — validated before transition to IN_PROGRESS
// ---------------------------------------------------------------------------

export const CreateTenantInputSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens')
    .min(2)
    .max(80),
  kind: z.enum(['SCHOOL', 'SCHOOL_GROUP']),
  region: z.string().default('af-south-1'),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

export const SchoolProfileInputSchema = z.object({
  lolt: z.string().min(2).max(10),
  additionalLanguages: z.array(z.string()).default([]),
  termWeeks: z.number().int().min(1).max(16),
  phaseCount: z.number().int().min(1).max(4),
});
export type SchoolProfileInput = z.infer<typeof SchoolProfileInputSchema>;

export const ImportStaffInputSchema = z.object({
  staffCount: z.number().int().min(1),
  importMethod: z.enum(['CSV', 'SASAMS', 'MANUAL']),
});
export type ImportStaffInput = z.infer<typeof ImportStaffInputSchema>;

export const ImportLearnersInputSchema = z.object({
  learnerCount: z.number().int().min(1),
  importMethod: z.enum(['CSV', 'SASAMS', 'MANUAL']),
});
export type ImportLearnersInput = z.infer<typeof ImportLearnersInputSchema>;

const STEP_SCHEMAS: Partial<Record<WizardStep, z.ZodTypeAny>> = {
  create_tenant: CreateTenantInputSchema,
  configure_school_profile: SchoolProfileInputSchema,
  import_staff: ImportStaffInputSchema,
  import_learners: ImportLearnersInputSchema,
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Validates the input for a given wizard step. Returns a typed result so the
 * caller can act on validation errors without throwing.
 */
export function validateStepInput(
  step: WizardStep,
  input: unknown,
): { ok: true; data: unknown } | { ok: false; errors: z.ZodIssue[] } {
  const schema = STEP_SCHEMAS[step];
  if (schema === undefined) {
    // Steps without a schema (connect_sources, ratify_constitution, readiness_check)
    // are validated by downstream systems; the wizard accepts any input.
    return { ok: true, data: input };
  }
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, errors: result.error.issues };
}

/**
 * Computes the readiness score (0–100) from the current wizard step statuses.
 * Only required steps count toward the score.
 */
export function computeReadinessScore(steps: readonly WizardStepRecord[]): number {
  const requiredSteps = steps.filter((s) => REQUIRED_STEPS.has(s.step));
  if (requiredSteps.length === 0) return 0;
  const completed = requiredSteps.filter((s) => s.status === 'COMPLETED').length;
  return Math.round((completed / REQUIRED_STEPS.size) * 100);
}

/**
 * Returns true when all required steps are COMPLETED and the tenant is ready
 * for go-live.
 */
export function isReadyForGoLive(steps: readonly WizardStepRecord[]): boolean {
  return (
    REQUIRED_STEPS.size > 0 &&
    REQUIRED_STEPS.size ===
      steps.filter((s) => REQUIRED_STEPS.has(s.step) && s.status === 'COMPLETED').length
  );
}

/**
 * Returns the first PENDING required step, or undefined when all are done.
 * Used to drive the wizard UI to the next incomplete step.
 */
export function nextRequiredStep(
  steps: readonly WizardStepRecord[],
): WizardStep | undefined {
  for (const name of WIZARD_STEPS) {
    if (!REQUIRED_STEPS.has(name)) continue;
    const record = steps.find((s) => s.step === name);
    if (
      record === undefined ||
      record.status === 'PENDING' ||
      record.status === 'FAILED'
    ) {
      return name;
    }
  }
  return undefined;
}

/**
 * Returns a fresh wizard with all steps in PENDING state. The caller persists
 * this as a ProvisioningRecord per tenant.
 */
export function initialWizardState(): WizardStepRecord[] {
  return WIZARD_STEPS.map((step) => ({ step, status: 'PENDING' as const }));
}
