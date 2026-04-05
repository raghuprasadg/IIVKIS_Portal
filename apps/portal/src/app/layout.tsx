import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';

import './globals.css';

import RootClient from './RootClient';
import { PORTAL_SESSION_COOKIE, verifyPortalSessionToken } from './lib/auth-session';

export const metadata: Metadata = {
  title: 'IIVKIS – Operations Portal',
  description: 'Intelligent IT Vendor Knowledge Integration System — Operations Portal',
  icons: {
    icon: '/iivkis-logo-nav.svg',
    shortcut: '/iivkis-logo-nav.svg',
    apple: '/iivkis-logo-nav.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00d4ff',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifyPortalSessionToken(cookieStore.get(PORTAL_SESSION_COOKIE)?.value);

  return (
    <html lang="en" className="dark">
      <body>
        <RootClient initialSession={session}>{children}</RootClient>
      </body>
    </html>
  );
}
