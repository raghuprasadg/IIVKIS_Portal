'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const STREAMS = [
  { name: 'Incidents', source: 'ServiceNow, Jira, PagerDuty', rate: '2.1k/day', retention: '365 days' },
  { name: 'Metrics', source: 'Prometheus, Datadog, CloudWatch', rate: '8.4M/day', retention: '90 days' },
  { name: 'Logs', source: 'Splunk, Zabbix, Grafana', rate: '215 GB/day', retention: '30 days' },
  { name: 'Identity events', source: 'Keycloak, Vault', rate: '140k/day', retention: '180 days' },
] as const;

export default function TelemetryPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canViewTelemetry) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Telemetry</div>
            <div className="page-subtitle">Telemetry controls are reserved for company and platform administration.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Company Admin or Platform Admin to review ingestion budgets, retention, and export policies.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Telemetry</div>
          <div className="page-subtitle">Signal streams, retention policy, and ingest governance</div>
        </div>
        <button className="btn-secondary">Export Telemetry Policy</button>
      </div>

      <div className="glass-card" style={{ padding: '1.25rem' }}>
        {STREAMS.map((stream) => (
          <div key={stream.name} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.8fr 0.8fr', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontWeight: 600 }}>{stream.name}</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{stream.source}</div>
            <div style={{ color: 'var(--color-cyan)' }}>{stream.rate}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>{stream.retention}</div>
          </div>
        ))}
      </div>
    </div>
  );
}