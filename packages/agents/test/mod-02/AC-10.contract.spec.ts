// AC-10 contract validation — Stage 10 step 4.

import { describe, expect, it } from 'vitest';

import { AC10Contract } from '../../src/mod-02/AC-10.contract.js';

describe('AC-10 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC10Contract.id).toBe('AC-10');
  });

  it('is registered to MOD-02', () => {
    expect(AC10Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC10Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC10Contract.promptRef).toEqual({ agent: 'AC-10', version: '1.0.0' });
  });

  it('requires approval — parent letters must be reviewed before reaching a guardian', () => {
    expect(AC10Contract.requiresApproval).toBe(true);
  });

  it('does not write to the Brain — the report is a deliverable, not a versioned fact', () => {
    expect(AC10Contract.writesToBrain).toBe(false);
  });

  it('declares the support.screen logical model', () => {
    expect(AC10Contract.model).toBe('support.screen');
  });

  it('references the AC-10 eval set', () => {
    expect(AC10Contract.evalSetRef).toBe('AC-10');
  });

  it('declares pii_guard', () => {
    expect(AC10Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard — parent letters must not contain diagnostic language', () => {
    expect(AC10Contract.guardrails).toContain('diagnosis_guard');
  });

  it('declares readability_guard — output must meet the stated grade-level target', () => {
    expect(AC10Contract.guardrails).toContain('readability_guard');
  });

  it('has a positive budget', () => {
    expect(AC10Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC10Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC10Contract.tools).toHaveLength(0);
  });
});
