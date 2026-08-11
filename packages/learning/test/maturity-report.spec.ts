// Maturity report unit tests — Stage 13 step 9.
//
// Covers all four maturity levels and the boundary conditions between them.

import { describe, expect, it } from 'vitest';

import { assignMaturityLevel } from '../src/index.js';

const BASE_METRICS = {
  editRate: 0.3,
  firstPassAcceptanceRate: 0.7,
  medianTimeToArtefactMinutes: 15,
  meanOutcomeDelta: null,
  validatedPatternCount: 0,
  promotedExemplarCount: 0,
};

describe('assignMaturityLevel', () => {
  it('returns cold_start when no patterns have been validated', () => {
    expect(assignMaturityLevel({ ...BASE_METRICS, validatedPatternCount: 0 })).toBe(
      'cold_start',
    );
  });

  it('returns locally_calibrated when patterns exist but no outcome evidence', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 3,
        meanOutcomeDelta: null,
      }),
    ).toBe('locally_calibrated');
  });

  it('returns evidence_led when outcome evidence exists but not yet institutional', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 5,
        meanOutcomeDelta: 0.12,
        promotedExemplarCount: 1,
      }),
    ).toBe('evidence_led');
  });

  it('returns institutional when all three institutional conditions are met', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 10,
        meanOutcomeDelta: 0.15,
        promotedExemplarCount: 3,
        firstPassAcceptanceRate: 0.75,
      }),
    ).toBe('institutional');
  });

  it('does not reach institutional with fewer than 3 promoted exemplars', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 10,
        meanOutcomeDelta: 0.15,
        promotedExemplarCount: 2,
        firstPassAcceptanceRate: 0.8,
      }),
    ).toBe('evidence_led');
  });

  it('does not reach institutional with first-pass acceptance below 0.7', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 10,
        meanOutcomeDelta: 0.15,
        promotedExemplarCount: 5,
        firstPassAcceptanceRate: 0.69,
      }),
    ).toBe('evidence_led');
  });

  it('does not reach institutional without outcome evidence', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 20,
        meanOutcomeDelta: null,
        promotedExemplarCount: 10,
        firstPassAcceptanceRate: 0.9,
      }),
    ).toBe('locally_calibrated');
  });

  it('cold_start takes precedence over all other conditions', () => {
    expect(
      assignMaturityLevel({
        ...BASE_METRICS,
        validatedPatternCount: 0,
        meanOutcomeDelta: 0.5,
        promotedExemplarCount: 10,
        firstPassAcceptanceRate: 0.95,
      }),
    ).toBe('cold_start');
  });
});
