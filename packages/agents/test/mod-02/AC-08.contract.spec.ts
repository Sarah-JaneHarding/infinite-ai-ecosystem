// AC-08 contract validation — Stage 10 step 4.

import { describe, expect, it } from 'vitest';

import { AC08Contract } from '../../src/mod-02/AC-08.contract.js';

describe('AC-08 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC08Contract.id).toBe('AC-08');
  });

  it('is registered to MOD-02', () => {
    expect(AC08Contract.module).toBe('MOD-02');
  });

  it('uses the intervention purpose', () => {
    expect(AC08Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(AC08Contract.promptRef).toEqual({ agent: 'AC-08', version: '1.0.0' });
  });

  it('requires approval — chair must confirm minutes before they enter the record', () => {
    expect(AC08Contract.requiresApproval).toBe(true);
  });

  it('writes to the Brain — ratified minutes are versioned facts', () => {
    expect(AC08Contract.writesToBrain).toBe(true);
  });

  it('declares the support.screen logical model', () => {
    expect(AC08Contract.model).toBe('support.screen');
  });

  it('references the AC-08 eval set', () => {
    expect(AC08Contract.evalSetRef).toBe('AC-08');
  });

  it('declares pii_guard', () => {
    expect(AC08Contract.guardrails).toContain('pii_guard');
  });

  it('declares diagnosis_guard — meeting minutes must not contain diagnostic language', () => {
    expect(AC08Contract.guardrails).toContain('diagnosis_guard');
  });

  it('has a positive budget', () => {
    expect(AC08Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC08Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC08Contract.tools).toHaveLength(0);
  });
});
