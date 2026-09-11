// HTTP security header policy — Stage 16 step 3.
//
// These values are constants, not configuration: changing them requires a code review and
// a test update. A flag that weakens a security header is exactly the kind of thing rule
// 4 of Part 0 ("no escape hatch") is designed to prevent.

import { randomBytes } from 'node:crypto';

/** Immutable HTTP header values applied to every response. */
export const SECURITY_HEADERS = {
  X_CONTENT_TYPE_OPTIONS: 'nosniff',
  X_FRAME_OPTIONS: 'DENY',
  REFERRER_POLICY: 'strict-origin-when-cross-origin',
  // 2-year max-age; preload requires submission to the HSTS preload list (Stage 18).
  STRICT_TRANSPORT_SECURITY: 'max-age=63072000; includeSubDomains',
  PERMISSIONS_POLICY: 'camera=(), microphone=(), geolocation=(), payment=()',
  X_DNS_PREFETCH_CONTROL: 'off',
  X_PERMITTED_CROSS_DOMAIN_POLICIES: 'none',
} as const;

export type SecurityHeader = keyof typeof SECURITY_HEADERS;

/**
 * Generates a cryptographically random nonce for use in the Content-Security-Policy
 * `script-src` directive. Each HTTP response gets its own nonce; the nonce is injected
 * into `<script nonce="…">` tags by the layout component.
 *
 * Base64url (no padding) avoids the `+` and `/` characters that would need escaping in
 * the CSP header value.
 */
export function generateNonce(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Builds the Content-Security-Policy header value for a given request nonce.
 *
 * Design choices:
 * - `script-src 'nonce-{nonce}' 'strict-dynamic'` — allows the nonce-trusted script to
 *   load further scripts without an explicit hash, which is required for Next.js's runtime
 *   chunk loading.
 * - `style-src 'unsafe-inline'` — Tailwind CSS generates inline styles; switching to
 *   hash-based style CSP is a Stage 18 hardening item.
 * - `upgrade-insecure-requests` — any http:// sub-resource is rewritten to https://.
 * - No `unsafe-eval` anywhere — the application does not use eval().
 * - `frame-ancestors 'none'` — equivalent to X-Frame-Options DENY but honoured by modern
 *   browsers; both are set for defence-in-depth.
 */
export function buildCsp(nonce: string): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

/** Returns the full set of headers to attach to a response, including the CSP. */
export function buildResponseHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(nonce),
    'X-Content-Type-Options': SECURITY_HEADERS.X_CONTENT_TYPE_OPTIONS,
    'X-Frame-Options': SECURITY_HEADERS.X_FRAME_OPTIONS,
    'Referrer-Policy': SECURITY_HEADERS.REFERRER_POLICY,
    'Strict-Transport-Security': SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY,
    'Permissions-Policy': SECURITY_HEADERS.PERMISSIONS_POLICY,
    'X-DNS-Prefetch-Control': SECURITY_HEADERS.X_DNS_PREFETCH_CONTROL,
    'X-Permitted-Cross-Domain-Policies':
      SECURITY_HEADERS.X_PERMITTED_CROSS_DOMAIN_POLICIES,
  };
}
