import { describe, expect, it } from 'vitest';

import { DW07Contract } from '../../src/mod-03/DW-07.contract.js';

describe('DW-07 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW07Contract.id).toBe('DW-07');
  });

  it('is registered to MOD-03', () => {
    expect(DW07Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW07Contract.purpose).toBe('intervention');
  });

  it('does not require approval — insights are advisory, not action-gating', () => {
    expect(DW07Contract.requiresApproval).toBe(false);
  });

  it('writes to the Brain — insights are brain entries', () => {
    expect(DW07Contract.writesToBrain).toBe(true);
  });

  it('declares the data.insight logical model', () => {
    expect(DW07Contract.model).toBe('data.insight');
  });

  it('references the DW-07 eval set', () => {
    expect(DW07Contract.evalSetRef).toBe('DW-07');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW07Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every insight claim must cite a source event', () => {
    expect(DW07Contract.guardrails).toContain('grounding_check');
  });
});
