import { NextResponse } from 'next/server';

import { PORTAL_SESSION_COOKIE } from '../../../lib/auth-session';

export async function POST() {
  const response = NextResponse.json({ data: { success: true } });
  response.cookies.set(PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
