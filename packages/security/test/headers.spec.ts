import { describe, expect, it } from 'vitest';

import {
  SECURITY_HEADERS,
  buildCsp,
  buildResponseHeaders,
  generateNonce,
} from '../src/headers.js';

describe('generateNonce', () => {
  it('returns a non-empty base64url string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('returns a different value on each call', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });

  it('produces a nonce of at least 16 bytes (22+ base64url chars)', () => {
    // 16 bytes → ceil(16 * 4/3) = 22 chars with base64url (no padding).
    const nonce = generateNonce();
    expect(nonce.length).toBeGreaterThanOrEqual(21);
  });
});

describe('buildCsp', () => {
  const nonce = 'test-nonce-abc123';

  it('includes the nonce in script-src', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('includes strict-dynamic in script-src', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("'strict-dynamic'");
  });

  it('does not contain unsafe-eval', () => {
    const csp = buildCsp(nonce);
    expect(csp).not.toContain('unsafe-eval');
  });

  it('does not contain unsafe-inline in script-src', () => {
    const csp = buildCsp(nonce);
    // unsafe-inline may appear in style-src but must not appear before script-src ends.
    const scriptSrcDirective = csp
      .split(';')
      .find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrcDirective).toBeDefined();
    expect(scriptSrcDirective).not.toContain('unsafe-inline');
  });

  it('blocks object-src', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("object-src 'none'");
  });

  it('blocks frame-ancestors', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('restricts base-uri to self', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("base-uri 'self'");
  });

  it('restricts form-action to self', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain("form-action 'self'");
  });

  it('includes upgrade-insecure-requests', () => {
    const csp = buildCsp(nonce);
    expect(csp).toContain('upgrade-insecure-requests');
  });
});

describe('SECURITY_HEADERS', () => {
  it('X_CONTENT_TYPE_OPTIONS is nosniff', () => {
    expect(SECURITY_HEADERS.X_CONTENT_TYPE_OPTIONS).toBe('nosniff');
  });

  it('X_FRAME_OPTIONS is DENY', () => {
    expect(SECURITY_HEADERS.X_FRAME_OPTIONS).toBe('DENY');
  });

  it('STRICT_TRANSPORT_SECURITY includes max-age and includeSubDomains', () => {
    const hsts = SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY;
    expect(hsts).toMatch(/max-age=\d+/);
    expect(hsts).toContain('includeSubDomains');
    // max-age must be at least 1 year (31536000s).
    const match = /max-age=(\d+)/.exec(hsts);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it('PERMISSIONS_POLICY restricts camera, microphone, geolocation and payment', () => {
    const pp = SECURITY_HEADERS.PERMISSIONS_POLICY;
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('payment=()');
  });
});

describe('buildResponseHeaders', () => {
  it('returns all required header keys', () => {
    const headers = buildResponseHeaders('nonce-xyz');
    expect(headers).toHaveProperty('Content-Security-Policy');
    expect(headers).toHaveProperty('X-Content-Type-Options');
    expect(headers).toHaveProperty('X-Frame-Options');
    expect(headers).toHaveProperty('Referrer-Policy');
    expect(headers).toHaveProperty('Strict-Transport-Security');
    expect(headers).toHaveProperty('Permissions-Policy');
    expect(headers).toHaveProperty('X-DNS-Prefetch-Control');
    expect(headers).toHaveProperty('X-Permitted-Cross-Domain-Policies');
  });

  it('embeds the supplied nonce in the CSP', () => {
    const headers = buildResponseHeaders('my-test-nonce');
    expect(headers['Content-Security-Policy']).toContain("'nonce-my-test-nonce'");
  });
});
