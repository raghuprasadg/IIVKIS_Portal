import { NextResponse } from 'next/server';

import { createPortalSessionToken, getPortalSessionCookieOptions, PORTAL_SESSION_COOKIE } from '../../../lib/auth-session';
import { findUser } from '../../../lib/demo-users';

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const username = body.username?.trim() || '';
  const password = body.password || '';
  const user = findUser(username, password);

  if (!user) {
    return NextResponse.json(
      { error: { message: 'Invalid username or password.' } },
      { status: 401 },
    );
  }

  const token = await createPortalSessionToken(user);
  const response = NextResponse.json({
    data: {
      user: {
        username: user.username,
        role: user.role,
        mode: user.mode,
        displayName: user.displayName,
        org: user.org,
        userId: user.userId,
        tenantId: user.tenantId,
      },
    },
  });

  response.cookies.set(PORTAL_SESSION_COOKIE, token, getPortalSessionCookieOptions());
  return response;
}
