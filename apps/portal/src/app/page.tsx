'use client';

import { useEffect, useState } from 'react';
import { isConsoleAuthenticated, readConsoleMode, type ConsoleMode } from './lib/console-mode';

const OPERATOR_METRIC_CARDS = [
  { title: 'Active Tenants', value: '42', icon: '🏢', color: 'var(--color-cyan)', trend: '+2', trendDir: 'up' as const },
  { title: 'Resource Utilization', value: '71%', icon: '🖥️', color: 'var(--color-amber)', trend: '+4%', trendDir: 'up' as const },
  { title: 'Telemetry Throughput', value: '12.4k/s', icon: '📡', color: 'var(--color-violet)', trend: '+1.8k/s', trendDir: 'up' as const },
  { title: 'Billing Generated', value: '$84,290', icon: '💳', color: 'var(--color-green)', trend: '+$3,410', trendDir: 'up' as const },
] as const;

const END_USER_METRIC_CARDS = [
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
  { id: 'INC-2398', title: 'PagerDuty escalation on Vault TLS expiry', severity: 'high', status: 'Assigned', time: '34m ago' },
  { id: 'INC-2395', title: 'Prometheus detected Neo4j latency spike', severity: 'medium', status: 'Investigating', time: '1h ago' },
  { id: 'INC-2389', title: 'Datadog flagged replica lag drift', severity: 'high', status: 'Monitoring', time: '1h ago' },
  { id: 'INC-2384', title: 'GitHub rollback after CE regression', severity: 'medium', status: 'Resolved', time: '2h ago' },
] as const;

const CORRELATIONS = [
  { id: 'CG-041', name: 'API Timeout + DB Slow Query Cluster', confidence: 87, signals: 14, cis: ['api-gw-01', 'pg-primary', 'snow-conn-pool'] },
  { id: 'CG-040', name: 'Vault Auth Errors → Keycloak Degradation', confidence: 72, signals: 8, cis: ['vault-01', 'keycloak-01'] },
  { id: 'CG-039', name: 'Redis Eviction → Session Loss Pattern', confidence: 91, signals: 22, cis: ['redis-cluster', 'portal-app', 'auth-svc'] },
] as const;

const SPARK_HEIGHTS = [35, 55, 40, 70, 45, 80, 60, 90, 50, 75, 85, 65] as const;
const VENDOR_PROOF = [
  { vendor: 'ServiceNow', example: 'INC-3001 + CHG-8821' },
  { vendor: 'PagerDuty', example: 'Vault expiry escalation' },
  { vendor: 'Jira', example: 'Webhook backlog replay' },
  { vendor: 'Datadog', example: 'Replica lag + node OOM' },
  { vendor: 'Grafana', example: 'Alert storm snapshots' },
  { vendor: 'GitHub', example: 'Rollback trace' },
  { vendor: 'CloudWatch', example: 'EKS alarm correlation' },
  { vendor: 'Zabbix', example: 'Legacy edge alert import' },
] as const;

export default function DashboardPage() {
  const [time, setTime] = useState('');
  const [mode, setMode] = useState<ConsoleMode>('operator');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMode(readConsoleMode());
  }, []);

  const metricCards = mode === 'operator' ? OPERATOR_METRIC_CARDS : END_USER_METRIC_CARDS;

  if (!isConsoleAuthenticated(mode)) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div className="page-title" style={{ marginBottom: '0.5rem' }}>Session Logged Out</div>
          <div className="page-subtitle">Use the sidebar to login as Operator or End User.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">IIVKIS Operations Dashboard</div>
          <div className="page-subtitle">
            {mode === 'operator'
              ? 'Operator console · tenant governance, telemetry and billing'
              : 'End-user console · customer incident intelligence'}
          </div>
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
        {metricCards.map((card) => (
          <div key={card.title} className="glass-card metric-card">
            <div className="metric-card-header">
              <span className="metric-card-title">{card.title}</span>
              <span className="metric-card-icon">{card.icon}</span>
            </div>
            <div className="metric-card-value" style={{ color: card.color }}>{card.value}</div>
            <div className={`metric-card-trend trend-${card.trendDir === 'up' ? 'up' : 'down'}`}>
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
              { name: 'Prometheus', status: 'Synced', ok: true },
              { name: 'Datadog', status: 'Delayed 3m', ok: false },
              { name: 'GitHub', status: 'Synced', ok: true },
              { name: 'CloudWatch', status: 'Synced', ok: true },
            ].map((int) => (
              <div key={int.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{int.name}</span>
                <span className={int.ok ? 'pill pill-green' : 'pill pill-cyan'} style={{ fontSize: '0.68rem' }}>
                  {int.ok ? '✓ ' : '⚠ '}{int.status}
                </span>
              </div>
            ))}
          </div>

          {mode === 'operator' ? (
            <div className="glass-card section-card" style={{ flex: 1 }}>
              <div className="section-title"><span>📦</span> Tenant Capacity</div>
              {[
                { label: 'T1 Tenants', value: '28' },
                { label: 'T2 Tenants', value: '11' },
                { label: 'T3 Tenants', value: '3' },
                { label: 'Noisy Tenant Alerts', value: '2' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.77rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card section-card" style={{ flex: 1 }}>
              <div className="section-title"><span>🧪</span> Vendor Proof</div>
              {VENDOR_PROOF.map((item) => (
                <div key={item.vendor} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.55rem', fontSize: '0.77rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{item.vendor}</span>
                  <span style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}>{item.example}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
