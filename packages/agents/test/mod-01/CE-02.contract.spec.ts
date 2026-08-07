// CE-02 contract validation — Stage 08 step 2.

import { describe, expect, it } from 'vitest';

import { CE02Contract } from '../../src/mod-01/CE-02.contract.js';

describe('CE-02 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE02Contract.id).toBe('CE-02');
  });

  it('is registered to MOD-01', () => {
    expect(CE02Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — CE-02 is calendar scheduling, not learner analytics', () => {
    expect(CE02Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE02Contract.promptRef).toEqual({ agent: 'CE-02', version: '1.0.0' });
  });

  it('does not require approval — ATP schedules are ratified at the term plan level by CE-03', () => {
    expect(CE02Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — the ATP schedule must be versioned', () => {
    expect(CE02Contract.writesToBrain).toBe(true);
  });

  it('declares the sequencing logical model', () => {
    expect(CE02Contract.model).toBe('curriculum.sequence');
  });

  it('references the CE-02 eval set', () => {
    expect(CE02Contract.evalSetRef).toBe('CE-02');
  });

  it('declares pii_guard — CE-02 output is a curriculum calendar, never learner data', () => {
    expect(CE02Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every topic must cite an ATP source clause', () => {
    expect(CE02Contract.guardrails).toContain('grounding_check');
  });

  it('has a larger budget than CE-01 — ATP sequencing covers an entire academic year', () => {
    const ce01Budget = 6000;
    expect(CE02Contract.budget.maxTokens).toBeGreaterThan(ce01Budget);
  });

  it('has a budget within reasonable limits for a calendar-layout task', () => {
    expect(CE02Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE02Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
