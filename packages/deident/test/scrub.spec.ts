// The scrubber, tested directly.
//
// Until now `scrub` was only ever exercised through the guardrails red-team suite, which
// calls `containsDetectablePii` and therefore only ever asserts the boolean. That suite
// proves the detector *notices*. It says nothing about what the scrubber leaves behind —
// and the replacement text is what reaches the model, so a scrubber that detects perfectly
// and rebuilds the string wrongly is a scrubber that leaks.
//
// These are the cases about the output.

import { describe, expect, it } from 'vitest';

import { containsDetectablePii, scrub, type TenantLexicon } from '../src/scrub.js';

const LEXICON: TenantLexicon = {
  personNames: ['Nomvula Mahlangu', 'Sipho', 'Anna-Marie van der Merwe'],
  schoolNames: ['Kleinbos Primary'],
};

const EMPTY: TenantLexicon = { personNames: [], schoolNames: [] };

// A 13-digit value that passes the Luhn check. Constructed for the test, not a real
// number — no ID number, real or plausible, belongs in a repository.
const LUHN_VALID_ID = '8001015009087';

describe('clean text passes through untouched', () => {
  it('returns the input unchanged when nothing is found', () => {
    const text = 'The class made good progress on place value this term.';
    const result = scrub(text, LEXICON);
    expect(result.text).toBe(text);
    expect(result.clean).toBe(true);
    expect(result.redactions).toEqual([]);
  });

  it('does not claim the text was safe, only that nothing was found', () => {
    // The distinction is in the field's documentation and it matters: `clean` is the
    // detector's report, not a guarantee. The egress guard refuses on missing provenance
    // regardless of what this says, which is the property that makes the layering work.
    expect(scrub('', LEXICON).clean).toBe(true);
  });

  it('handles an empty lexicon', () => {
    expect(scrub('Nomvula did well.', EMPTY).clean).toBe(true);
  });

  it('ignores a one-character lexicon entry', () => {
    // A single letter would match half the alphabet in every sentence. Skipped rather than
    // matched, because a scrubber that redacts everything is a scrubber nobody uses.
    const result = scrub('A steady term for the group.', {
      personNames: ['A'],
      schoolNames: [],
    });
    expect(result.clean).toBe(true);
  });
});

describe('what the output actually contains', () => {
  it('replaces a known name with its placeholder and nothing else', () => {
    const result = scrub('Nomvula Mahlangu is reading well.', LEXICON);
    expect(result.text).toBe('[KNOWN_NAME] is reading well.');
    expect(result.text).not.toContain('Nomvula');
    expect(result.text).not.toContain('Mahlangu');
  });

  it('keeps the surrounding sentence intact', () => {
    // The scrubbed text is what a model reasons over. Losing the words around the name
    // would degrade every downstream artefact while looking like a privacy win.
    const result = scrub(
      'In Term 2, Sipho moved from Tier 1 to Tier 2 after four weeks.',
      LEXICON,
    );
    expect(result.text).toBe(
      'In Term 2, [KNOWN_NAME] moved from Tier 1 to Tier 2 after four weeks.',
    );
  });

  it('replaces every occurrence, not just the first', () => {
    const result = scrub('Sipho tried again. Sipho succeeded.', LEXICON);
    expect(result.text).toBe('[KNOWN_NAME] tried again. [KNOWN_NAME] succeeded.');
    expect(result.redactions).toHaveLength(2);
  });

  it('matches names case-insensitively', () => {
    expect(scrub('SIPHO was absent.', LEXICON).text).toBe('[KNOWN_NAME] was absent.');
  });

  it('matches a name across the separators real text uses', () => {
    // The red-team finding: `\b` treats `_` as a word character, so a filename reference
    // slipped through. Each of these is a way a name leaves in practice.
    for (const written of [
      'Nomvula_Mahlangu',
      'Nomvula.Mahlangu',
      'Nomvula-Mahlangu',
      'Nomvula  Mahlangu',
    ]) {
      const result = scrub(`See ${written}_report.pdf`, LEXICON);
      expect(result.text, written).not.toContain('Mahlangu');
    }
  });

  it('does not match a name embedded in a longer word', () => {
    // `Sipho` must not fire inside `Siphosethu`, which is a different child.
    const result = scrub('Siphosethu completed the task.', LEXICON);
    expect(result.text).toBe('Siphosethu completed the task.');
  });

  it('handles a hyphenated name in the lexicon', () => {
    const result = scrub('Anna-Marie van der Merwe chaired the meeting.', LEXICON);
    expect(result.text).toBe('[KNOWN_NAME] chaired the meeting.');
  });

  it('redacts the school name under its own kind', () => {
    const result = scrub('Kleinbos Primary reported the incident.', LEXICON);
    expect(result.text).toBe('[SCHOOL_NAME] reported the incident.');
    expect(result.redactions[0]?.kind).toBe('SCHOOL_NAME');
  });

  it('ignores a one-character school entry', () => {
    expect(
      scrub('The school reported it.', { personNames: [], schoolNames: [' '] }).clean,
    ).toBe(true);
  });
});

