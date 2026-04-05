import { NextResponse } from 'next/server';

import { getPortalSessionFromCookieHeader, verifyPortalSessionToken } from '../../../lib/auth-session';

export async function GET(request: Request) {
  const token = getPortalSessionFromCookieHeader(request.headers.get('cookie'));
  const session = await verifyPortalSessionToken(token);

  return NextResponse.json({ data: { authenticated: session !== null, user: session } });
}
