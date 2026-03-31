'use client';

import { useEffect, useState } from 'react';

import AppSidebar from './AppSidebar';
import LoginPage from './LoginPage';
import { readSessionUser } from './lib/demo-users';

export default function RootClient({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = hydrating

  useEffect(() => {
    setAuthed(readSessionUser() !== null);
  }, []);

  // Avoid flash: render nothing until hydration is done
  if (authed === null) return null;

  if (!authed) {
    return <LoginPage onSuccess={() => { window.location.reload(); }} />;
  }

  return (
    <div className="app-layout">
      <AppSidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
