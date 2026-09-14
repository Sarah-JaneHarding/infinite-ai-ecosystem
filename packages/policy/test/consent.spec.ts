// Reading the consent ledger.
//
// The cases that matter here are the ones where the obvious implementation is wrong:
// withdrawal that is not the subject's to make, a grant recorded after a withdrawal, and
// asking about a date in the past.

import type { ConsentEntry } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import {
  endsProcessing,
  evaluateConsent,
  relevantEntries,
  unresolvedObjections,
} from '../src/consent.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LEARNER = 'LNR_7F3A2C0B91DE';
const OTHER = 'LNR_00112233445566';

let counter = 0;
function entry(overrides: Partial<ConsentEntry> = {}): ConsentEntry {
  counter += 1;
  const at = new Date('2026-01-15T08:00:00.000Z');
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    tenantId: TENANT,
    subjectToken: LEARNER,
    category: 'ACADEMIC_PERFORMANCE',
    purpose: 'screening',
    basis: 'CONSENT',
    decision: 'GRANTED',
    source: 'PAPER_FORM',
    evidenceRef: 'admission-form-2026/0431',
    effectiveFrom: at,
    recordedAt: at,
    recordedBy: null,
    note: null,
    ...overrides,
  };
}

const QUERY = {
  subjectToken: LEARNER,
  category: 'ACADEMIC_PERFORMANCE',
  purpose: 'screening',
  at: new Date('2026-06-01T00:00:00.000Z'),
} as const;

describe('an absent record is a denial', () => {
  it('denies against an empty ledger', () => {
    const verdict = evaluateConsent([], QUERY);
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toBe('no_record');
  });

  it('does not let another subject`s consent answer for this one', () => {
    // The bug this catches is a filter that forgets one of the three keys. Each of the
    // next three cases removes exactly one.
    const verdict = evaluateConsent([entry({ subjectToken: OTHER })], QUERY);
    expect(verdict.permitted).toBe(false);
  });

  it('does not let consent for another category answer for this one', () => {
    const verdict = evaluateConsent([entry({ category: 'ATTENDANCE' })], QUERY);
    expect(verdict.permitted).toBe(false);
  });

  it('does not let consent for another purpose answer for this one', () => {
    // The most important of the three. Consent given for a parent report is not consent
    // to feed the same marks into district analytics.
    const verdict = evaluateConsent([entry({ purpose: 'reporting_parent' })], QUERY);
    expect(verdict.permitted).toBe(false);
  });
});

