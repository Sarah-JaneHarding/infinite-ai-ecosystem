import { describe, expect, it } from 'vitest';

import { DW04Contract } from '../../src/mod-03/DW-04.contract.js';

describe('DW-04 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW04Contract.id).toBe('DW-04');
  });

  it('is registered to MOD-03', () => {
    expect(DW04Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW04Contract.purpose).toBe('intervention');
  });

  it('does not require approval — tokenisation is automated', () => {
    expect(DW04Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain', () => {
    expect(DW04Contract.writesToBrain).toBe(false);
  });

  it('declares the data.deident logical model', () => {
    expect(DW04Contract.model).toBe('data.deident');
  });

  it('references the DW-04 eval set', () => {
    expect(DW04Contract.evalSetRef).toBe('DW-04');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW04Contract.guardrails).toContain('pii_guard');
  });
});
