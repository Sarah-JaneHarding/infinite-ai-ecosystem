// PII scrubbing patterns for log lines — Stage 15 step 2.
//
// The logger's own `secret()` / `redact()` API covers secrets known at construction time
// (credentials, API keys). This module covers PII that appears in log fields without
// being explicitly registered — SA ID numbers, email addresses, phone numbers — that a
// caller might accidentally include in a trace attribute or a log field.
//
// `scrubPii` is a last-resort filter applied to the serialized log line before it is
// emitted to any sink. It does not replace the PII guard's pre-prompt check; it exists
// so a diagnostic log written during a failed guardrail check cannot itself contain the
// PII the guard just refused.

/** A single PII pattern with a descriptive name for test assertions. */
export interface PiiPattern {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

// South African ID number: 13 digits where the first 6 are a valid date (YYMMDD)
// and digit 11 distinguishes SA citizens (0) from permanent residents (1).
// Pattern: 6 digit date + 4 digit sequence + citizenship + 2 checksum digits.
// Using a simple 13-consecutive-digit pattern is intentionally broad — false positives
// (e.g. a long reference number) are acceptable in a log scrubber; false negatives are not.
const SA_ID_NUMBER: PiiPattern = {
  name: 'sa_id_number',
  pattern: /\b\d{13}\b/g,
  replacement: '[SA-ID-REDACTED]',
};

// Email addresses — RFC 5322 simplified to what appears in practice.
const EMAIL_ADDRESS: PiiPattern = {
  name: 'email_address',
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  replacement: '[EMAIL-REDACTED]',
};

// South African mobile numbers: 0XX XXXXXXX, 0XXXXXXXXX, +27 XX XXXXXXX, +27XXXXXXXXX.
const SA_PHONE_NUMBER: PiiPattern = {
  name: 'sa_phone_number',
  pattern: /(?:\+27|0)\s*[6-8]\d[\s-]?\d{3}[\s-]?\d{4}/g,
  replacement: '[PHONE-REDACTED]',
};

// Generic 16-digit sequences that look like payment card numbers (PAN).
const PAYMENT_CARD: PiiPattern = {
  name: 'payment_card',
  pattern: /\b(?:\d[\s-]?){15,16}\b/g,
  replacement: '[CARD-REDACTED]',
};

export const PII_PATTERNS: readonly PiiPattern[] = [
  SA_ID_NUMBER,
  EMAIL_ADDRESS,
  SA_PHONE_NUMBER,
  PAYMENT_CARD,
] as const;

/**
 * Applies all PII patterns to a string. The patterns are applied in order and do not
 * overlap — once a substring is replaced it will not match a subsequent pattern.
 */
export function scrubPii(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Walks a log-field tree and applies `scrubPii` to every string value.
 * Does not mutate the input.
 */
export function scrubFields(value: unknown): unknown {
  if (typeof value === 'string') return scrubPii(value);
  if (Array.isArray(value)) return value.map((item) => scrubFields(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        scrubFields(v),
      ]),
    );
  }
  return value;
}
