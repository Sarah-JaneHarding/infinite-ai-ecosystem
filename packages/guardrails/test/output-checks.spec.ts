// The output side of the guardrail engine — Stage 06 step 6.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  checkAgeAppropriateness,
  checkCost,
  checkGrounding,
  checkOutputSchema,
  checkReadability,
  checkRefusalPolicy,
  checkTemplateFidelity,
} from '../src/output-checks.js';
import { refuse } from '../src/refusal.js';

describe('checkOutputSchema', () => {
  const schema = z.object({ summary: z.string().min(1) });

  it('passes a valid output', () => {
    expect(checkOutputSchema(schema, { summary: 'ok' }).passed).toBe(true);
  });

  it('refuses an invalid output with invalid_output_schema', () => {
    const verdict = checkOutputSchema(schema, { summary: '' });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('invalid_output_schema');
  });
});

describe('checkGrounding', () => {
  const validIds = new Set(['fact-1', 'fact-2', 'caps-§2.3']);

  it('passes when every citation resolves', () => {
    expect(checkGrounding(['fact-1', 'caps-§2.3'], validIds).passed).toBe(true);
  });

  it('passes when there are no citations at all', () => {
    expect(checkGrounding([], validIds).passed).toBe(true);
  });

  it('refuses with ungrounded_claim on a dangling citation', () => {
    const verdict = checkGrounding(['fact-1', 'fact-does-not-exist'], validIds);
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.refusal.code).toBe('ungrounded_claim');
      expect(verdict.refusal.explanation).toContain('fact-does-not-exist');
    }
  });
});

describe('checkTemplateFidelity', () => {
  it('passes when no checker is supplied — no ratified template exists yet (OQ-003)', () => {
    expect(checkTemplateFidelity({ anything: true }).passed).toBe(true);
  });

  it('defers entirely to an injected checker when one is supplied', () => {
    const alwaysRefuses = () => refuse('template_infidelity', 'missing required section');
    const verdict = checkTemplateFidelity({}, alwaysRefuses);
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('template_infidelity');
  });
});

describe('checkReadability', () => {
  it('passes text within the target grade range', () => {
    // Flesch-Kincaid legitimately scores a very short, simple sentence below zero — the
    // formula's own real behaviour, not a defect — so the range allows for that.
    const verdict = checkReadability('The cat sat on the mat.', {
      minGrade: -5,
      maxGrade: 6,
    });
    expect(verdict.passed).toBe(true);
  });

  it('refuses with readability_out_of_range when the text is too advanced', () => {
    const advanced =
      'The extraordinarily sophisticated methodology employed by the ' +
      'interdisciplinary research consortium necessitated a comprehensive ' +
      'reevaluation of previously established administrative frameworks.';
    const verdict = checkReadability(advanced, { minGrade: 0, maxGrade: 4 });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('readability_out_of_range');
  });
});

describe('checkAgeAppropriateness', () => {
  it('passes when no checker is supplied — no content policy exists yet (OQ-015)', async () => {
    expect((await checkAgeAppropriateness({ anything: true })).passed).toBe(true);
  });

  it('defers entirely to an injected checker when one is supplied', async () => {
    const alwaysRefuses = () =>
      refuse('age_inappropriate', 'not suitable for this grade');
    const verdict = await checkAgeAppropriateness({}, alwaysRefuses);
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('age_inappropriate');
  });

  it('awaits an injected async checker', async () => {
    const asyncRefuses = async () => refuse('age_inappropriate', 'async refusal');
    const verdict = await checkAgeAppropriateness({}, asyncRefuses);
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('age_inappropriate');
  });
});

describe('checkRefusalPolicy', () => {
  it('passes when the call is not itself a refusal', () => {
    expect(checkRefusalPolicy(null).passed).toBe(true);
  });

  it('passes a well-formed claimed refusal', () => {
    const verdict = checkRefusalPolicy({
      code: 'purpose_not_permitted',
      explanation: 'This purpose does not cover that category.',
      escalation: null,
    });
    expect(verdict.passed).toBe(true);
  });

  it('accepts a well-formed refusal carrying a real escalation route', () => {
    const verdict = checkRefusalPolicy({
      code: 'purpose_not_permitted',
      explanation: 'Needs a human.',
      escalation: { category: 'unspecified_concern', notifyRole: 'sbst' },
    });
    expect(verdict.passed).toBe(true);
  });

  it('refuses with invalid_refusal when the claimed refusal is malformed', () => {
    const verdict = checkRefusalPolicy({ code: 'not_a_real_code', explanation: '' });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('invalid_refusal');
  });
});

describe('checkCost', () => {
  it('passes when actual cost is within budget', () => {
    expect(checkCost(0.05, { maxCostUsd: 0.1 }).passed).toBe(true);
  });

  it('refuses with cost_budget_exceeded when actual cost exceeds budget', () => {
    const verdict = checkCost(0.2, { maxCostUsd: 0.1 });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('cost_budget_exceeded');
  });
});
