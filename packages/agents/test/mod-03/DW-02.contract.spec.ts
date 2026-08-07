import { describe, expect, it } from 'vitest';

import { DW02Contract } from '../../src/mod-03/DW-02.contract.js';

describe('DW-02 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW02Contract.id).toBe('DW-02');
  });

  it('is registered to MOD-03', () => {
    expect(DW02Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW02Contract.purpose).toBe('intervention');
  });

  it('references the 1.0.0 prompt', () => {
    expect(DW02Contract.promptRef).toEqual({ agent: 'DW-02', version: '1.0.0' });
  });

  it('requires approval — new source shapes must be human-confirmed', () => {
    expect(DW02Contract.requiresApproval).toBe(true);
  });

  it('does not write to the Brain', () => {
    expect(DW02Contract.writesToBrain).toBe(false);
  });

  it('declares the data.map logical model', () => {
    expect(DW02Contract.model).toBe('data.map');
  });

  it('references the DW-02 eval set', () => {
    expect(DW02Contract.evalSetRef).toBe('DW-02');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW02Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every mapping must cite a confirmed mapping', () => {
    expect(DW02Contract.guardrails).toContain('grounding_check');
  });
});
