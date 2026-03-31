'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readConsoleMode, saveConsoleMode, type ConsoleMode } from './lib/console-mode';
import { readSessionUser, clearSessionUser, type DemoUser } from './lib/demo-users';
import LoginForm from './LoginForm';

const NAV_ITEMS = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/chat', icon: '💬', label: 'Chat' },
  { href: '/incidents', icon: '🚨', label: 'Incidents' },
  { href: '/knowledge', icon: '📚', label: 'Knowledge' },
  { href: '/correlations', icon: '🔗', label: 'Correlations' },
  { href: '/integrations', icon: '🔌', label: 'Integrations' },
  { href: '/analytics', icon: '📈', label: 'Analytics' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
] as const;

export default function AppSidebar() {
  const pathname = usePathname();
  const [mode, setMode] = useState<ConsoleMode>('logged-out');
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    const user = readSessionUser();
    if (user) {
      setSessionUser(user);
      setMode(readConsoleMode());
    } else {
      setMode('logged-out');
    }
  }, []);

  const handleLoginSuccess = () => {
    const user = readSessionUser();
    setSessionUser(user);
    setMode(user?.mode ?? 'operator');
    window.location.reload();
  };

  const handleLogout = () => {
    clearSessionUser();
    saveConsoleMode('logged-out');
    setSessionUser(null);
    setMode('logged-out');
    window.location.reload();
  };

  const roleColor =
    sessionUser?.role === 'Operator Admin'
      ? 'var(--color-cyan)'
      : sessionUser?.role === 'Customer Admin'
        ? '#b97aff'
        : 'var(--color-amber)';

  const avatarInitials = sessionUser
    ? sessionUser.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '--';

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/iivkis-logo-nav.svg"
          alt="IIVKIS – Intelligent IT Vendor Knowledge Integration System"
          style={{ width: '100%', maxWidth: '190px', height: 'auto', display: 'block' }}
        />
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Session user footer */}
      <div className="sidebar-footer">
        <div className="user-avatar" style={{ background: sessionUser ? `linear-gradient(135deg, ${roleColor}, #0099cc)` : undefined }}>
          {avatarInitials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sessionUser ? sessionUser.displayName : 'Not signed in'}
          </div>
          <div style={{ fontSize: '0.62rem', color: roleColor, marginTop: '1px', fontWeight: 500 }}>
            {sessionUser ? sessionUser.role : 'Guest'}
          </div>
          {sessionUser && (
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {sessionUser.org}
            </div>
          )}
        </div>
        <span className="version-badge">v0.5.0</span>
      </div>

      {/* Login / logout controls */}
      <div style={{ padding: '0.65rem 1rem 0.75rem', borderTop: '1px solid var(--color-glass-border)' }}>
        {mode === 'logged-out' ? (
          <LoginForm onSuccess={handleLoginSuccess} />
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textAlign: 'center', paddingBottom: '0.2rem' }}>
              Signed in as <span style={{ color: 'var(--color-text-secondary)' }}>{sessionUser?.username}</span>
            </div>
            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '0.42rem 0.65rem', fontSize: '0.72rem', borderColor: 'rgba(255,107,107,0.35)', color: 'var(--color-coral)' }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Copyright */}
      <div style={{ padding: '0.6rem 1rem 0.75rem', borderTop: '1px solid var(--color-glass-border)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          © {new Date().getFullYear()} Raghuprasad Gundeti
        </div>
        <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', opacity: 0.7, marginTop: '1px' }}>
          All rights reserved · IIVKIS
        </div>
      </div>
    </nav>
  );
}
