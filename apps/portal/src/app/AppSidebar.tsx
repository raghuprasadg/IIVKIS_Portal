'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

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

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">IIVKIS</div>
        <div className="sidebar-logo-sub">Operations Portal</div>
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
        <div className="user-avatar">OP</div>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Operator</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Admin</div>
        </div>
        <span className="version-badge">v0.5.0</span>
      </div>
    </nav>
  );
}
