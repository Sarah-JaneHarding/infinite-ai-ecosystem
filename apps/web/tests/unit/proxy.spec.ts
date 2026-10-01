import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

import proxy from '../../src/proxy.js';

// OQ-025: nothing previously exercised the real request path through `proxy.ts` — only
// `buildCsp()`'s pure output shape was tested. These tests construct a real `NextRequest`
// and call the exported handler directly, the same way Next.js's own runtime would.
describe('proxy', () => {
  beforeAll(() => {
    process.env['NEXTAUTH_SECRET'] = 'test-secret-for-proxy-spec-minimum-32-characters';
  });

  it('sets a Content-Security-Policy header with a nonce on the public sign-in page', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/sign-in'));

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
  });

  it('forwards the same nonce to the page via the x-nonce request header', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/sign-in'));

    const csp = response.headers.get('Content-Security-Policy');
    const nonceInCsp = csp?.match(/'nonce-([A-Za-z0-9+/=_-]+)'/)?.[1];
    const nonceHeader = response.headers.get('x-middleware-request-x-nonce');

    expect(nonceInCsp).toBeTruthy();
    expect(nonceHeader).toBe(nonceInCsp);
  });

  // Next.js stamps the nonce onto its own <script> tags by parsing the CSP on the *request*
  // during server rendering. A CSP that exists only on the response is enforced by the
  // browser but never reaches the markup, so every script is blocked and the page never
  // hydrates (found by building and running the image; invisible under `next dev`).
  it('forwards the response CSP, unchanged, as a request header so Next.js can stamp the nonce', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/sign-in'));

    const responseCsp = response.headers.get('Content-Security-Policy');
    const requestCsp = response.headers.get(
      'x-middleware-request-content-security-policy',
    );

    expect(requestCsp).toBeTruthy();
    expect(requestCsp).toBe(responseCsp);
  });

  it('issues a different nonce on every request', async () => {
    const nonceOf = async (): Promise<string | undefined> => {
      const response = await proxy(new NextRequest('http://localhost:3000/sign-in'));
      return response.headers
        .get('Content-Security-Policy')
        ?.match(/'nonce-([A-Za-z0-9+/=_-]+)'/)?.[1];
    };

    const first = await nonceOf();
    const second = await nonceOf();

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  // Guard against "fixing" a blocked-script bug by loosening the policy instead of
  // delivering the nonce: script-src must stay nonce-only.
  it('keeps script-src nonce-only: no unsafe-inline, no unsafe-eval, no wildcard', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/sign-in'));

    const scriptSrc = response.headers
      .get('Content-Security-Policy')
      ?.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src'));

    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toMatch(/(^|\s)\*(\s|$)/);
  });

  it('does not issue or forward a CSP on a redirect to sign-in', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/dashboard'));

    expect(response.status).toBe(307);
    expect(
      response.headers.get('x-middleware-request-content-security-policy'),
    ).toBeNull();
  });

  it('redirects an unauthenticated request to a protected route to /sign-in', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('callbackUrl=%2Fdashboard');
  });

  it('lets the liveness probe through without a session', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/api/health'));

    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  // The probe's exemption is exactly one path. Guard against it widening into "all of /api".
  it.each(['/api/caps-canon', '/api/approvals/abc/decide', '/api/healthz', '/api/health-secret'])(
    'still requires a session for %s',
    async (path) => {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/sign-in');
    },
  );

  it('does not redirect a request to a public NextAuth API route', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/api/auth/session'),
    );

    expect(response.status).not.toBe(307);
  });
});
