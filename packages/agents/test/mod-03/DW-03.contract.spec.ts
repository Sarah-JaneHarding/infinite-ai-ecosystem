import { describe, expect, it } from 'vitest';

import { DW03Contract } from '../../src/mod-03/DW-03.contract.js';

describe('DW-03 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW03Contract.id).toBe('DW-03');
  });

  it('is registered to MOD-03', () => {
    expect(DW03Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW03Contract.purpose).toBe('intervention');
  });

  it('does not require approval — consent checks are automated gate decisions', () => {
    expect(DW03Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain', () => {
    expect(DW03Contract.writesToBrain).toBe(false);
  });

  it('declares the data.consent logical model', () => {
    expect(DW03Contract.model).toBe('data.consent');
  });

  it('references the DW-03 eval set', () => {
    expect(DW03Contract.evalSetRef).toBe('DW-03');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW03Contract.guardrails).toContain('pii_guard');
  });
});
