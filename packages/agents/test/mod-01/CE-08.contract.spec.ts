// CE-08 contract validation — Stage 08 step 3.
//
// CE-08 Differentiation Agent takes a lesson plan and produces tier-aware variants
// for learners who need more support or greater challenge. It does not write learner
// data — it writes curriculum variants — so no approval gate sits between it and the
// Brain (the lesson plan it consumes was already approved by CE-05's gate).

import { describe, expect, it } from 'vitest';

import { CE08Contract } from '../../src/mod-01/CE-08.contract.js';

describe('CE-08 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE08Contract.id).toBe('CE-08');
  });

  it('is registered to MOD-01', () => {
    expect(CE08Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — differentiation is a curriculum-design activity', () => {
    expect(CE08Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE08Contract.promptRef).toEqual({ agent: 'CE-08', version: '1.0.0' });
  });

  it('does not require approval — the upstream lesson plan was approved; tiers are a derivative', () => {
    expect(CE08Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — differentiated sets are versioned curriculum artefacts', () => {
    expect(CE08Contract.writesToBrain).toBe(true);
  });

  it('declares the differentiation logical model', () => {
    expect(CE08Contract.model).toBe('curriculum.differentiate');
  });

  it('references the CE-08 eval set', () => {
    expect(CE08Contract.evalSetRef).toBe('CE-08');
  });

  it('declares pii_guard — differentiated plans must never contain learner PII', () => {
    expect(CE08Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — tier modifications must trace to CAPS objectives', () => {
    expect(CE08Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a differentiation task', () => {
    expect(CE08Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE08Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
