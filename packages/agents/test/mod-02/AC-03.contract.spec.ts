// AC-03 contract validation — Stage 10 step 3.

import { describe, expect, it } from 'vitest';

import { AC03Contract } from '../../src/mod-02/AC-03.contract.js';

describe('AC-03 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC03Contract.id).toBe('AC-03');
  });

  it('is registered to MOD-02', () => {
    expect(AC03Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC03Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC03Contract.promptRef).toEqual({ agent: 'AC-03', version: '1.0.0' });
  });

  it('does not require approval — recommendation goes to SBST, not auto-applied', () => {
    expect(AC03Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — recommendation is a versioned fact', () => {
    expect(AC03Contract.writesToBrain).toBe(true);
  });

  it('declares the support.screen logical model', () => {
    expect(AC03Contract.model).toBe('support.screen');
  });

  it('references the AC-03 eval set', () => {
    expect(AC03Contract.evalSetRef).toBe('AC-03');
  });

  it('declares pii_guard', () => {
    expect(AC03Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard — must refuse diagnostic language', () => {
    expect(AC03Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC03Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC03Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC03Contract.tools).toHaveLength(0);
  });
});
