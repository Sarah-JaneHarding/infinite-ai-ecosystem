// CE-09 contract validation — Stage 08 step 5.
//
// CE-09 Coverage Auditor compares the ratified term plan against L2 episode records
// and assessment records, emitting a drift report. It has no learner-data access —
// coverageRatePct and driftItems are curriculum diagnostics, not personal records.
// It runs after the HoD-approved publish step so the ratified plan already exists.

import { describe, expect, it } from 'vitest';

import { CE09Contract } from '../../src/mod-01/CE-09.contract.js';

describe('CE-09 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE09Contract.id).toBe('CE-09');
  });

  it('is registered to MOD-01', () => {
    expect(CE09Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose — coverage auditing is a curriculum-design activity', () => {
    expect(CE09Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE09Contract.promptRef).toEqual({ agent: 'CE-09', version: '1.0.0' });
  });

  it('does not require approval — audit output is diagnostic, not a gated artefact', () => {
    expect(CE09Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — coverage audit records are versioned curriculum diagnostics', () => {
    expect(CE09Contract.writesToBrain).toBe(true);
  });

  it('declares the curriculum.audit logical model', () => {
    expect(CE09Contract.model).toBe('curriculum.audit');
  });

  it('references the CE-09 eval set', () => {
    expect(CE09Contract.evalSetRef).toBe('CE-09');
  });

  it('declares pii_guard — audit reports must never include learner names or ids', () => {
    expect(CE09Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every drift item must trace to the term plan or episode log', () => {
    expect(CE09Contract.guardrails).toContain('grounding_check');
  });

  it('has a budget within reasonable limits for a coverage audit task', () => {
    expect(CE09Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(CE09Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
