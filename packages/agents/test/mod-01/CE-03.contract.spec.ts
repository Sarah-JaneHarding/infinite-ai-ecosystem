// CE-03 contract validation — Stage 08 step 3.
//
// CE-03 Term Planner translates an ATPSchedule into a per-term week-by-week plan.
// It is a structural agent, not an assessment agent — no learner data touches it and
// no approval gate sits before its Brain write (the HoD gate is upstream at CE-03
// output → term plan ratification, managed by the pipeline in step 4).

import { describe, expect, it } from 'vitest';

import { CE03Contract } from '../../src/mod-01/CE-03.contract.js';

describe('CE-03 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE03Contract.id).toBe('CE-03');
  });

  it('is registered to MOD-01', () => {
    expect(CE03Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — CE-03 is calendar structure, not learner analytics', () => {
    expect(CE03Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE03Contract.promptRef).toEqual({ agent: 'CE-03', version: '1.0.0' });
  });

  it('does not require approval — output goes to L0 as a ratification candidate', () => {
    expect(CE03Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — the term plan must be versioned in L0', () => {
    expect(CE03Contract.writesToBrain).toBe(true);
  });

  it('declares the term-planning logical model', () => {
    expect(CE03Contract.model).toBe('curriculum.plan');
  });

  it('references the CE-03 eval set', () => {
    expect(CE03Contract.evalSetRef).toBe('CE-03');
  });

  it('declares pii_guard — a term plan must never contain learner PII', () => {
    expect(CE03Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every topic placement must cite an ATP source', () => {
    expect(CE03Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a planning task', () => {
    expect(CE03Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE03Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
