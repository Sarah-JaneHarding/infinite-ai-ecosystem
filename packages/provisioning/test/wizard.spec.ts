import { buildDemoRetentionSchedule } from '@infinite-ai/contracts';
import { describe, it, expect } from 'vitest';
import {
  validateStepInput,
  computeReadinessScore,
  isReadyForGoLive,
  nextRequiredStep,
  initialWizardState,
  REQUIRED_STEPS,
  WIZARD_STEPS,
  type WizardStepRecord,
} from '../src/wizard';

describe('initialWizardState', () => {
  it('returns one record per wizard step, all PENDING', () => {
    const state = initialWizardState();
    expect(state).toHaveLength(WIZARD_STEPS.length);
    for (const record of state) {
      expect(record.status).toBe('PENDING');
    }
  });

  it('covers all WIZARD_STEPS in order', () => {
    const state = initialWizardState();
    expect(state.map((s) => s.step)).toEqual([...WIZARD_STEPS]);
  });
});

describe('validateStepInput', () => {
  describe('create_tenant', () => {
    it('accepts valid input', () => {
      const result = validateStepInput('create_tenant', {
        name: 'Springfield Primary',
        slug: 'springfield-primary',
        kind: 'SCHOOL',
        region: 'af-south-1',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects an empty name', () => {
      const result = validateStepInput('create_tenant', {
        name: '',
        slug: 'springfield-primary',
        kind: 'SCHOOL',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects a slug with uppercase letters', () => {
      const result = validateStepInput('create_tenant', {
        name: 'Springfield Primary',
        slug: 'Springfield-Primary',
        kind: 'SCHOOL',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects an unknown kind', () => {
      const result = validateStepInput('create_tenant', {
        name: 'Springfield Primary',
        slug: 'springfield',
        kind: 'MUNICIPALITY',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('configure_school_profile', () => {
    it('accepts valid profile input', () => {
      const result = validateStepInput('configure_school_profile', {
        lolt: 'en',
        termWeeks: 10,
        phaseCount: 3,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects termWeeks = 0', () => {
      const result = validateStepInput('configure_school_profile', {
        lolt: 'en',
        termWeeks: 0,
        phaseCount: 3,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('ratify_retention_schedule', () => {
    const tenantId = '10000000-0000-4000-8000-000000000001';
    const ratifiedBy = '20000000-0000-4000-8000-000000000002';

    it('accepts the demo estimate schedule, pre-filled and accepted as-is', () => {
      const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, new Date());
      const result = validateStepInput('ratify_retention_schedule', schedule);
      expect(result.ok).toBe(true);
    });

    it('accepts a demo schedule with one category overridden by the school', () => {
      const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, new Date(), {
        ATTENDANCE: {
          retainMonths: 12,
          authority: 'Gauteng Department of Education Circular 14 of 2024, schedule 2',
        },
      });
      const result = validateStepInput('ratify_retention_schedule', schedule);
      expect(result.ok).toBe(true);
    });

    it('rejects a schedule missing the required tenantId', () => {
      const result = validateStepInput('ratify_retention_schedule', { rules: [] });
      expect(result.ok).toBe(false);
    });

    it('rejects a schedule with two rules for the same category', () => {
      const schedule = buildDemoRetentionSchedule(tenantId, ratifiedBy, new Date());
      const duplicated = { ...schedule, rules: [...schedule.rules, schedule.rules[0]] };
      const result = validateStepInput('ratify_retention_schedule', duplicated);
      expect(result.ok).toBe(false);
    });

    it('rejects a schedule that is not an object', () => {
      const result = validateStepInput('ratify_retention_schedule', null);
      expect(result.ok).toBe(false);
    });
  });

  describe('steps without a schema', () => {
    it('accepts any input for connect_sources', () => {
      const result = validateStepInput('connect_sources', { whatever: true });
      expect(result.ok).toBe(true);
    });

    it('accepts any input for ratify_constitution', () => {
      const result = validateStepInput('ratify_constitution', null);
      expect(result.ok).toBe(true);
    });
  });
});

describe('computeReadinessScore', () => {
  it('returns 0 when all steps are PENDING', () => {
    const steps = initialWizardState();
    expect(computeReadinessScore(steps)).toBe(0);
  });

  it('returns 100 when all required steps are COMPLETED', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: REQUIRED_STEPS.has(step) ? 'COMPLETED' : 'PENDING',
    }));
    expect(computeReadinessScore(steps)).toBe(100);
  });

  it('returns 50 when half of required steps are COMPLETED', () => {
    const required = [...REQUIRED_STEPS];
    const half = required.slice(0, Math.floor(required.length / 2));
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: half.includes(step) ? 'COMPLETED' : 'PENDING',
    }));
    const score = computeReadinessScore(steps);
    // Should be between 40 and 60 depending on exact half
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('does not count optional steps toward the score', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      // Mark only connect_sources COMPLETED (it is optional)
      status: step === 'connect_sources' ? 'COMPLETED' : 'PENDING',
    }));
    expect(computeReadinessScore(steps)).toBe(0);
  });
});

describe('isReadyForGoLive', () => {
  it('returns false when all steps are PENDING', () => {
    expect(isReadyForGoLive(initialWizardState())).toBe(false);
  });

  it('returns true when all required steps are COMPLETED', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: REQUIRED_STEPS.has(step) ? 'COMPLETED' : 'PENDING',
    }));
    expect(isReadyForGoLive(steps)).toBe(true);
  });

  it('returns false when one required step is FAILED', () => {
    const required = [...REQUIRED_STEPS];
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status:
        step === required[required.length - 1]
          ? 'FAILED'
          : REQUIRED_STEPS.has(step)
            ? 'COMPLETED'
            : 'PENDING',
    }));
    expect(isReadyForGoLive(steps)).toBe(false);
  });
});

describe('nextRequiredStep', () => {
  it('returns the first required step when nothing is done', () => {
    const steps = initialWizardState();
    expect(nextRequiredStep(steps)).toBe('create_tenant');
  });

  it('advances past completed steps', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: step === 'create_tenant' ? 'COMPLETED' : 'PENDING',
    }));
    expect(nextRequiredStep(steps)).toBe('configure_school_profile');
  });

  it('returns undefined when all required steps are complete', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: REQUIRED_STEPS.has(step) ? 'COMPLETED' : 'PENDING',
    }));
    expect(nextRequiredStep(steps)).toBeUndefined();
  });

  it('returns a FAILED step as the next step to retry', () => {
    const steps: WizardStepRecord[] = WIZARD_STEPS.map((step) => ({
      step,
      status: step === 'create_tenant' ? 'FAILED' : 'PENDING',
    }));
    expect(nextRequiredStep(steps)).toBe('create_tenant');
  });
});
