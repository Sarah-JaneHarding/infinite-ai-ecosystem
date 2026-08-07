// AC-05 contract validation — Stage 10 step 3.

import { describe, expect, it } from 'vitest';

import { AC05Contract } from '../../src/mod-02/AC-05.contract.js';

describe('AC-05 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC05Contract.id).toBe('AC-05');
  });

  it('is registered to MOD-02', () => {
    expect(AC05Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC05Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC05Contract.promptRef).toEqual({ agent: 'AC-05', version: '1.0.0' });
  });

  it('does not require approval — plan is produced for SBST to action', () => {
    expect(AC05Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — intervention plan is a versioned fact', () => {
    expect(AC05Contract.writesToBrain).toBe(true);
  });

  it('declares the support.screen logical model', () => {
    expect(AC05Contract.model).toBe('support.screen');
  });

  it('references the AC-05 eval set', () => {
    expect(AC05Contract.evalSetRef).toBe('AC-05');
  });

  it('declares pii_guard', () => {
    expect(AC05Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard', () => {
    expect(AC05Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC05Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC05Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC05Contract.tools).toHaveLength(0);
  });
});
