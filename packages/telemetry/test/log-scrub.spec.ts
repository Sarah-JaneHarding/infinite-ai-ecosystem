import { describe, it, expect } from 'vitest';
import { scrubPii, scrubFields, PII_PATTERNS } from '../src/log-scrub.js';

describe('scrubPii — SA ID number', () => {
  it('redacts a 13-digit SA ID number embedded in a log message', () => {
    const result = scrubPii('learner ID: 9001015009087 enrolled');
    expect(result).not.toContain('9001015009087');
    expect(result).toContain('[SA-ID-REDACTED]');
  });

  it('does not modify a 12-digit number (too short)', () => {
    const result = scrubPii('ref: 900101500908');
    expect(result).toBe('ref: 900101500908');
  });

  it('does not modify a 14-digit number (too long)', () => {
    const result = scrubPii('val: 90010150090870');
    expect(result).toBe('val: 90010150090870');
  });
});

describe('scrubPii — email address', () => {
  it('redacts a plain email address', () => {
    const result = scrubPii('actor: teacher@benjaminpine.co.za submitted');
    expect(result).not.toContain('teacher@benjaminpine.co.za');
    expect(result).toContain('[EMAIL-REDACTED]');
  });

  it('redacts an email with plus addressing', () => {
    const result = scrubPii('contact: user+tag@school.edu.za');
    expect(result).not.toContain('user+tag@school.edu.za');
    expect(result).toContain('[EMAIL-REDACTED]');
  });

  it('leaves a plain domain name alone', () => {
    const result = scrubPii('host: school.edu.za');
    expect(result).toBe('host: school.edu.za');
  });
});

describe('scrubPii — SA phone number', () => {
  it('redacts a 10-digit local mobile number', () => {
    const result = scrubPii('contact: 0821234567');
    expect(result).not.toContain('0821234567');
    expect(result).toContain('[PHONE-REDACTED]');
  });

  it('redacts a number in +27 format', () => {
    const result = scrubPii('phone: +27821234567');
    expect(result).not.toContain('+27821234567');
    expect(result).toContain('[PHONE-REDACTED]');
  });
});

describe('scrubPii — combined', () => {
  it('redacts multiple PII types in one string', () => {
    const raw = 'actor: 9001015009087 email: test@school.co.za phone: 0821234567';
    const result = scrubPii(raw);
    expect(result).not.toContain('9001015009087');
    expect(result).not.toContain('test@school.co.za');
    expect(result).not.toContain('0821234567');
  });

  it('leaves a clean log line unchanged', () => {
    const clean = 'gateway.chat_completions tenant=t-abc123 model=plan.author tokens=512';
    expect(scrubPii(clean)).toBe(clean);
  });
});

describe('scrubFields', () => {
  it('scrubs a string field inside an object', () => {
    const result = scrubFields({ actor: 'teacher@school.co.za', tokens: 512 }) as Record<
      string,
      unknown
    >;
    expect(result['actor']).toContain('[EMAIL-REDACTED]');
    expect(result['tokens']).toBe(512);
  });

  it('scrubs nested objects recursively', () => {
    const result = scrubFields({ meta: { contact: '0821234567' } }) as {
      meta: { contact: string };
    };
    expect(result.meta.contact).toContain('[PHONE-REDACTED]');
  });

  it('scrubs strings inside an array', () => {
    const result = scrubFields(['9001015009087', 'clean']) as string[];
    expect(result[0]).toContain('[SA-ID-REDACTED]');
    expect(result[1]).toBe('clean');
  });

  it('passes through non-string primitives unchanged', () => {
    expect(scrubFields(42)).toBe(42);
    expect(scrubFields(true)).toBe(true);
    expect(scrubFields(null)).toBeNull();
  });
});

describe('PII_PATTERNS catalog', () => {
  it('every pattern has a name and a regex with global flag', () => {
    for (const { name, pattern } of PII_PATTERNS) {
      expect(name.length).toBeGreaterThan(0);
      expect(pattern.flags).toContain('g');
    }
  });
});
