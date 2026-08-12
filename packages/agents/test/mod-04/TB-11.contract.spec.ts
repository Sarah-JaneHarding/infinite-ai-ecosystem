// TB-11 contract validation — Stage 11 step 8.

import { describe, expect, it } from 'vitest';

import { TB11Contract } from '../../src/mod-04/TB-11.contract.js';

describe('TB-11 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB11Contract.id).toBe('TB-11');
  });

  it('is registered to MOD-04', () => {
    expect(TB11Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB11Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB11Contract.promptRef).toEqual({ agent: 'TB-11', version: '1.0.0' });
  });

  it('does not require approval — visual briefs go to teacher review before being commissioned', () => {
    expect(TB11Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — visual briefs are tenant outputs, not versioned facts', () => {
    expect(TB11Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB11Contract.model).toBe('plan.author');
  });

  it('references the TB-11 eval set', () => {
    expect(TB11Contract.evalSetRef).toBe('TB-11');
  });

  it('declares pii_guard — visual briefs must never describe an identifiable learner', () => {
    expect(TB11Contract.guardrails).toContain('pii_guard');
  });

  it('declares source_grounding_guard — briefs must cite a source document', () => {
    expect(TB11Contract.guardrails).toContain('source_grounding_guard');
  });

  it('declares no tools — TB-11 is a pure language agent with no external calls', () => {
    expect(TB11Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB11Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB11Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
