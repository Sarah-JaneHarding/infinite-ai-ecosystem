// AC-11 contract validation — Stage 10 step 6.

import { describe, expect, it } from 'vitest';

import { AC11Contract } from '../../src/mod-02/AC-11.contract.js';

describe('AC-11 contract', () => {
  it('declares the correct agent id', () => {
    expect(AC11Contract.id).toBe('AC-11');
  });

  it('is registered to MOD-02', () => {
    expect(AC11Contract.module).toBe('MOD-02');
  });

  it('uses the reporting_district purpose', () => {
    expect(AC11Contract.purpose).toBe('reporting_district');
  });

  it('references the 1.1.0 prompt — the version where the staleness threshold is a school-set input', () => {
    expect(AC11Contract.promptRef).toEqual({ agent: 'AC-11', version: '1.1.0' });
  });

  it('does not require approval — it screens a snapshot and releases nothing to a person', () => {
    expect(AC11Contract.requiresApproval).toBe(false);
  });

  it('does not write to the Brain — a screen result is a gate decision, not a versioned fact', () => {
    expect(AC11Contract.writesToBrain).toBe(false);
  });

  it('declares the analytics.screen logical model', () => {
    expect(AC11Contract.model).toBe('analytics.screen');
  });

  it('references the AC-11 eval set', () => {
    expect(AC11Contract.evalSetRef).toBe('AC-11');
  });

  it('declares pii_guard', () => {
    expect(AC11Contract.guardrails).toContain('pii_guard');
  });

  it('declares no free-text output fields — every output field is a code or an id', () => {
    expect(AC11Contract.freeTextOutputFields ?? []).toHaveLength(0);
  });

  it('has a positive budget', () => {
    expect(AC11Contract.budget.maxTokens).toBeGreaterThan(0);
    expect(AC11Contract.budget.maxCostUsd).toBeGreaterThan(0);
  });

  it('declares no tools', () => {
    expect(AC11Contract.tools).toHaveLength(0);
  });
});