describe('the pattern layer', () => {
  it('redacts a Luhn-valid SA ID number', () => {
    const result = scrub(`ID ${LUHN_VALID_ID} on file.`, EMPTY);
    expect(result.text).toBe('ID [SA_ID_NUMBER] on file.');
  });

  it('leaves a 13-digit run that fails the checksum', () => {
    // Order numbers and reference codes are 13 digits too. Redacting them would train
    // users to ignore the scrubber, which costs more than the false negatives it saves.
    const result = scrub('Reference 1234567890123 attached.', EMPTY);
    expect(result.text).toContain('1234567890123');
  });

  it('redacts phone numbers in both local and international form', () => {
    expect(scrub('Call 0821234567 today.', EMPTY).text).toBe('Call [PHONE] today.');
    expect(scrub('Call +27821234567 today.', EMPTY).text).toBe('Call [PHONE] today.');
    expect(scrub('Call 082 123 4567 today.', EMPTY).text).toBe('Call [PHONE] today.');
  });

  it('redacts email addresses', () => {
    const result = scrub('Write to teacher@school.co.za please.', EMPTY);
    expect(result.text).toBe('Write to [EMAIL] please.');
  });

  it('redacts dates that could be a date of birth', () => {
    for (const written of ['11/04/2017', '11-04-2017', '11.04.17']) {
      expect(scrub(`Born ${written}.`, EMPTY).text, written).toBe(
        'Born [DATE_OF_BIRTH].',
      );
    }
  });

  it('redacts a street address', () => {
    const result = scrub('Lives at 42 Kloof Street currently.', EMPTY);
    expect(result.text).toBe('Lives at [ADDRESS_HINT] currently.');
  });
});

describe('overlapping hits', () => {
  it('collapses to the widest span rather than mangling the text', () => {
    // "Nomvula Mahlangu" matches as a known name; "Nomvula" alone would too if it were in
    // the lexicon. Two overlapping redactions would produce `[KNOWN_NAME][KNOWN_NAME]angu`
    // or worse. The longest-first pass is what prevents it.
    const result = scrub('Nomvula Mahlangu was present.', {
      personNames: ['Nomvula', 'Nomvula Mahlangu'],
      schoolNames: [],
    });
    expect(result.text).toBe('[KNOWN_NAME] was present.');
    expect(result.redactions).toHaveLength(1);
  });

  it('keeps non-overlapping hits in reading order', () => {
    const result = scrub(`Sipho, ID ${LUHN_VALID_ID}, on 0821234567.`, LEXICON);
    expect(result.redactions.map((r) => r.kind)).toEqual([
      'KNOWN_NAME',
      'SA_ID_NUMBER',
      'PHONE',
    ]);
    const starts = result.redactions.map((r) => r.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe('the redaction record is itself safe to log', () => {
  it('carries offsets and a placeholder, never the original text', () => {
    // These objects go into the audit trail. A redaction record containing what it
    // redacted would be a second copy of the personal information, in a table that keeps
    // it longer.
    const result = scrub('Nomvula Mahlangu, 0821234567.', LEXICON);
    const serialised = JSON.stringify(result.redactions);
    expect(serialised).not.toContain('Nomvula');
    expect(serialised).not.toContain('0821234567');
    expect(Object.keys(result.redactions[0] ?? {}).sort()).toEqual([
      'end',
      'kind',
      'placeholder',
      'start',
    ]);
  });

  it('reports offsets into the original text, not the scrubbed one', () => {
    // Offsets are for pointing a reviewer at the source. Against the output they would be
    // wrong by the length of every earlier placeholder.
    const text = 'Note: Sipho was absent.';
    const result = scrub(text, LEXICON);
    const hit = result.redactions[0];
    expect(text.slice(hit?.start, hit?.end)).toBe('Sipho');
  });
});

describe('containsDetectablePii', () => {
  it('is the negation of clean, and repairs nothing', () => {
    // Deliberately separate from `scrub`: the egress guard's job is to refuse, not to fix.
    // Silently scrubbing at the egress point would let a caller keep sending PII and never
    // learn it was doing so.
    expect(containsDetectablePii('Sipho was absent.', LEXICON)).toBe(true);
    expect(containsDetectablePii('The class was settled.', LEXICON)).toBe(false);
  });
});
