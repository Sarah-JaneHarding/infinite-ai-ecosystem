import { describe, expect, it } from 'vitest';

import { TB10Contract } from '../../src/mod-04/TB-10.contract.js';

describe('TB-10 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB10Contract.id).toBe('TB-10');
  });

  it('is registered to MOD-04', () => {
    expect(TB10Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB10Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB10Contract.promptRef).toEqual({ agent: 'TB-10', version: '1.0.0' });
  });

  it('does not require approval — activity plans go to teacher review before delivery', () => {
    expect(TB10Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — activity plans are tenant outputs, not versioned facts', () => {
    expect(TB10Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB10Contract.model).toBe('plan.author');
  });

  it('references the TB-10 eval set', () => {
    expect(TB10Contract.evalSetRef).toBe('TB-10');
  });

  it('declares pii_guard — activity content must never contain learner PII', () => {
    expect(TB10Contract.guardrails).toContain('pii_guard');
  });

  it('declares source_grounding_guard — content must be grounded in supplied documents', () => {
    expect(TB10Contract.guardrails).toContain('source_grounding_guard');
  });

  it('declares no tools — TB-10 is a pure language agent with no external calls', () => {
    expect(TB10Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB10Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB10Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
