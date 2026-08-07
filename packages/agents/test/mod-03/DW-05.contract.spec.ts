import { describe, expect, it } from 'vitest';

import { DW05Contract } from '../../src/mod-03/DW-05.contract.js';

describe('DW-05 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW05Contract.id).toBe('DW-05');
  });

  it('is registered to MOD-03', () => {
    expect(DW05Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW05Contract.purpose).toBe('intervention');
  });

  it('does not require approval — quality checks are automated', () => {
    expect(DW05Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain', () => {
    expect(DW05Contract.writesToBrain).toBe(false);
  });

  it('declares the data.quality logical model', () => {
    expect(DW05Contract.model).toBe('data.quality');
  });

  it('references the DW-05 eval set', () => {
    expect(DW05Contract.evalSetRef).toBe('DW-05');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW05Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check in its guardrails', () => {
    expect(DW05Contract.guardrails).toContain('grounding_check');
  });
});
