'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const UTILIZATION_AREAS = [
  { label: 'LLM token pool', usage: 68, value: '68,420 / 100,000', note: 'On track for month-end budget' },
  { label: 'Connector capacity', usage: 92, value: '11 / 12 active', note: 'One slot remains before expansion request' },
  { label: 'Analyst seats', usage: 80, value: '68 / 85 assigned', note: '17 seats remain across Acme teams' },
  { label: 'Telemetry ingest', usage: 73, value: '14.6 / 20 TB', note: 'Watch weekend load-test burst' },
] as const;

export default function UtilizationPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canViewUtilization) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Utilization</div>
            <div className="page-subtitle">Utilization views are reserved for customer and platform administration.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Customer Admin or Platform Admin to review plan utilization and capacity thresholds.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Utilization</div>
          <div className="page-subtitle">Current consumption against tenant quotas and service limits</div>
        </div>
      </div>

      <div className="card-grid">
        {UTILIZATION_AREAS.map((item) => (
          <div key={item.label} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>{item.label}</span>
              <span style={{ color: 'var(--color-cyan)' }}>{item.usage}%</span>
            </div>
            <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '0.75rem' }}>
              <div style={{ width: `${item.usage}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }} />
            </div>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>{item.value}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}