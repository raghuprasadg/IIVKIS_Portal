'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const TICKETS = [
  { id: 'PLAT-1184', title: 'Increase Datadog ingest allowance for weekend load tests', status: 'Awaiting platform review', owner: 'Platform Ops' },
  { id: 'PLAT-1176', title: 'Add GitHub Enterprise webhook endpoint for production org', status: 'In progress', owner: 'Connector Engineering' },
  { id: 'PLAT-1171', title: 'Validate ServiceNow connector failover policy before renewal', status: 'Resolved', owner: 'Platform Ops' },
] as const;

export default function PlatformSupportPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canRaisePlatformTickets) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Platform Tickets</div>
            <div className="page-subtitle">Platform support requests are reserved for company and platform administration.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Company Admin or Platform Admin to raise tickets with the platform team.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Platform Tickets</div>
          <div className="page-subtitle">Raise requests with the IIVKIS platform team for subscription, capacity, and connector work</div>
        </div>
        <button className="btn-primary">New Ticket</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Open requests</div>
          {TICKETS.map((ticket) => (
            <div key={ticket.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
                <span className="pill pill-violet">{ticket.id}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{ticket.owner}</span>
              </div>
              <div style={{ marginBottom: '0.25rem' }}>{ticket.title}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.76rem' }}>{ticket.status}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Suggested request categories</div>
          {['Subscription changes', 'Connector onboarding', 'Telemetry budget adjustments', 'Billing dispute', 'SLA review', 'Retention policy exception'].map((category) => (
            <div key={category} style={{ marginBottom: '0.65rem', color: 'var(--color-text-secondary)' }}>
              • {category}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}