describe('the latest effective entry wins', () => {
  it('permits after a grant', () => {
    const verdict = evaluateConsent([entry()], QUERY);
    expect(verdict.permitted).toBe(true);
    expect(verdict.permitted && verdict.basis).toBe('CONSENT');
  });

  it('denies after a withdrawal', () => {
    const ledger = [
      entry(),
      entry({
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
        evidenceRef: null,
      }),
    ];
    const verdict = evaluateConsent(ledger, QUERY);
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toBe('withdrawn');
  });

  it('permits again after a fresh grant following a withdrawal', () => {
    // A guardian who withdraws in March and signs again in May has consented. Treating
    // withdrawal as permanent would be a different, unasked-for policy.
    const ledger = [
      entry(),
      entry({
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
        evidenceRef: null,
      }),
      entry({
        effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
        recordedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ];
    expect(evaluateConsent(ledger, QUERY).permitted).toBe(true);
  });

  it('is not confused by the order rows arrive in', () => {
    // Nothing guarantees the database returns these in effective order, and a sort that
    // is only correct for pre-sorted input is not a sort.
    const grant = entry();
    const withdrawal = entry({
      decision: 'WITHDRAWN',
      effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
      recordedAt: new Date('2026-03-01T00:00:00.000Z'),
      evidenceRef: null,
    });
    expect(evaluateConsent([withdrawal, grant], QUERY).permitted).toBe(false);
  });

  it('breaks a same-instant tie by when the entry was recorded', () => {
    const sameMoment = new Date('2026-02-01T00:00:00.000Z');
    const grant = entry({
      effectiveFrom: sameMoment,
      recordedAt: new Date('2026-02-01T09:00:00.000Z'),
    });
    const withdrawal = entry({
      decision: 'WITHDRAWN',
      effectiveFrom: sameMoment,
      recordedAt: new Date('2026-02-01T15:00:00.000Z'),
      evidenceRef: null,
    });
    // The school's most recent understanding is the withdrawal, whatever order the rows
    // are handed over in.
    expect(evaluateConsent([grant, withdrawal], QUERY).permitted).toBe(false);
    expect(evaluateConsent([withdrawal, grant], QUERY).permitted).toBe(false);
  });

  it('falls back to the entry id when both timestamps tie', () => {
    // Two entries identical to the millisecond is a migration artefact rather than
    // something a school does, but it happens — and an unstable sort would make the
    // verdict depend on the order the database felt like returning rows in, which is the
    // kind of bug that reproduces once and then never again.
    const at = new Date('2026-02-01T00:00:00.000Z');
    const lower = entry({
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      effectiveFrom: at,
      recordedAt: at,
    });
    const higher = entry({
      id: 'aaaaaaaa-0000-4000-8000-000000000002',
      decision: 'WITHDRAWN',
      evidenceRef: null,
      effectiveFrom: at,
      recordedAt: at,
    });
    expect(evaluateConsent([lower, higher], QUERY).permitted).toBe(false);
    expect(evaluateConsent([higher, lower], QUERY).permitted).toBe(false);
  });

  it('does not fall over on a duplicated entry', () => {
    const duplicate = entry();
    expect(evaluateConsent([duplicate, { ...duplicate }], QUERY).permitted).toBe(true);
  });
});

describe('asking about a moment in the past', () => {
  it('ignores entries that had not taken effect yet', () => {
    const ledger = [
      entry(),
      entry({
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        recordedAt: new Date('2026-09-01T00:00:00.000Z'),
        evidenceRef: null,
      }),
    ];
    // In June the withdrawal has not happened. This is the whole reason the ledger is a
    // log: a June screening was lawful, and a September withdrawal does not make it
    // retrospectively unlawful.
    expect(evaluateConsent(ledger, QUERY).permitted).toBe(true);
    expect(
      evaluateConsent(ledger, { ...QUERY, at: new Date('2026-10-01T00:00:00.000Z') })
        .permitted,
    ).toBe(false);
  });

  it('denies before the first grant took effect', () => {
    const verdict = evaluateConsent([entry()], {
      ...QUERY,
      at: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(verdict.permitted).toBe(false);
  });

  it('includes an entry effective at exactly the moment asked about', () => {
    // Off-by-one at the boundary would mean processing was unlawful for one instant, and
    // nobody would ever find it.
    const at = new Date('2026-01-15T08:00:00.000Z');
    expect(evaluateConsent([entry()], { ...QUERY, at }).permitted).toBe(true);
  });

  it('exposes the entries it considered, in order', () => {
    const ledger = [
      entry({ effectiveFrom: new Date('2026-04-01T00:00:00.000Z') }),
      entry(),
    ];
    const considered = relevantEntries(ledger, QUERY);
    expect(considered.map((e) => e.effectiveFrom.toISOString())).toEqual([
      '2026-01-15T08:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ]);
  });
});

describe('a withdrawal that is not the subject`s to make', () => {
  const statutory = {
    basis: 'PUBLIC_LAW_DUTY',
    source: 'NOT_APPLICABLE',
    evidenceRef: null,
  } as const;

  it('keeps the processing lawful and surfaces the objection', () => {
    // A guardian cannot instruct a school to stop keeping an attendance register. The
    // objection is real and the school must answer it, but it does not stop the register.
    const ledger = [
      entry({ ...statutory }),
      entry({
        ...statutory,
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
        note: 'I do not want the school analysing my child.',
      }),
    ];
    const verdict = evaluateConsent(ledger, QUERY);
    expect(verdict.permitted).toBe(true);
    expect(verdict.permitted && verdict.objection?.basis).toBe('PUBLIC_LAW_DUTY');
    expect(verdict.permitted && verdict.objection?.note).toBe(
      'I do not want the school analysing my child.',
    );
  });

  it('stops processing when the basis was a legitimate interest', () => {
    // §11(3)(b) — an objection to a §11(1)(f) legitimate interest does stop it.
    const ledger = [
      entry({
        basis: 'LEGITIMATE_INTEREST',
        source: 'NOT_APPLICABLE',
        evidenceRef: null,
      }),
      entry({
        basis: 'LEGITIMATE_INTEREST',
        source: 'NOT_APPLICABLE',
        evidenceRef: null,
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ];
    expect(evaluateConsent(ledger, QUERY).permitted).toBe(false);
  });

  it('denies when the only entry is an objection with nothing behind it', () => {
    const ledger = [
      entry({
        ...statutory,
        decision: 'WITHDRAWN',
      }),
    ];
    const verdict = evaluateConsent(ledger, QUERY);
    expect(verdict.permitted).toBe(false);
    expect(verdict.permitted === false && verdict.reason).toBe('no_record');
  });

  it('answers the same question at the point of capture', () => {
    expect(endsProcessing('WITHDRAWN', 'CONSENT')).toBe(true);
    expect(endsProcessing('WITHDRAWN', 'LEGITIMATE_INTEREST')).toBe(true);
    expect(endsProcessing('WITHDRAWN', 'PUBLIC_LAW_DUTY')).toBe(false);
    expect(endsProcessing('GRANTED', 'CONSENT')).toBe(false);
  });
});

describe('the objection queue', () => {
  it('lists objections that did not stop the processing', () => {
    const ledger = [
      entry({ basis: 'PUBLIC_LAW_DUTY', source: 'NOT_APPLICABLE', evidenceRef: null }),
      entry({
        basis: 'PUBLIC_LAW_DUTY',
        source: 'NOT_APPLICABLE',
        evidenceRef: null,
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
      // A different subject, plain consent, withdrawn — stopped, so not in the queue.
      entry({ subjectToken: OTHER }),
      entry({
        subjectToken: OTHER,
        decision: 'WITHDRAWN',
        effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
        recordedAt: new Date('2026-03-01T00:00:00.000Z'),
        evidenceRef: null,
      }),
    ];
    const queue = unresolvedObjections(ledger, new Date('2026-06-01T00:00:00.000Z'));
    expect(queue).toHaveLength(1);
    expect(queue[0]?.subjectToken).toBe(LEARNER);
  });

  it('reports each subject, category and purpose once, not once per entry', () => {
    const base = {
      basis: 'PUBLIC_LAW_DUTY',
      source: 'NOT_APPLICABLE',
      evidenceRef: null,
    } as const;
    const withdrawal = (iso: string): ConsentEntry =>
      entry({
        ...base,
        decision: 'WITHDRAWN',
        effectiveFrom: new Date(iso),
        recordedAt: new Date(iso),
      });
    const ledger = [
      entry(base),
      withdrawal('2026-02-01T00:00:00.000Z'),
      withdrawal('2026-03-01T00:00:00.000Z'),
    ];
    expect(
      unresolvedObjections(ledger, new Date('2026-06-01T00:00:00.000Z')),
    ).toHaveLength(1);
  });

  it('is empty when nothing has been objected to', () => {
    expect(unresolvedObjections([entry()], new Date('2026-06-01T00:00:00.000Z'))).toEqual(
      [],
    );
  });
});
