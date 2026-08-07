// CE-06 contract validation — Stage 08 step 3.
//
// CE-06 Assessment Designer produces a formal assessment task with mark allocations
// and cognitive-level spreads drawn entirely from the school's assessment policy.
// Formal assessment tasks are consequential for learners — requiresApproval: true.

import { describe, expect, it } from 'vitest';

import { CE06Contract } from '../../src/mod-01/CE-06.contract.js';

describe('CE-06 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE06Contract.id).toBe('CE-06');
  });

  it('is registered to MOD-01', () => {
    expect(CE06Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — assessment design is a curriculum-planning activity', () => {
    expect(CE06Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE06Contract.promptRef).toEqual({ agent: 'CE-06', version: '1.0.0' });
  });

  it('requires approval — assessment tasks directly affect learner records', () => {
    expect(CE06Contract.requiresApproval).toBe(true);
  });

  it('writes to the Brain — assessment task designs are versioned artefacts', () => {
    expect(CE06Contract.writesToBrain).toBe(true);
  });

  it('declares the assessment logical model', () => {
    expect(CE06Contract.model).toBe('curriculum.assess');
  });

  it('references the CE-06 eval set', () => {
    expect(CE06Contract.evalSetRef).toBe('CE-06');
  });

  it('declares pii_guard — assessment task designs must never contain learner PII', () => {
    expect(CE06Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — mark allocations must cite the assessment policy', () => {
    expect(CE06Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for an assessment-design task', () => {
    expect(CE06Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE06Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
