// AC-06 contract validation — Stage 10 step 3.

import { describe, expect, it } from 'vitest';

import { AC06Contract } from '../../src/mod-02/AC-06.contract.js';

describe('AC-06 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC06Contract.id).toBe('AC-06');
  });

  it('is registered to MOD-02', () => {
    expect(AC06Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC06Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC06Contract.promptRef).toEqual({ agent: 'AC-06', version: '1.0.0' });
  });

  it('does not require approval — recommendation feeds SBST review, not auto-transition', () => {
    expect(AC06Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — monitoring report is ephemeral input to SBST', () => {
    expect(AC06Contract.writesToBrain).toBe(false);
  });

  it('declares the support.screen logical model', () => {
    expect(AC06Contract.model).toBe('support.screen');
  });

  it('references the AC-06 eval set', () => {
    expect(AC06Contract.evalSetRef).toBe('AC-06');
  });

  it('declares pii_guard', () => {
    expect(AC06Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard', () => {
    expect(AC06Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC06Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC06Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC06Contract.tools).toHaveLength(0);
  });
});
