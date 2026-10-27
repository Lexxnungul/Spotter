import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffTokenEdge, STAFF_COOKIE_NAME } from './lib/staff-token-edge';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all /receptionist routes at the server level
  if (pathname.startsWith('/receptionist')) {
    const token = req.cookies.get(STAFF_COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL('/auth', req.url);
      loginUrl.searchParams.set('mode', 'login');
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'staff_required');
      return NextResponse.redirect(loginUrl);
    }

    const staff = await verifyStaffTokenEdge(token);

    if (!staff || (staff.role !== 'STAFF' && staff.role !== 'OWNER')) {
      const loginUrl = new URL('/auth', req.url);
      loginUrl.searchParams.set('mode', 'login');
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'invalid_session');

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(STAFF_COOKIE_NAME);
      return response;
    }

    // Forward with injected staff headers for downstream components and routes
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-staff-id', staff.id);
    requestHeaders.set('x-staff-email', staff.email);
    requestHeaders.set('x-staff-role', staff.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/receptionist/:path*'],
};
