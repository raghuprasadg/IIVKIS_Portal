'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readConsoleMode, saveConsoleMode, type ConsoleMode } from './lib/console-mode';

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
  const [mode, setMode] = useState<ConsoleMode>('operator');

  useEffect(() => {
    setMode(readConsoleMode());
  }, []);

  const switchMode = (next: ConsoleMode) => {
    saveConsoleMode(next);
    setMode(next);
    window.location.reload();
  };

  const roleLabel = mode === 'operator'
    ? 'Operator'
    : mode === 'end-user'
      ? 'End User'
      : 'Logged Out';
  const avatar = mode === 'operator' ? 'OP' : mode === 'end-user' ? 'EU' : '--';

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

      <div className="sidebar-footer">
        <div className="user-avatar">{avatar}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{roleLabel}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
            {mode === 'operator' ? 'Platform Console' : mode === 'end-user' ? 'Customer Console' : 'Session ended'}
          </div>
        </div>
        <span className="version-badge">v0.5.0</span>
      </div>

      <div style={{ padding: '0.65rem 1rem 1rem', borderTop: '1px solid var(--color-glass-border)' }}>
        {mode === 'logged-out' ? (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <button className="btn-primary" style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.74rem' }} onClick={() => switchMode('operator')}>
              Login As Operator
            </button>
            <button className="btn-ghost" style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.74rem' }} onClick={() => switchMode('end-user')}>
              Login As End User
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <button className="btn-ghost" style={{ width: '100%', padding: '0.42rem 0.65rem', fontSize: '0.72rem' }} onClick={() => switchMode(mode === 'operator' ? 'end-user' : 'operator')}>
              Switch To {mode === 'operator' ? 'End User' : 'Operator'} Console
            </button>
            <button className="btn-ghost" style={{ width: '100%', padding: '0.42rem 0.65rem', fontSize: '0.72rem', borderColor: 'rgba(255,107,107,0.35)', color: 'var(--color-coral)' }} onClick={() => switchMode('logged-out')}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
