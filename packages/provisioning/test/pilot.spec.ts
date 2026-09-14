// Pilot tenant configuration tests — OQ-019 resolution.
//
// Definition of Done (§0.4): happy path plus at least two failure paths.
// Proves the pilot config is wizard-compatible before it reaches a real database.

import { describe, expect, it } from 'vitest';

import { PILOT_COHORT, PilotTenantConfigSchema } from '../src/pilot.js';
import { validateStepInput } from '../src/wizard.js';

describe('PILOT_COHORT — schema validity', () => {
  it('every entry satisfies PilotTenantConfigSchema', () => {
    for (const config of PILOT_COHORT) {
      const result = PilotTenantConfigSchema.safeParse(config);
      expect(
        result.success,
        `Config "${config.displayName}" failed schema validation`,
      ).toBe(true);
    }
  });

  it('every tenantInput passes the create_tenant wizard step', () => {
    for (const config of PILOT_COHORT) {
      const result = validateStepInput('create_tenant', config.tenantInput);
      expect(result.ok, `create_tenant step failed for "${config.displayName}"`).toBe(
        true,
      );
    }
  });

  it('every schoolProfileInput passes the configure_school_profile wizard step', () => {
    for (const config of PILOT_COHORT) {
      const result = validateStepInput(
        'configure_school_profile',
        config.schoolProfileInput,
      );
      expect(
        result.ok,
        `configure_school_profile step failed for "${config.displayName}"`,
      ).toBe(true);
    }
  });

  it('pilotStartDate matches YYYY-MM-DD format', () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const config of PILOT_COHORT) {
      expect(
        config.pilotStartDate,
        `"${config.displayName}" has an invalid pilotStartDate`,
      ).toMatch(iso);
    }
  });

  it('at least one school is in the cohort', () => {
    expect(PILOT_COHORT.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PILOT_COHORT — wizard step failure paths', () => {
  it('create_tenant rejects a slug containing spaces', () => {
    const invalid = { ...PILOT_COHORT[0]!.tenantInput, slug: 'invalid slug' };
    const result = validateStepInput('create_tenant', invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path.includes('slug'))).toBe(true);
    }
  });

  it('configure_school_profile rejects an empty lolt', () => {
    const invalid = { ...PILOT_COHORT[0]!.schoolProfileInput, lolt: '' };
    const result = validateStepInput('configure_school_profile', invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path.includes('lolt'))).toBe(true);
    }
  });

  it('configure_school_profile rejects phaseCount of zero', () => {
    const invalid = { ...PILOT_COHORT[0]!.schoolProfileInput, phaseCount: 0 };
    const result = validateStepInput('configure_school_profile', invalid);
    expect(result.ok).toBe(false);
  });
});
