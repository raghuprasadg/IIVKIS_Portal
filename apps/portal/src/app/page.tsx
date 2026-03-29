'use client';

import { useEffect, useState } from 'react';

const METRIC_CARDS = [
  { title: 'Active Incidents', value: '24', icon: '🚨', color: 'var(--color-coral)', trend: '+3', trendDir: 'up' as const },
  { title: 'Correlation Groups', value: '7', icon: '🔗', color: 'var(--color-cyan)', trend: '-2', trendDir: 'down' as const },
  { title: 'Knowledge Articles', value: '1,248', icon: '📚', color: 'var(--color-violet)', trend: '+12', trendDir: 'up' as const },
  { title: 'Avg Resolution', value: '2h 34m', icon: '⏱️', color: 'var(--color-amber)', trend: '-18m', trendDir: 'down' as const },
] as const;

const SERVICES = [
  { name: 'PostgreSQL', status: 'healthy' as const },
  { name: 'Redis', status: 'healthy' as const },
  { name: 'Neo4j', status: 'healthy' as const },
  { name: 'Keycloak', status: 'healthy' as const },
  { name: 'Vault', status: 'healthy' as const },
  { name: 'Prometheus', status: 'healthy' as const },
  { name: 'Grafana', status: 'healthy' as const },
  { name: 'API', status: 'healthy' as const },
] as const;

const RECENT_INCIDENTS = [
  { id: 'INC-2401', title: 'ServiceNow API timeout cascade', severity: 'critical', status: 'In Progress', time: '12m ago' },
  { id: 'INC-2398', title: 'Vault certificate renewal failure', severity: 'high', status: 'Assigned', time: '34m ago' },
  { id: 'INC-2395', title: 'Neo4j query latency spike', severity: 'medium', status: 'Investigating', time: '1h ago' },
  { id: 'INC-2391', title: 'Grafana dashboard data gaps', severity: 'low', status: 'Monitoring', time: '2h ago' },
  { id: 'INC-2388', title: 'Redis memory threshold warning', severity: 'medium', status: 'Resolved', time: '3h ago' },
] as const;

const CORRELATIONS = [
  { id: 'CG-041', name: 'API Timeout + DB Slow Query Cluster', confidence: 87, signals: 14, cis: ['api-gw-01', 'pg-primary', 'snow-conn-pool'] },
  { id: 'CG-040', name: 'Vault Auth Errors → Keycloak Degradation', confidence: 72, signals: 8, cis: ['vault-01', 'keycloak-01'] },
  { id: 'CG-039', name: 'Redis Eviction → Session Loss Pattern', confidence: 91, signals: 22, cis: ['redis-cluster', 'portal-app', 'auth-svc'] },
] as const;

const SPARK_HEIGHTS = [35, 55, 40, 70, 45, 80, 60, 90, 50, 75, 85, 65] as const;

export default function DashboardPage() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">IIVKIS Operations Dashboard</div>
          <div className="page-subtitle">Real-time infrastructure intelligence</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="metric-value" style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {time}
          </span>
          <span className="status-badge online">All Systems Operational</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        {METRIC_CARDS.map((card) => (
          <div key={card.title} className="glass-card metric-card">
            <div className="metric-card-header">
              <span className="metric-card-title">{card.title}</span>
              <span className="metric-card-icon">{card.icon}</span>
            </div>
            <div className="metric-card-value" style={{ color: card.color }}>{card.value}</div>
            <div className={`metric-card-trend trend-${card.trendDir === 'up' ? (card.title === 'Knowledge Articles' ? 'down' : 'up') : 'down'}`}>
              <span>{card.trendDir === 'up' ? '▲' : '▼'}</span>
              <span>{card.trend} from yesterday</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
        {/* Service Health */}
        <div className="glass-card section-card">
          <div className="section-title">
            <span className="section-title-icon">🟢</span>
            Service Health
          </div>
          <div className="service-grid">
            {SERVICES.map((svc) => (
              <div key={svc.name} className="service-chip">
                <div className={`service-dot ${svc.status}`} />
                <span>{svc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="glass-card section-card">
          <div className="section-title">
            <span className="section-title-icon">🚨</span>
            Recent Incidents
          </div>
          <table className="incidents-table">
            <thead>
              <tr>
                <th>Sev</th>
                <th>Title</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_INCIDENTS.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <span className={`sev-badge sev-${inc.severity}`}>{inc.severity.slice(0, 4)}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-primary)', maxWidth: '160px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{inc.id}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{inc.title}</div>
                  </td>
                  <td>
                    <span className="pill pill-cyan" style={{ fontSize: '0.68rem' }}>{inc.status}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>{inc.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Correlation Activity */}
        <div className="glass-card section-card">
          <div className="section-title">
            <span className="section-title-icon">🔗</span>
            Correlation Activity
          </div>
          {CORRELATIONS.map((cg) => (
            <div key={cg.id} className="correlation-item">
              <div className="correlation-name">{cg.name}</div>
              <div className="correlation-meta">
                <span className="pill pill-violet" style={{ marginRight: '6px' }}>{cg.id}</span>
                {cg.signals} signals · {cg.cis.join(', ')}
              </div>
              <div className="confidence-bar-wrap">
                <div className="confidence-bar-header">
                  <span style={{ color: 'var(--color-text-muted)' }}>Confidence</span>
                  <span style={{ color: 'var(--color-cyan)', fontFamily: "'JetBrains Mono', monospace" }}>{cg.confidence}%</span>
                </div>
                <div className="confidence-bar-track">
                  <div className="confidence-bar-fill" style={{ width: `${cg.confidence}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats placeholder right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Token Usage */}
          <div className="glass-card section-card" style={{ flex: 1 }}>
            <div className="section-title"><span>🪙</span> Token Usage</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              <span>Monthly Budget</span>
              <span className="metric-value">68,420 / 100,000</span>
            </div>
            <div className="token-bar-wrap">
              <div className="token-bar-track">
                <div className="token-bar-fill" style={{ width: '68%' }} />
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>68% used · resets in 12 days</div>
          </div>

          {/* KA Search Volume */}
          <div className="glass-card section-card" style={{ flex: 1 }}>
            <div className="section-title"><span>📈</span> KA Search Volume</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Last 12 hours</div>
            <div className="sparkline">
              {SPARK_HEIGHTS.map((h, i) => (
                <div key={i} className="spark-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* Integration Sync */}
          <div className="glass-card section-card" style={{ flex: 1 }}>
            <div className="section-title"><span>🔌</span> Integration Sync</div>
            {[
              { name: 'ServiceNow', status: 'Synced', ok: true },
              { name: 'Jira', status: 'Synced', ok: true },
              { name: 'PagerDuty', status: 'Delayed 3m', ok: false },
            ].map((int) => (
              <div key={int.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{int.name}</span>
                <span className={int.ok ? 'pill pill-green' : 'pill pill-cyan'} style={{ fontSize: '0.68rem' }}>
                  {int.ok ? '✓ ' : '⚠ '}{int.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
