import { describe, expect, it } from 'vitest';

import { TB02Contract } from '../../src/mod-04/TB-02.contract.js';

describe('TB-02 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB02Contract.id).toBe('TB-02');
  });

  it('is registered to MOD-04', () => {
    expect(TB02Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB02Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB02Contract.promptRef).toEqual({ agent: 'TB-02', version: '1.0.0' });
  });

  it('does not require approval — presentation decks go to teacher review before delivery', () => {
    expect(TB02Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — decks are tenant outputs, not versioned facts', () => {
    expect(TB02Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB02Contract.model).toBe('plan.author');
  });

  it('references the TB-02 eval set', () => {
    expect(TB02Contract.evalSetRef).toBe('TB-02');
  });

  it('declares pii_guard — deck content must never contain learner PII', () => {
    expect(TB02Contract.guardrails).toContain('pii_guard');
  });

  it('declares source_grounding_guard — content must be grounded in supplied documents', () => {
    expect(TB02Contract.guardrails).toContain('source_grounding_guard');
  });

  it('declares no tools — TB-02 is a pure language agent with no external calls', () => {
    expect(TB02Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB02Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB02Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
