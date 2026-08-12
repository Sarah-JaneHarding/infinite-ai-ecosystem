import { describe, expect, it } from 'vitest';

import { TB09Contract } from '../../src/mod-04/TB-09.contract.js';

describe('TB-09 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB09Contract.id).toBe('TB-09');
  });

  it('is registered to MOD-04', () => {
    expect(TB09Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB09Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB09Contract.promptRef).toEqual({ agent: 'TB-09', version: '1.0.0' });
  });

  it('does not require approval — extension packs go to teacher review before delivery', () => {
    expect(TB09Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — extension packs are tenant outputs, not versioned facts', () => {
    expect(TB09Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB09Contract.model).toBe('plan.author');
  });

  it('references the TB-09 eval set', () => {
    expect(TB09Contract.evalSetRef).toBe('TB-09');
  });

  it('declares pii_guard — extension content must never contain learner PII', () => {
    expect(TB09Contract.guardrails).toContain('pii_guard');
  });

  it('declares source_grounding_guard — content must be grounded in supplied documents', () => {
    expect(TB09Contract.guardrails).toContain('source_grounding_guard');
  });

  it('declares no tools — TB-09 is a pure language agent with no external calls', () => {
    expect(TB09Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB09Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB09Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
