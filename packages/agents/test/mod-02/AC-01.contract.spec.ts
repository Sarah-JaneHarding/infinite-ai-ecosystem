// AC-01 contract validation — Stage 10 step 2.
//
// The contract is validated at module-load time (validateAgentContract throws on
// any structural error). If the import succeeds, every required field was present
// and valid. These tests then probe the contract's own declared values to ensure
// they match what AC-01 is actually supposed to do.

import { describe, expect, it } from 'vitest';

import { AC01Contract } from '../../src/mod-02/AC-01.contract.js';

describe('AC-01 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC01Contract.id).toBe('AC-01');
  });

  it('is registered to MOD-02', () => {
    expect(AC01Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose — AC-01 is learner support screening, not curriculum planning', () => {
    expect(AC01Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC01Contract.promptRef).toEqual({ agent: 'AC-01', version: '1.0.0' });
  });

  it('does not require approval — screen output feeds the automated AC-02 gate', () => {
    expect(AC01Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — screen results are versioned support facts', () => {
    expect(AC01Contract.writesToBrain).toBe(true);
  });

  it('declares the support.screen logical model', () => {
    expect(AC01Contract.model).toBe('support.screen');
  });

  it('references the AC-01 eval set', () => {
    expect(AC01Contract.evalSetRef).toBe('AC-01');
  });

  it('declares pii_guard in its guardrails — learner data must never appear in output', () => {
    expect(AC01Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard — no clinical or disability language may appear', () => {
    expect(AC01Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a budget within reasonable limits for a five-domain screening task', () => {
    expect(AC01Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC01Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools — AC-01 is a pure reasoning agent over supplied domain readings', () => {
    expect(AC01Contract.tools).toHaveLength(0);
  });
});
