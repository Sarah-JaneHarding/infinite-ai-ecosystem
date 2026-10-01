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
  //
  // The CSP goes on BOTH the request and the response, and that is load-bearing:
  //  - on the response, the browser enforces it before executing any script;
  //  - on the request, Next.js reads it during server rendering, extracts the
  //    `'nonce-…'` value and stamps it onto the framework's own <script> tags and any
  //    <Script nonce> it emits (see Next's "Content Security Policy" guide). With it
  //    only on the response, nothing carries the nonce, `strict-dynamic` trusts nothing,
  //    and the browser blocks every script — the page renders but never hydrates.
  // That only works for dynamically rendered pages; the root layout opts in with
  // `await connection()`. `x-nonce` is kept for any server component that needs the
  // value itself.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

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
