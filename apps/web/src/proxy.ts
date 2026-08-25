import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { buildCsp, generateNonce } from '@infinite-ai/security';

/** Public paths that do not require authentication. */
const PUBLIC = ['/sign-in', '/api/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default withAuth(
  function proxy(req: NextRequest) {
    // Generate a fresh nonce for every request so each page's CSP is unique.
    // The nonce is forwarded to the page via a request header; layouts read it and pass
    // it to <Script nonce={nonce}> tags. The CSP is set on the response so the browser
    // enforces it before executing any script.
    const nonce = generateNonce();
    const csp = buildCsp(nonce);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);

    return response;
  },
  {
    callbacks: {
      authorized({ token, req }) {
        if (isPublic(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
    pages: { signIn: '/sign-in' },
  },
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)).*)'],
};
