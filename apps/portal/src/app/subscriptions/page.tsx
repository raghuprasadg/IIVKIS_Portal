'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const PACKAGES = [
  { name: 'Enterprise Core', status: 'Active', detail: 'AI chat, correlation engine, knowledge graph, 12 managed connectors', renewal: 'Renews 2026-05-17' },
  { name: 'Premium Support', status: 'Active', detail: '24x7 platform desk with 1-hour response target', renewal: 'Bundled with core term' },
  { name: 'Telemetry Burst Pack', status: 'Standby', detail: 'Additional 20 TB ingest allowance for peak periods', renewal: 'Activate on demand' },
] as const;

const ADD_ONS = [
  { name: 'Extra analyst seats', usage: '68 / 85 assigned', action: 'Increase seats' },
  { name: 'Connector expansion', usage: '11 / 12 in use', action: 'Request connector slot' },
  { name: 'Retention override', usage: '90 days enabled for P1/P0', action: 'Adjust policy' },
] as const;

export default function SubscriptionsPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canManageSubscriptions) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Subscriptions</div>
            <div className="page-subtitle">Subscription controls are reserved for customer and platform administration.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Customer Admin or Platform Admin to manage customer subscriptions and add-ons.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Subscriptions</div>
          <div className="page-subtitle">Plan entitlements, connector capacity, and renewal controls</div>
        </div>
        <button className="btn-primary">Review Renewal</button>
      </div>

      <div className="card-grid">
        {PACKAGES.map((pkg) => (
          <div key={pkg.name} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700 }}>{pkg.name}</div>
              <span className={pkg.status === 'Active' ? 'pill pill-green' : 'pill pill-cyan'}>{pkg.status}</span>
            </div>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: '0.82rem', marginBottom: '0.85rem' }}>
              {pkg.detail}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>{pkg.renewal}</div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Managed add-ons</div>
        {ADD_ONS.map((item) => (
          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>{item.usage}</div>
            </div>
            <button className="btn-secondary">{item.action}</button>
          </div>
        ))}
      </div>
    </div>
  );
}