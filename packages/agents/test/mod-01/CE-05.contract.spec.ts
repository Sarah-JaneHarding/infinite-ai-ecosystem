// CE-05 contract validation — Stage 08 step 3.
//
// CE-05 Lesson Plan Generator fills a school's approved template from the unit blueprint.
// Because lesson plans go directly into teacher hands and may reach learners, this agent
// requires explicit HoD approval before its output is published — requiresApproval: true.

import { describe, expect, it } from 'vitest';

import { CE05Contract } from '../../src/mod-01/CE-05.contract.js';

describe('CE-05 contract', () => {
  it('declares the correct agent id', () => {
    expect(CE05Contract.id).toBe('CE-05');
  });

  it('is registered to MOD-01', () => {
    expect(CE05Contract.module).toBe('MOD-01');
  });

  it('uses the planning purpose', () => {
    expect(CE05Contract.purpose).toBe('planning');
  });

  it('references the 1.0.0 prompt', () => {
    expect(CE05Contract.promptRef).toEqual({ agent: 'CE-05', version: '1.0.0' });
  });

  it('requires approval — lesson plans reach teachers and learners; HoD must sign off', () => {
    expect(CE05Contract.requiresApproval).toBe(true);
  });

  it('writes to the Brain — lesson plans are versioned artefacts', () => {
    expect(CE05Contract.writesToBrain).toBe(true);
  });

  it('declares the lesson-generation logical model', () => {
    expect(CE05Contract.model).toBe('curriculum.lessons');
  });

  it('references the CE-05 eval set', () => {
    expect(CE05Contract.evalSetRef).toBe('CE-05');
  });

  it('declares pii_guard — a lesson plan must never contain learner PII', () => {
    expect(CE05Contract.guardrails).toContain('pii_guard');
  });

  it('declares grounding_check — every activity must trace to a CAPS objective', () => {
    expect(CE05Contract.guardrails).toContain('grounding_check');
  });

  it('declares template_fidelity — output must conform to the school-supplied template', () => {
    expect(CE05Contract.guardrails).toContain('template_fidelity');
  });

  it('has a larger budget than CE-03 — lesson generation is more token-intensive than term planning', () => {
    expect(CE05Contract.budget.maxTokens).toBeGreaterThan(8000);
  });
});
