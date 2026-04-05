import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { PORTAL_SESSION_COOKIE, verifyPortalSessionToken } from './src/app/lib/auth-session';
import { canAccessPortalSection, getPortalSectionForPath, type PortalSection } from './src/app/lib/demo-users';

function getSectionForApiPath(pathname: string): PortalSection | null {
  if (pathname.startsWith('/api/chat/reply')) return 'chat';
  if (pathname.startsWith('/api/incidents')) return 'incidents';
  return null;
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/api/auth/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  const session = await verifyPortalSessionToken(token);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { message: 'Authentication required.' } }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/', request.url));
  }

  const section = pathname.startsWith('/api/')
    ? getSectionForApiPath(pathname)
    : getPortalSectionForPath(pathname);

  if (section && !canAccessPortalSection(session, section)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { message: 'Forbidden.' } }, { status: 403 });
    }

    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|iivkis-logo-nav.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map)$).*)',
  ],
};