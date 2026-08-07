import { describe, expect, it } from 'vitest';

import { DW01Contract } from '../../src/mod-03/DW-01.contract.js';

describe('DW-01 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW01Contract.id).toBe('DW-01');
  });

  it('is registered to MOD-03', () => {
    expect(DW01Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW01Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(DW01Contract.promptRef).toEqual({ agent: 'DW-01', version: '1.0.0' });
  });

  it('does not require approval — ingestion is automated', () => {
    expect(DW01Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — raw records are not brain entries', () => {
    expect(DW01Contract.writesToBrain).toBe(false);
  });

  it('declares the data.ingest logical model', () => {
    expect(DW01Contract.model).toBe('data.ingest');
  });

  it('references the DW-01 eval set', () => {
    expect(DW01Contract.evalSetRef).toBe('DW-01');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW01Contract.guardrails).toContain('pii_guard');
  });

  it('has a budget within reasonable limits for a connector pull', () => {
    expect(DW01Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(DW01Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });
});
