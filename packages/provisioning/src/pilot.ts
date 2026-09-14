// Pilot tenant configuration — OQ-019 resolution.
//
// Each entry is the confirmed minimum input for the onboarding wizard.
// School administrators review and ratify these values during the
// configure_school_profile wizard step; nothing is committed to the database
// until the wizard's readiness_check step passes and the constitution and
// retention schedule are ratified.

import { z } from 'zod';

import { CreateTenantInputSchema, SchoolProfileInputSchema } from './wizard.js';
import type { CreateTenantInput, SchoolProfileInput } from './wizard.js';

export interface PilotTenantConfig {
  readonly displayName: string;
  readonly tenantInput: CreateTenantInput;
  readonly schoolProfileInput: SchoolProfileInput;
  readonly tierSuggestion: 'starter' | 'professional' | 'enterprise';
  /** DBE term start date for the pilot — YYYY-MM-DD. */
  readonly pilotStartDate: string;
  readonly implementationPartnerEmail: string;
  readonly notes: string;
}

export const PilotTenantConfigSchema = z.object({
  displayName: z.string().min(2),
  tenantInput: CreateTenantInputSchema,
  schoolProfileInput: SchoolProfileInputSchema,
  tierSuggestion: z.enum(['starter', 'professional', 'enterprise']),
  pilotStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'pilotStartDate must be YYYY-MM-DD'),
  implementationPartnerEmail: z.string().email(),
  notes: z.string(),
});

// Pilot cohort — Term 4 2026 onboarding.
//
// schoolProfileInput values are starting defaults the school administrator
// reviews and ratifies during the configure_school_profile wizard step.
// Nothing is finalised until readiness_check passes.
export const PILOT_COHORT: readonly PilotTenantConfig[] = [
  {
    displayName: 'Benjamin Pine Primary School',
    tenantInput: {
      name: 'Benjamin Pine Primary School',
      slug: 'benjamin-pine',
      kind: 'SCHOOL',
      region: 'af-south-1',
    },
    schoolProfileInput: {
      lolt: 'en',
      additionalLanguages: ['af'],
      termWeeks: 10,
      phaseCount: 3,
    },
    tierSuggestion: 'starter',
    pilotStartDate: '2026-10-06', // DBE Term 4 2026 start
    implementationPartnerEmail: 'mrsharding@benjaminpine.co.za',
    notes:
      'Pilot school #1 (small primary, Starter tier). Grades R–7, English LoLT with ' +
      'Afrikaans FAL. Confirmed 2026-09-09 (OQ-019). School profile defaults must be ' +
      'reviewed and ratified by the principal or delegated HoD before the ' +
      'readiness_check wizard step.',
  },
] satisfies readonly PilotTenantConfig[];
