'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const METRICS = [
  { label: 'MTTR (Mean Time to Resolve)', value: '2h 34m', trend: '-18m', positive: true, sparkData: [80, 75, 85, 70, 65, 72, 60, 155, 154, 153] },
  { label: 'MTTA (Mean Time to Acknowledge)', value: '11m', trend: '-3m', positive: true, sparkData: [18, 16, 20, 14, 17, 13, 15, 12, 14, 11] },
  { label: 'Incident Volume (7d)', value: '124', trend: '+8%', positive: false, sparkData: [14, 18, 17, 20, 16, 19, 20] },
  { label: 'SLA Compliance', value: '94.2%', trend: '+1.1%', positive: true, sparkData: [91, 92, 90, 93, 92, 94, 95, 94, 93, 94] },
  { label: 'Auto-Resolved', value: '37%', trend: '+5%', positive: true, sparkData: [28, 30, 29, 32, 31, 33, 35, 34, 36, 37] },
  { label: 'P0 / P1 Incidents (7d)', value: '6', trend: '-2', positive: true, sparkData: [10, 9, 8, 11, 7, 9, 8, 6, 7, 6] },
];

const SEVERITY_DIST = [
  { label: 'Critical', count: 6, pct: 8, color: '#ff5b5b' },
  { label: 'High', count: 18, pct: 24, color: '#f59e0b' },
  { label: 'Medium', count: 31, pct: 42, color: '#3b82f6' },
  { label: 'Low', count: 19, pct: 26, color: '#6b7280' },
];

const SOURCES = [
  { name: 'Prometheus', count: 42 },
  { name: 'ServiceNow', count: 28 },
  { name: 'PagerDuty', count: 21 },
  { name: 'Datadog', count: 18 },
  { name: 'Splunk', count: 9 },
  { name: 'Manual', count: 6 },
];

const DAILY = [
  { day: 'Mon', open: 18, resolved: 14 },
  { day: 'Tue', open: 22, resolved: 20 },
  { day: 'Wed', open: 16, resolved: 17 },
  { day: 'Thu', open: 25, resolved: 21 },
  { day: 'Fri', open: 19, resolved: 22 },
  { day: 'Sat', open: 12, resolved: 13 },
  { day: 'Sun', open: 8, resolved: 9 },
];

const maxDaily = Math.max(...DAILY.flatMap(d => [d.open, d.resolved]));

export default function AnalyticsPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canViewAnalytics) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Analytics</div>
            <div className="page-subtitle">Analytics is available for Customer Admin and Platform Admin roles.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Customer Admin or Platform Admin to view SLA, MTTR, and incident analytics.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-subtitle">Last 7 days · operational metrics</div>
        </div>
        <button className="btn-secondary">⬇ Export CSV</button>
      </div>

      {/* KPI Cards */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        {METRICS.map((m) => (
          <div key={m.label} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontSize: '0.72rem', color: m.positive ? 'var(--color-green)' : 'var(--color-coral)', marginTop: '0.3rem' }}>
                  {m.positive ? '▲' : '▼'} {m.trend} vs prev week
                </div>
              </div>
              {/* Mini spark */}
              <svg width="60" height="28" viewBox={`0 0 60 28`}>
                <polyline
                  fill="none"
                  stroke={m.positive ? 'var(--color-cyan)' : 'var(--color-coral)'}
                  strokeWidth="1.5"
                  points={m.sparkData.map((v, i) => {
                    const mx = Math.max(...m.sparkData);
                    const mn = Math.min(...m.sparkData);
                    const x = (i / (m.sparkData.length - 1)) * 58 + 1;
                    const y = 26 - ((v - mn) / (mx - mn || 1)) * 24;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
        {/* Daily bar chart */}
        <div className="glass-card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>Daily Incidents — Opened vs Resolved</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: '120px' }}>
            {DAILY.map((d) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end' }}>
                  <div style={{ width: '10px', background: 'var(--color-coral)', borderRadius: '2px 2px 0 0', height: `${(d.open / maxDaily) * 100}px` }} title={`Open: ${d.open}`} />
                  <div style={{ width: '10px', background: 'var(--color-green)', borderRadius: '2px 2px 0 0', height: `${(d.resolved / maxDaily) * 100}px` }} title={`Resolved: ${d.resolved}`} />
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{d.day}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.7rem' }}>
            <span><span style={{ color: 'var(--color-coral)' }}>■</span> Opened</span>
            <span><span style={{ color: 'var(--color-green)' }}>■</span> Resolved</span>
          </div>
        </div>

        {/* Severity donut */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>Severity Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {SEVERITY_DIST.map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                  <span style={{ color: s.color }}>{s.label}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{s.count} ({s.pct}%)</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Top Sources</div>
            {SOURCES.map(s => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                <span>{s.name}</span><span>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
