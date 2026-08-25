import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { buildCsp, generateNonce } from '@infinite-ai/security';

/** Public paths that do not require authentication. */
const PUBLIC = ['/sign-in', '/api/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Deliberately does not use next-auth's `withAuth` wrapper. `withAuth`'s own
 * `handleMiddleware` unconditionally returns *before* invoking the wrapped middleware for
 * the sign-in page, the error page, and the NextAuth API routes — a built-in short-circuit
 * to avoid redirect loops (see `next-auth/src/next/middleware.ts`). That meant the CSP
 * nonce below never ran for `/sign-in`, regardless of what this file's own `authorized`
 * callback said (OQ-025). `getToken` is next-auth's documented lower-level primitive for
 * exactly this: reading the session token without that side effect, so the CSP nonce is
 * set unconditionally, on every matched request, before the auth decision is made.
 */
export default async function proxy(req: NextRequest): Promise<NextResponse> {
  // Generate a fresh nonce for every request so each page's CSP is unique.
  // The nonce is forwarded to the page via a request header; layouts read it and pass
  // it to <Script nonce={nonce}> tags. The CSP is set on the response so the browser
  // enforces it before executing any script.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const { pathname, search } = req.nextUrl;

  if (!isPublic(pathname)) {
    const token = await getToken({ req });
    if (!token) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
      return NextResponse.redirect(signInUrl);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)).*)'],
};
