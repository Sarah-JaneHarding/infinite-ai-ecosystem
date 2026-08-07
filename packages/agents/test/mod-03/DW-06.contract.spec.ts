import { describe, expect, it } from 'vitest';

import { DW06Contract } from '../../src/mod-03/DW-06.contract.js';

describe('DW-06 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW06Contract.id).toBe('DW-06');
  });

  it('is registered to MOD-03', () => {
    expect(DW06Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW06Contract.purpose).toBe('intervention');
  });

  it('does not require approval — deterministic materialisation', () => {
    expect(DW06Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — the 360 profile is a brain entry', () => {
    expect(DW06Contract.writesToBrain).toBe(true);
  });

  it('declares the data.materialise logical model', () => {
    expect(DW06Contract.model).toBe('data.materialise');
  });

  it('references the DW-06 eval set', () => {
    expect(DW06Contract.evalSetRef).toBe('DW-06');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW06Contract.guardrails).toContain('pii_guard');
  });
});
