// AC-02 contract validation — Stage 10 step 2.
//
// The contract is validated at module-load time (validateAgentContract throws on
// any structural error). If the import succeeds, every required field was present
// and valid. These tests then probe the contract's own declared values to ensure
// they match what AC-02 is actually supposed to do.
//
// Critical invariant: AC-02 gates AC-03. If core health fails for a class, tier
// recommendations for that class are suppressed. This test suite confirms the
// contract is correctly wired before AC-03 is built.

import { describe, expect, it } from 'vitest';

import { AC02Contract } from '../../src/mod-02/AC-02.contract.js';

describe('AC-02 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC02Contract.id).toBe('AC-02');
  });

  it('is registered to MOD-02', () => {
    expect(AC02Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose — AC-02 determines class-level support readiness', () => {
    expect(AC02Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC02Contract.promptRef).toEqual({ agent: 'AC-02', version: '1.0.0' });
  });

  it('does not require approval — core-health assessment is an automated gate', () => {
    expect(AC02Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — AC-02 produces a gate signal, not a versioned fact', () => {
    expect(AC02Contract.writesToBrain).toBe(false);
  });

  it('declares the support.health logical model', () => {
    expect(AC02Contract.model).toBe('support.health');
  });

  it('references the AC-02 eval set', () => {
    expect(AC02Contract.evalSetRef).toBe('AC-02');
  });

  it('declares pii_guard — class aggregates must not expose individual learner identities', () => {
    expect(AC02Contract.guardrails).toContain('pii_guard');
  });

  it('has a budget within reasonable limits for a class-level aggregation task', () => {
    expect(AC02Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC02Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools — AC-02 is a pure computation over supplied screen results', () => {
    expect(AC02Contract.tools).toHaveLength(0);
  });

  it('has a lower token budget than AC-01 — aggregation is simpler than screening', () => {
    expect(AC02Contract.budget.maxTokens).toBeLessThan(1500);
  });
});
