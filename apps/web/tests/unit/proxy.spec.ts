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

  it('redirects an unauthenticated request to a protected route to /sign-in', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('callbackUrl=%2Fdashboard');
  });

  it('does not redirect a request to a public NextAuth API route', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/api/auth/session'),
    );

    expect(response.status).not.toBe(307);
  });
});
