// TB-07 contract validation — Stage 11 step 4.
//
// The contract is validated at module-load time (validateAgentContract throws on
// any structural error). If the import succeeds, every required field was present
// and valid. These tests then probe the contract's declared values to ensure they
// match what TB-07 is actually supposed to do.

import { describe, expect, it } from 'vitest';

import { TB07Contract } from '../../src/mod-04/TB-07.contract.js';

describe('TB-07 contract', () => {
  it('declares the correct agent id', () => {
    expect(TB07Contract.id).toBe('TB-07');
  });

  it('is registered to MOD-04', () => {
    expect(TB07Contract.module).toBe('MOD-04');
  });

  it('uses the planning purpose', () => {
    expect(TB07Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(TB07Contract.promptRef).toEqual({ agent: 'TB-07', version: '1.0.0' });
  });

  it('does not require approval — adapted content goes to teacher review before delivery', () => {
    expect(TB07Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — adapted artefacts are tenant outputs, not versioned facts', () => {
    expect(TB07Contract.writesToBrain).toBe(false);
  });

  it('declares the plan.author logical model for content authoring', () => {
    expect(TB07Contract.model).toBe('plan.author');
  });

  it('references the TB-07 eval set', () => {
    expect(TB07Contract.evalSetRef).toBe('TB-07');
  });

  it('declares pii_guard — adapted content must never contain learner PII', () => {
    expect(TB07Contract.guardrails).toContain('pii_guard');
  });

  it('declares no tools — TB-07 is a pure language agent with no external calls', () => {
    expect(TB07Contract.tools).toEqual([]);
  });

  it('has a positive token budget', () => {
    expect(TB07Contract.budget.maxTokens).toBeGreaterThan(0);
  });

  it('has a cost budget within the MOD-04 per-call ceiling', () => {
    expect(TB07Contract.budget.maxCostUsd).toBeLessThanOrEqual(0.05);
  });
});
