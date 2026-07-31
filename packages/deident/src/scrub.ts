// Free-text scrubbing — Stage 03 step 4.
//
// Structured columns are the easy case: you know what they hold. The hard case is prose —
// a teacher's note, an SBST minute, a walkthrough observation — where a learner's name
// appears in the middle of a sentence and nothing marks it as personal information.
//
// The manual specifies a layered detector: "dictionary of tenant-known names → pattern
// rules → a validation model call". This file implements the first two layers, which are
// deterministic and therefore testable to a stated recall. The third is a gateway call and
// arrives with Stage 04; the interface below leaves a seam for it rather than pretending
// two layers are enough.
//
// A note on what this is and is not. Scrubbing is a mitigation, not a guarantee. The
// guarantee is structural: learner data reaches a prompt as tokens because the query layer
// only ever returned tokens. Scrubbing exists for the text a human typed, where no such
// guarantee is available. Treating it as the primary control would be a mistake, which is
// why the egress guard refuses anything lacking de-identification provenance regardless of
// how clean the scrubber thinks the text is.

export type RedactionKind =
  | 'KNOWN_NAME'
  | 'SA_ID_NUMBER'
  | 'PHONE'
  | 'EMAIL'
  | 'DATE_OF_BIRTH'
  | 'ADDRESS_HINT'
  | 'SCHOOL_NAME';

export interface Redaction {
  readonly kind: RedactionKind;
  readonly start: number;
  readonly end: number;
  /** What replaced it. Never the original — this object gets logged. */
  readonly placeholder: string;
}

export interface ScrubResult {
  readonly text: string;
  readonly redactions: readonly Redaction[];
  /** True when nothing was found. Not a claim that nothing was there. */
  readonly clean: boolean;
}

/** Names and terms this tenant knows about: learners, guardians, staff, campuses. */
export interface TenantLexicon {
  readonly personNames: readonly string[];
  readonly schoolNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Layer 2: pattern rules
// ---------------------------------------------------------------------------

/**
 * A South African ID number: 13 digits, YYMMDD then sequence, citizenship, checksum.
 *
 * Matched on structure and then validated with the Luhn check, because a bare 13-digit
 * run also matches order numbers and reference codes. Validating cuts false positives
 * without weakening recall on real ID numbers.
 */
const SA_ID = /\b(\d{6})(\d{4})(\d)(\d)(\d)\b/g;

/** SA phone numbers: local 0XX, international +27, with common separators. */
const PHONE = /(\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}\b/g;

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g;

/** Dates that could be a date of birth. Deliberately broad. */
const DATE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;

/** Street addresses — a number followed by a street-type word. */
const ADDRESS =
  /\b\d+[a-zA-Z]?\s+[A-Z][a-zA-Z]*\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Close|Crescent|Way)\b/g;

/** Luhn check as used by SA ID numbers. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a pattern for a known name that tolerates the separators real text uses.
 *
 * "Nomvula Mahlangu" must also match `Nomvula_Mahlangu` in a filename, `Nomvula.Mahlangu`
 * in an email local part and `Nomvula-Mahlangu` in a slug. The red-team set caught this:
 * a plain word-boundary match on the spaced form let `Nomvula_Mahlangu_report.pdf`
 * through, which is exactly how a name leaves in an attachment reference.
 */
function knownNamePattern(name: string): RegExp {
  const parts = name.trim().split(/\s+/).map(escapeRegExp);
  // Boundaries are lookarounds on alphanumerics rather than \b. `\b` treats underscore
  // as a word character, so `\bMahlangu\b` does not match inside `Nomvula_Mahlangu_report`
  // — which is precisely the filename case the red-team set caught. Excluding only
  // letters and digits lets `_`, `.` and `-` act as the separators they are in practice.
  return new RegExp(`(?<![A-Za-z0-9])${parts.join('[\\s._-]+')}(?![A-Za-z0-9])`, 'gi');
}

interface Hit {
  kind: RedactionKind;
  start: number;
  end: number;
}

function collectPattern(text: string, pattern: RegExp, kind: RedactionKind): Hit[] {
  const hits: Hit[] = [];
  const re = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (kind === 'SA_ID_NUMBER' && !passesLuhn(match[0])) continue;
    hits.push({ kind, start: match.index, end: match.index + match[0].length });
  }
  return hits;
}

/**
 * Scrubs free text.
 *
 * Dictionary first, then patterns. Overlapping hits resolve to the longest, so a name
 * inside an address is not redacted twice and left mangled.
 */
export function scrub(text: string, lexicon: TenantLexicon): ScrubResult {
  const hits: Hit[] = [];

  // Layer 1: names this tenant actually knows. Highest precision available, because it is
  // matching against a real roll rather than guessing what looks like a name.
  for (const name of lexicon.personNames) {
    if (name.trim().length < 2) continue;
    const re = knownNamePattern(name);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      hits.push({
        kind: 'KNOWN_NAME',
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  for (const school of lexicon.schoolNames) {
    if (school.trim().length < 2) continue;
    const re = knownNamePattern(school);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      hits.push({
        kind: 'SCHOOL_NAME',
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Layer 2: structure.
  hits.push(...collectPattern(text, SA_ID, 'SA_ID_NUMBER'));
  hits.push(...collectPattern(text, PHONE, 'PHONE'));
  hits.push(...collectPattern(text, EMAIL, 'EMAIL'));
  hits.push(...collectPattern(text, DATE, 'DATE_OF_BIRTH'));
  hits.push(...collectPattern(text, ADDRESS, 'ADDRESS_HINT'));

  if (hits.length === 0) return { text, redactions: [], clean: true };

  // Longest-first, then leftmost, so overlaps collapse to the widest span.
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const hit of hits) {
    if (kept.some((k) => hit.start < k.end && k.start < hit.end)) continue;
    kept.push(hit);
  }
  kept.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  const redactions: Redaction[] = [];
  for (const hit of kept) {
    const placeholder = `[${hit.kind}]`;
    out += text.slice(cursor, hit.start) + placeholder;
    redactions.push({ ...hit, placeholder });
    cursor = hit.end;
  }
  out += text.slice(cursor);

  return { text: out, redactions, clean: false };
}

/**
 * Does this text still contain anything the detector recognises?
 *
 * Used by the egress guard as a last check before a payload leaves. Separate from `scrub`
 * because the guard's job is to refuse, not to repair: silently scrubbing at the egress
 * point would let a caller keep sending PII and never learn that it was doing so.
 */
export function containsDetectablePii(text: string, lexicon: TenantLexicon): boolean {
  return !scrub(text, lexicon).clean;
}
