// AC-07 contract validation — Stage 10 step 3.

import { describe, expect, it } from 'vitest';

import { AC07Contract } from '../../src/mod-02/AC-07.contract.js';

describe('AC-07 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC07Contract.id).toBe('AC-07');
  });

  it('is registered to MOD-02', () => {
    expect(AC07Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC07Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC07Contract.promptRef).toEqual({ agent: 'AC-07', version: '1.0.0' });
  });

  it('does not require approval — fidelity check is an automated measurement', () => {
    expect(AC07Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — fidelity report is ephemeral evidence', () => {
    expect(AC07Contract.writesToBrain).toBe(false);
  });

  it('declares the support.screen logical model', () => {
    expect(AC07Contract.model).toBe('support.screen');
  });

  it('references the AC-07 eval set', () => {
    expect(AC07Contract.evalSetRef).toBe('AC-07');
  });

  it('declares pii_guard', () => {
    expect(AC07Contract.guardrails).toContain('pii_guard');
  });

  it('has a positive budget', () => {
    expect(AC07Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC07Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC07Contract.tools).toHaveLength(0);
  });
});
