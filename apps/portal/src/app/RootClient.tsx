'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import AppSidebar from './AppSidebar';
import LoginPage from './LoginPage';
import { saveConsoleMode } from './lib/console-mode';
import {
  canAccessPortalSection,
  clearSessionUser,
  getPortalSectionForPath,
  saveSessionUser,
  readSessionUser,
  type DemoUser,
} from './lib/demo-users';

export default function RootClient({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: DemoUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (initialSession) {
      saveSessionUser(initialSession);
      saveConsoleMode(initialSession.mode);
    } else {
      clearSessionUser();
      saveConsoleMode('logged-out');
    }
  }, [initialSession]);

  useEffect(() => {
    if (!initialSession) return;

    const user = readSessionUser() ?? initialSession;
    const section = getPortalSectionForPath(pathname);
    if (section && !canAccessPortalSection(user, section)) {
      router.replace('/');
    }
  }, [initialSession, pathname, router]);

  if (!initialSession) {
    return <LoginPage onSuccess={() => { window.location.reload(); }} />;
  }

  return (
    <div className="app-layout">
      <AppSidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
