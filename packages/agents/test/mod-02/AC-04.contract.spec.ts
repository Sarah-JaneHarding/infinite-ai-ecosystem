// AC-04 contract validation — Stage 10 step 3.

import { describe, expect, it } from 'vitest';

import { AC04Contract } from '../../src/mod-02/AC-04.contract.js';

describe('AC-04 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC04Contract.id).toBe('AC-04');
  });

  it('is registered to MOD-02', () => {
    expect(AC04Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC04Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC04Contract.promptRef).toEqual({ agent: 'AC-04', version: '1.0.0' });
  });

  it('does not require approval — early warning is a signal, not a decision', () => {
    expect(AC04Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — warning signals are ephemeral', () => {
    expect(AC04Contract.writesToBrain).toBe(false);
  });

  it('declares the support.screen logical model', () => {
    expect(AC04Contract.model).toBe('support.screen');
  });

  it('references the AC-04 eval set', () => {
    expect(AC04Contract.evalSetRef).toBe('AC-04');
  });

  it('declares pii_guard', () => {
    expect(AC04Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard', () => {
    expect(AC04Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC04Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC04Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC04Contract.tools).toHaveLength(0);
  });
});
