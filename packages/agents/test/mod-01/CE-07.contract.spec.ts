// CE-07 contract validation — Stage 08 step 3.
//
// CE-07 Rubric Builder takes the assessment task design CE-06 produced and generates
// a four-level rubric with a marking memo. The rubric is a marking tool, not a
// publication — it goes to the marking team after the task is approved, so it does
// not require a separate HoD approval step (the task itself was already approved).

import { describe, expect, it } from 'vitest';

import { CE07Contract } from '../../src/mod-01/CE-07.contract.js';

describe('CE-07 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE07Contract.id).toBe('CE-07');
  });

  it('is registered to MOD-01', () => {
    expect(CE07Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — rubric building is a curriculum support activity', () => {
    expect(CE07Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE07Contract.promptRef).toEqual({ agent: 'CE-07', version: '1.0.0' });
  });

  it('does not require approval — the upstream task was approved; the rubric supports marking', () => {
    expect(CE07Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — rubrics are versioned marking artefacts', () => {
    expect(CE07Contract.writesToBrain).toBe(true);
  });

  it('declares the rubric-building logical model', () => {
    expect(CE07Contract.model).toBe('curriculum.rubric');
  });

  it('references the CE-07 eval set', () => {
    expect(CE07Contract.evalSetRef).toBe('CE-07');
  });

  it('declares pii_guard — a rubric must never contain learner PII', () => {
    expect(CE07Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every descriptor must trace to CAPS or the assessment policy', () => {
    expect(CE07Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a rubric-building task', () => {
    expect(CE07Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE07Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
