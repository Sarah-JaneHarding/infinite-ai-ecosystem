// The consent ledger's shape. What the schema refuses is the interesting part.

import { describe, expect, it } from 'vitest';

import {
  ConsentEntry,
  ConsentEntryDraft,
  LawfulBasis,
  WITHDRAWABLE_BASES,
  isWithdrawable,
} from '../src/popia/consent.js';

const VALID = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  subjectToken: 'LNR_7F3A2C0B91DE',
  category: 'ACADEMIC_PERFORMANCE',
  purpose: 'screening',
  basis: 'CONSENT',
  decision: 'GRANTED',
  source: 'PAPER_FORM',
  evidenceRef: 'admission-form-2026/0431',
  effectiveFrom: '2026-01-15T08:00:00.000Z',
  recordedAt: '2026-01-18T10:00:00.000Z',
  recordedBy: '33333333-3333-4333-8333-333333333333',
  note: null,
};

describe('the six lawful bases', () => {
  it('are all six of them', () => {
    // POPIA §11(1)(a)-(f). A missing basis means processing that is lawful in the Act
    // becomes unrecordable here, and unrecordable processing gets recorded as something
    // else — usually as consent, which is the one basis a subject can revoke.
    expect(LawfulBasis.options).toHaveLength(6);
  });

  it('makes exactly two of them the subject`s to end', () => {
    expect([...WITHDRAWABLE_BASES].sort()).toEqual(['CONSENT', 'LEGITIMATE_INTEREST']);
  });

  it('does not let a subject end a statutory basis', () => {
    // A school cannot stop keeping an admission register because a guardian asked it to.
    for (const basis of ['CONTRACT', 'LEGAL_OBLIGATION', 'PUBLIC_LAW_DUTY'] as const) {
      expect(isWithdrawable(basis)).toBe(false);
    }
  });
});

describe('what the schema accepts', () => {
  it('accepts a well-formed consent grant', () => {
    expect(ConsentEntry.safeParse(VALID).success).toBe(true);
  });

  it('coerces the timestamps, since they arrive from JSON as strings', () => {
    const parsed = ConsentEntry.parse(VALID);
    expect(parsed.effectiveFrom).toBeInstanceOf(Date);
    expect(parsed.recordedAt).toBeInstanceOf(Date);
  });

  it('accepts a withdrawal with no evidence reference', () => {
    // Withdrawal is a right, not a favour. Requiring paperwork to exercise it would be a
    // way of discouraging it.
    const result = ConsentEntry.safeParse({
      ...VALID,
      decision: 'WITHDRAWN',
      evidenceRef: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a statutory grant with no evidence reference', () => {
    const result = ConsentEntry.safeParse({
      ...VALID,
      basis: 'PUBLIC_LAW_DUTY',
      source: 'NOT_APPLICABLE',
      evidenceRef: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('what the schema refuses', () => {
  it('refuses a consent grant with no evidence', () => {
    // "We have consent" is worth nothing without being able to say where it came from.
    const result = ConsentEntry.safeParse({ ...VALID, evidenceRef: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['evidenceRef']);
  });

  it('refuses a consent grant that claims consent was not applicable', () => {
    const result = ConsentEntry.safeParse({ ...VALID, source: 'NOT_APPLICABLE' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['source']);
  });

  it('refuses an entry effective after it was recorded', () => {
    // A ledger nothing can amend must not hold an entry that switches itself on later.
    const result = ConsentEntry.safeParse({
      ...VALID,
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      recordedAt: '2026-01-18T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['effectiveFrom']);
  });

  it('accepts backdating, because that is what a late capture is', () => {
    // Signed on Monday, typed in on Thursday. The gap is visible rather than lost, and it
    // is the gap an auditor examines — so the schema records it instead of forbidding it.
    const result = ConsentEntry.safeParse({
      ...VALID,
      effectiveFrom: '2026-01-15T08:00:00.000Z',
      recordedAt: '2026-04-18T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('refuses an unknown category', () => {
    expect(
      ConsentEntry.safeParse({ ...VALID, category: 'FAVOURITE_COLOUR' }).success,
    ).toBe(false);
  });

  it('refuses an unknown purpose', () => {
    expect(ConsentEntry.safeParse({ ...VALID, purpose: 'marketing' }).success).toBe(
      false,
    );
  });

  it('refuses an empty subject token', () => {
    expect(ConsentEntry.safeParse({ ...VALID, subjectToken: '' }).success).toBe(false);
  });

  it('caps the free-text note', () => {
    const result = ConsentEntry.safeParse({ ...VALID, note: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe('the draft a caller supplies', () => {
  it('omits the fields the store owns', () => {
    const { id: _id, tenantId: _tenantId, recordedAt: _recordedAt, ...draft } = VALID;
    expect(ConsentEntryDraft.safeParse(draft).success).toBe(true);
  });

  it('still refuses a consent grant with no evidence', () => {
    // The omit must not drop the refinements with the fields — that would make the draft
    // a way round every check the full entry applies.
    const { id: _id, tenantId: _tenantId, recordedAt: _recordedAt, ...draft } = VALID;
    expect(ConsentEntryDraft.safeParse({ ...draft, evidenceRef: null }).success).toBe(
      false,
    );
  });
});
