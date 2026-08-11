import { describe, expect, it } from 'vitest';

import { TB08Contract } from '../../src/mod-04/TB-08.contract.js';

describe('TB-08 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB08Contract.id).toBe('TB-08');
  });

  it('is registered to MOD-04', () => {
    expect(TB08Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB08Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB08Contract.promptRef).toEqual({ agent: 'TB-08', version: '1.0.0' });
  });

  it('does not require approval — remediation packs go to teacher review before delivery', () => {
    expect(TB08Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — remediation packs are tenant outputs, not versioned facts', () => {
    expect(TB08Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB08Contract.model).toBe('plan.author');
  });

  it('references the TB-08 eval set', () => {
    expect(TB08Contract.evalSetRef).toBe('TB-08');
  });

  it('declares pii_guard — remediation content must never contain learner PII', () => {
    expect(TB08Contract.guardrails).toContain('pii_guard');
  });

  it('declares source_grounding_guard — content must be grounded in supplied documents', () => {
    expect(TB08Contract.guardrails).toContain('source_grounding_guard');
  });

  it('declares no tools — TB-08 is a pure language agent with no external calls', () => {
    expect(TB08Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB08Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB08Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
