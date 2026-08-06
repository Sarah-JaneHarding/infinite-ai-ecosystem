// The input side of the guardrail engine — Stage 06 step 6.

import type { ConsentEntry, DataCategory } from '@infinite-ai/contracts';
import type { AccessRequest } from '@infinite-ai/policy';
import type { TenantLexicon } from '@infinite-ai/deident';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  checkInputSchema,
  checkPii,
  checkPurposeAndConsent,
  checkTokenBudget,
} from '../src/input-checks.js';
import type { EgressPayload } from '../src/pii-guard.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LEARNER = 'LNR_7F3A2C0B91DE';
const AT = new Date('2026-06-01T00:00:00.000Z');
const EARLIER = new Date('2026-01-15T08:00:00.000Z');

describe('checkInputSchema', () => {
  const schema = z.object({ learnerId: z.string().min(1) });

  it('passes a valid input', () => {
    expect(checkInputSchema(schema, { learnerId: 'L1' }).passed).toBe(true);
  });

  it('refuses an invalid input with invalid_input_schema', () => {
    const verdict = checkInputSchema(schema, { learnerId: '' });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('invalid_input_schema');
  });
});

let grantCounter = 0;
function grant(category: DataCategory, purpose: ConsentEntry['purpose']): ConsentEntry {
  grantCounter += 1;
  return {
    id: `bbbbbbbb-0000-4000-8000-${String(grantCounter).padStart(12, '0')}`,
    tenantId: TENANT,
    subjectToken: LEARNER,
    category,
    purpose,
    basis: 'PUBLIC_LAW_DUTY',
    decision: 'GRANTED',
    source: 'NOT_APPLICABLE',
    evidenceRef: null,
    effectiveFrom: EARLIER,
    recordedAt: EARLIER,
    recordedBy: null,
    note: null,
  };
}

function accessRequest(over: Partial<AccessRequest> = {}): AccessRequest {
  return {
    purpose: 'screening',
    subjectToken: LEARNER,
    requested: ['ATTENDANCE'],
    ledger: [grant('ATTENDANCE', 'screening')],
    tombstonedAt: null,
    at: AT,
    ...over,
  };
}

describe('checkPurposeAndConsent', () => {
  it('passes when every required category is allowed', () => {
    const verdict = checkPurposeAndConsent(accessRequest(), ['ATTENDANCE']);
    expect(verdict.passed).toBe(true);
  });

  it('refuses with subject_tombstoned when the subject is tombstoned', () => {
    const verdict = checkPurposeAndConsent(
      accessRequest({ tombstonedAt: new Date('2026-05-01T00:00:00.000Z') }),
      ['ATTENDANCE'],
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('subject_tombstoned');
  });

  it('refuses with purpose_not_permitted when the purpose does not cover the category', () => {
    const verdict = checkPurposeAndConsent(
      accessRequest({
        purpose: 'product_improvement',
        requested: ['SPECIAL_PERSONAL'],
        ledger: [],
      }),
      ['SPECIAL_PERSONAL'],
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('purpose_not_permitted');
  });

  it('refuses with no_lawful_basis when there is no consent record at all', () => {
    const verdict = checkPurposeAndConsent(
      accessRequest({ requested: ['ACADEMIC_PERFORMANCE'], ledger: [] }),
      ['ACADEMIC_PERFORMANCE'],
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('no_lawful_basis');
  });

  it('only checks categories this call actually requires, not everything requested', () => {
    // Requested includes a category with no consent, but requiredCategories only names
    // the one that is actually covered — the call should still pass.
    const verdict = checkPurposeAndConsent(
      accessRequest({
        requested: ['ATTENDANCE', 'ACADEMIC_PERFORMANCE'],
        ledger: [grant('ATTENDANCE', 'screening')],
      }),
      ['ATTENDANCE'],
    );
    expect(verdict.passed).toBe(true);
  });
});

describe('checkPii', () => {
  const lexicon: TenantLexicon = { personNames: [], schoolNames: [] };

  it('passes a properly de-identified payload', () => {
    const payload: EgressPayload = {
      tenantId: TENANT,
      texts: ['Plan a lesson on fractions for Grade 6.'],
      provenance: { deidentified: true, saltVersion: 1, dropped: [] },
    };
    expect(checkPii(payload, lexicon).passed).toBe(true);
  });

  it('refuses with missing_provenance when there is no provenance stamp', () => {
    const payload: EgressPayload = {
      tenantId: TENANT,
      texts: ['Plan a lesson on fractions for Grade 6.'],
    };
    const verdict = checkPii(payload, lexicon);
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('missing_provenance');
  });
});

describe('checkTokenBudget', () => {
  it('passes when the estimate is within budget', () => {
    const verdict = checkTokenBudget(['a short prompt'], { maxTokens: 100 });
    expect(verdict.passed).toBe(true);
  });

  it('refuses with token_budget_exceeded when the estimate exceeds the budget', () => {
    const longText = 'x'.repeat(1000);
    const verdict = checkTokenBudget([longText], { maxTokens: 10 });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('token_budget_exceeded');
  });

  it('sums the estimate across every text', () => {
    const verdict = checkTokenBudget(['x'.repeat(20), 'x'.repeat(20)], { maxTokens: 8 });
    expect(verdict.passed).toBe(false);
  });
});
