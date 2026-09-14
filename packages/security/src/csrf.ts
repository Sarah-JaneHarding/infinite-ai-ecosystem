// CSRF protection — Stage 16 step 3.
//
// Pattern: double-submit cookie. The server generates a random token, sends it as a
// cookie AND as a value the client must echo back in a header or form field on every
// state-changing request. An attacker's page cannot read the cookie (SameSite=Strict
// blocks cross-site requests anyway) and therefore cannot echo the token.
//
// Used alongside Next.js's own server action CSRF protection (which uses a per-session
// signed token); this module covers API routes and legacy form posts.

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Generates a 32-byte cryptographically random CSRF token (hex-encoded). */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validates that the token supplied in the request header matches the token stored in the
 * cookie.
 *
 * `timingSafeEqual` prevents timing-based attacks that could reveal the expected token by
 * measuring how long the comparison takes.
 *
 * Returns `false` for any malformed input (empty string, wrong length, non-hex) rather
 * than throwing, so the caller always receives a boolean and never a leaked error detail.
 */
export function validateCsrfToken(requestToken: string, cookieToken: string): boolean {
  if (!requestToken || !cookieToken) return false;
  // Hex tokens are 64 characters (32 bytes × 2 hex digits).
  if (requestToken.length !== 64 || cookieToken.length !== 64) return false;
  if (!/^[0-9a-f]{64}$/.test(requestToken) || !/^[0-9a-f]{64}$/.test(cookieToken)) {
    return false;
  }
  const a = Buffer.from(requestToken, 'hex');
  const b = Buffer.from(cookieToken, 'hex');
  return timingSafeEqual(a, b);
}

/** Cookie attributes required for CSRF tokens. */
export const CSRF_COOKIE_ATTRIBUTES = {
  httpOnly: false, // Must be readable by client-side JS to echo in the header.
  secure: true, // Only transmitted over HTTPS.
  sameSite: 'Strict', // Blocks cross-origin requests entirely.
  path: '/',
} as const;

/** The header name the client must include containing the CSRF token. */
export const CSRF_HEADER_NAME = 'x-csrf-token' as const;

/** The cookie name the CSRF token is stored under. */
export const CSRF_COOKIE_NAME = 'csrf_token' as const;
