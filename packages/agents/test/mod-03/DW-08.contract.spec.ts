import { describe, expect, it } from 'vitest';

import { DW08Contract } from '../../src/mod-03/DW-08.contract.js';

describe('DW-08 contract', () => {
  it('declares the correct agent id', () => {
    expect(DW08Contract.id).toBe('DW-08');
  });

  it('is registered to MOD-03', () => {
    expect(DW08Contract.module).toBe('MOD-03');
  });

  it('uses the intervention purpose', () => {
    expect(DW08Contract.purpose).toBe('intervention');
  });

  it('requires approval — a next step has a named human owner and action', () => {
    expect(DW08Contract.requiresApproval).toBe(true);
  });

  it('writes to the Brain — the next step is a brain entry', () => {
    expect(DW08Contract.writesToBrain).toBe(true);
  });

  it('declares the data.nextstep logical model', () => {
    expect(DW08Contract.model).toBe('data.nextstep');
  });

  it('references the DW-08 eval set', () => {
    expect(DW08Contract.evalSetRef).toBe('DW-08');
  });

  it('declares pii_guard in its guardrails', () => {
    expect(DW08Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — the next step must be grounded in an insight', () => {
    expect(DW08Contract.guardrails).toContain('grounding_check');
  });
});
