import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Public paths that do not require authentication. */
const PUBLIC = ['/sign-in', '/api/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default withAuth(
  function middleware(req: NextRequest) {
    if (isPublic(req.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.next();
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
