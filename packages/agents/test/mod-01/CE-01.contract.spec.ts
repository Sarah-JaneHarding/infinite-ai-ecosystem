// CE-01 contract validation — Stage 08 step 2.
//
// The contract is validated at module-load time (validateAgentContract throws on
// any structural error). If the import succeeds, every required field was present
// and valid. These tests then probe the contract's own declared values to ensure
// they match what CE-01 is actually supposed to do.

import { describe, expect, it } from 'vitest';

import { CE01Contract } from '../../src/mod-01/CE-01.contract.js';

describe('CE-01 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE01Contract.id).toBe('CE-01');
  });

  it('is registered to MOD-01', () => {
    expect(CE01Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — CE-01 is curriculum structure, not learner analytics', () => {
    expect(CE01Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE01Contract.promptRef).toEqual({ agent: 'CE-01', version: '1.0.0' });
  });

  it('does not require approval — output goes to L0 as a ratification candidate', () => {
    expect(CE01Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — the framework must be versioned in L0', () => {
    expect(CE01Contract.writesToBrain).toBe(true);
  });

  it('declares the planning-appropriate logical model', () => {
    expect(CE01Contract.model).toBe('curriculum.map');
  });

  it('references the CE-01 eval set', () => {
    expect(CE01Contract.evalSetRef).toBe('CE-01');
  });

  it('declares pii_guard in its guardrails — CE-01 output must never contain learner PII', () => {
    expect(CE01Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every claim must cite a CAPS source', () => {
    expect(CE01Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a retrieval-heavy analysis task', () => {
    expect(CE01Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE01Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
