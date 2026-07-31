// The purpose filter: purpose ∩ consent, dropping rather than failing.

import type { ConsentEntry, DataCategory } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import { auditPayload, isEmpty, resolveAccess } from '../src/access.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LEARNER = 'LNR_7F3A2C0B91DE';
const AT = new Date('2026-06-01T00:00:00.000Z');
const EARLIER = new Date('2026-01-15T08:00:00.000Z');

let counter = 0;
function grant(category: DataCategory, purpose: ConsentEntry['purpose']): ConsentEntry {
  counter += 1;
  return {
    id: `bbbbbbbb-0000-4000-8000-${String(counter).padStart(12, '0')}`,
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

function withdrawal(entry: ConsentEntry): ConsentEntry {
  counter += 1;
  return {
    ...entry,
    id: `cccccccc-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    basis: 'CONSENT',
    decision: 'WITHDRAWN',
    effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
    recordedAt: new Date('2026-03-01T00:00:00.000Z'),
  };
}

describe('the three gates, in order', () => {
  it('drops everything for a tombstoned subject, consent notwithstanding', () => {
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ACADEMIC_PERFORMANCE', 'ATTENDANCE'],
      ledger: [
        grant('ACADEMIC_PERFORMANCE', 'screening'),
        grant('ATTENDANCE', 'screening'),
      ],
      tombstonedAt: new Date('2026-05-01T00:00:00.000Z'),
      at: AT,
    });
    expect(decision.allowed).toEqual([]);
    expect(decision.dropped.map((d) => d.reason)).toEqual([
      'subject_tombstoned',
      'subject_tombstoned',
    ]);
  });

  it('refuses a category outside the purpose even with consent for it', () => {
    // The gate that stops consent being a universal solvent. A guardian cannot consent a
    // school into a use the school has not declared — `screening` does not touch special
    // personal information, and a signed form does not change that.
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['SPECIAL_PERSONAL'],
      ledger: [grant('SPECIAL_PERSONAL', 'screening')],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.allowed).toEqual([]);
    expect(decision.dropped[0]?.reason).toBe('purpose_not_permitted');
  });

  it('refuses a category the purpose allows but nobody consented to', () => {
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ACADEMIC_PERFORMANCE'],
      ledger: [],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.dropped[0]?.reason).toBe('no_lawful_basis');
  });

  it('refuses a category whose consent was withdrawn', () => {
    const consented = grant('ACADEMIC_PERFORMANCE', 'screening');
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ACADEMIC_PERFORMANCE'],
      ledger: [consented, withdrawal(consented)],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.dropped[0]?.reason).toBe('consent_withdrawn');
  });

  it('returns the categories that clear all three', () => {
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ACADEMIC_PERFORMANCE', 'ATTENDANCE', 'SPECIAL_PERSONAL'],
      ledger: [
        grant('ACADEMIC_PERFORMANCE', 'screening'),
        grant('ATTENDANCE', 'screening'),
      ],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.allowed).toEqual(['ACADEMIC_PERFORMANCE', 'ATTENDANCE']);
    expect(decision.dropped).toEqual([
      { category: 'SPECIAL_PERSONAL', reason: 'purpose_not_permitted' },
    ]);
  });
});

describe('planning stays learner-blind through this path too', () => {
  it('drops every learner-level category whatever the ledger says', () => {
    const learnerLevel: DataCategory[] = [
      'DIRECT_IDENTIFIER',
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
      'BEHAVIOUR',
      'SUPPORT_NEED',
      'SPECIAL_PERSONAL',
      'FAMILY_CONTEXT',
    ];
    const decision = resolveAccess({
      purpose: 'planning',
      subjectToken: LEARNER,
      requested: learnerLevel,
      // Consent for every one of them, which changes nothing.
      ledger: learnerLevel.map((category) => grant(category, 'planning')),
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.allowed).toEqual([]);
    expect(isEmpty(decision)).toBe(true);
  });
});

describe('an objection that did not stop the processing travels with the data', () => {
  it('is attached to the decision rather than swallowed', () => {
    const consented = grant('ATTENDANCE', 'screening');
    const objection: ConsentEntry = {
      ...withdrawal(consented),
      basis: 'PUBLIC_LAW_DUTY',
      note: 'Please stop.',
    };
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ATTENDANCE'],
      ledger: [consented, objection],
      tombstonedAt: null,
      at: AT,
    });
    // The caller gets the data *and* the fact that someone objected to it being used.
    expect(decision.allowed).toEqual(['ATTENDANCE']);
    expect(decision.objections).toHaveLength(1);
    expect(decision.objections[0]?.note).toBe('Please stop.');
  });
});

describe('the drop log', () => {
  it('carries tokens and category names and nothing else', () => {
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ACADEMIC_PERFORMANCE', 'SPECIAL_PERSONAL'],
      ledger: [grant('ACADEMIC_PERFORMANCE', 'screening')],
      tombstonedAt: null,
      at: AT,
    });
    const payload = auditPayload(decision);
    // The log is written on every learner-data read, so it is high-volume and long-lived.
    // A serialised payload that could contain a name would be a second copy of the
    // database with none of its protections — so assert on the serialised form, which is
    // what actually lands in the ledger.
    const serialised = JSON.stringify(payload);
    expect(serialised).toContain('LNR_');
    expect(serialised).not.toMatch(/[A-Za-z]+@[A-Za-z]/);
    expect(Object.keys(payload).sort()).toEqual([
      'allowed',
      'dropped',
      'objectionCount',
      'purpose',
      'subjectToken',
    ]);
  });

  it('reduces objections to a count, not their contents', () => {
    // An objection's note is the subject's own words and can contain anything at all,
    // including a name and a grievance. It belongs in the case file, not in a read log.
    const consented = grant('ATTENDANCE', 'screening');
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: ['ATTENDANCE'],
      ledger: [
        consented,
        {
          ...withdrawal(consented),
          basis: 'PUBLIC_LAW_DUTY',
          note: 'Nomvula Mahlangu says no',
        },
      ],
      tombstonedAt: null,
      at: AT,
    });
    expect(JSON.stringify(auditPayload(decision))).not.toContain('Nomvula');
    expect(auditPayload(decision).objectionCount).toBe(1);
  });
});

describe('nothing throws', () => {
  it('handles an empty request', () => {
    const decision = resolveAccess({
      purpose: 'screening',
      subjectToken: LEARNER,
      requested: [],
      ledger: [],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.allowed).toEqual([]);
    expect(decision.dropped).toEqual([]);
    expect(isEmpty(decision)).toBe(true);
  });

  it('handles product_improvement, which permits nothing', () => {
    const decision = resolveAccess({
      purpose: 'product_improvement',
      subjectToken: LEARNER,
      requested: ['ATTENDANCE', 'ACADEMIC_PERFORMANCE'],
      ledger: [
        grant('ATTENDANCE', 'product_improvement'),
        grant('ACADEMIC_PERFORMANCE', 'product_improvement'),
      ],
      tombstonedAt: null,
      at: AT,
    });
    expect(decision.allowed).toEqual([]);
    expect(decision.dropped.every((d) => d.reason === 'purpose_not_permitted')).toBe(
      true,
    );
  });
});
