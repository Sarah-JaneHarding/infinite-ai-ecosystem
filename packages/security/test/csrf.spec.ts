import { describe, expect, it } from 'vitest';

import {
  CSRF_COOKIE_ATTRIBUTES,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  validateCsrfToken,
} from '../src/csrf.js';

describe('generateCsrfToken', () => {
  it('returns a 64-character lowercase hex string', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different token on each call', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe('validateCsrfToken', () => {
  it('returns true when request token matches cookie token', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('returns false when tokens differ', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(validateCsrfToken(a, b)).toBe(false);
  });

  it('returns false for empty request token', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken('', token)).toBe(false);
  });

  it('returns false for empty cookie token', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, '')).toBe(false);
  });

  it('returns false for tokens of wrong length', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken('short', token)).toBe(false);
    expect(validateCsrfToken(token, 'short')).toBe(false);
  });

  it('returns false for non-hex tokens of correct length', () => {
    const bad = 'z'.repeat(64);
    const good = generateCsrfToken();
    expect(validateCsrfToken(bad, good)).toBe(false);
  });

  it('is not susceptible to timing differences for near-matches', () => {
    // This test cannot prove timing-safety directly, but it documents the requirement
    // and verifies that the comparison works for a token with all-but-one character equal.
    const a = generateCsrfToken();
    const b = a.slice(0, 63) + (a[63] === 'a' ? 'b' : 'a');
    expect(validateCsrfToken(a, b)).toBe(false);
  });
});

describe('CSRF cookie attributes', () => {
  it('httpOnly is false (must be readable by JS for the double-submit pattern)', () => {
    expect(CSRF_COOKIE_ATTRIBUTES.httpOnly).toBe(false);
  });

  it('secure is true', () => {
    expect(CSRF_COOKIE_ATTRIBUTES.secure).toBe(true);
  });

  it('sameSite is Strict', () => {
    expect(CSRF_COOKIE_ATTRIBUTES.sameSite).toBe('Strict');
  });
});

describe('CSRF header and cookie name constants', () => {
  it('header name is lowercase x-csrf-token', () => {
    expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
  });

  it('cookie name is csrf_token', () => {
    expect(CSRF_COOKIE_NAME).toBe('csrf_token');
  });
});
