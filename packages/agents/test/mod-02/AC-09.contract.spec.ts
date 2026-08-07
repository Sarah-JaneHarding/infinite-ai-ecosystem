// AC-09 contract validation — Stage 10 step 4.

import { describe, expect, it } from 'vitest';

import { AC09Contract } from '../../src/mod-02/AC-09.contract.js';

describe('AC-09 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC09Contract.id).toBe('AC-09');
  });

  it('is registered to MOD-02', () => {
    expect(AC09Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC09Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC09Contract.promptRef).toEqual({ agent: 'AC-09', version: '1.0.0' });
  });

  it('requires approval — SIAS referral pack needs sign-off before submission', () => {
    expect(AC09Contract.requiresApproval).toBe(true);
  });

  it('writes to the Brain — compiled SIAS pack is a versioned fact', () => {
    expect(AC09Contract.writesToBrain).toBe(true);
  });

  it('declares the support.screen logical model', () => {
    expect(AC09Contract.model).toBe('support.screen');
  });

  it('references the AC-09 eval set', () => {
    expect(AC09Contract.evalSetRef).toBe('AC-09');
  });

  it('declares pii_guard', () => {
    expect(AC09Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard — SIAS documentation must not contain diagnostic language', () => {
    expect(AC09Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC09Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC09Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC09Contract.tools).toHaveLength(0);
  });
});
