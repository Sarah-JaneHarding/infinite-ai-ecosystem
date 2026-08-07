// CE-04 contract validation — Stage 08 step 3.
//
// CE-04 Unit Architect takes a content area from the term plan and produces a
// backward-design blueprint with big ideas, success criteria, and evidence items.
// All output is sourced from CAPS — the agent never invents curriculum targets.

import { describe, expect, it } from 'vitest';

import { CE04Contract } from '../../src/mod-01/CE-04.contract.js';

describe('CE-04 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE04Contract.id).toBe('CE-04');
  });

  it('is registered to MOD-01', () => {
    expect(CE04Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — CE-04 is curriculum design, not learner analytics', () => {
    expect(CE04Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE04Contract.promptRef).toEqual({ agent: 'CE-04', version: '1.0.0' });
  });

  it('does not require approval — blueprint is a ratification candidate, not a published artefact', () => {
    expect(CE04Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — unit blueprints are versioned facts', () => {
    expect(CE04Contract.writesToBrain).toBe(true);
  });

  it('declares the design logical model', () => {
    expect(CE04Contract.model).toBe('curriculum.design');
  });

  it('references the CE-04 eval set', () => {
    expect(CE04Contract.evalSetRef).toBe('CE-04');
  });

  it('declares pii_guard — a unit blueprint must never contain learner PII', () => {
    expect(CE04Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every success criterion must cite a CAPS clause', () => {
    expect(CE04Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a backward-design task', () => {
    expect(CE04Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE04Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
