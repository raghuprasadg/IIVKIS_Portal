'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

import {
  FALLBACK_CORRELATION_ENGINES,
  type CorrelationEngineDefinition,
} from './engine-catalog';

const GROUPS = [
  {
    id: 'CG-041',
    name: 'API Timeout + DB Slow Query Cluster',
    confidence: 87,
    signals: 14,
    status: 'Active',
    cis: ['api-gw-01', 'pg-primary', 'snow-conn-pool'],
    incidents: ['INC-2401', 'INC-2395'],
    firstSeen: '2024-01-15 14:10',
    lastSeen: '2024-01-15 14:45',
    description: 'Cascading timeout pattern — connection pool exhaustion on pg-primary causing upstream API gateway failures.',
  },
  {
    id: 'CG-040',
    name: 'Vault Auth Errors → Keycloak Degradation',
    confidence: 72,
    signals: 8,
    status: 'Investigating',
    cis: ['vault-01', 'keycloak-01'],
    incidents: ['INC-2398'],
    firstSeen: '2024-01-15 13:50',
    lastSeen: '2024-01-15 14:20',
    description: 'Vault certificate renewal failure causing downstream Keycloak OIDC token validation errors.',
  },
  {
    id: 'CG-039',
    name: 'Redis Eviction → Session Loss Pattern',
    confidence: 91,
    signals: 22,
    status: 'Resolved',
    cis: ['redis-cluster', 'portal-app', 'auth-svc'],
    incidents: ['INC-2388', 'INC-2382'],
    firstSeen: '2024-01-15 11:25',
    lastSeen: '2024-01-15 13:00',
    description: 'Redis maxmemory eviction of session keys causing user session loss and SSO re-auth storms.',
  },
  {
    id: 'CG-038',
    name: 'Neo4j GC Pause → Query Timeout Chain',
    confidence: 64,
    signals: 6,
    status: 'Closed',
    cis: ['neo4j-01', 'knowledge-svc'],
    incidents: ['INC-2375'],
    firstSeen: '2024-01-14 22:00',
    lastSeen: '2024-01-14 23:30',
    description: 'JVM garbage collection pauses on Neo4j causing graph query timeouts in the knowledge service.',
  },
];

const STATUS_COLOR: Record<string, string> = {
  Active: 'var(--color-coral)',
  Investigating: 'var(--color-amber)',
  Resolved: 'var(--color-green)',
  Closed: 'var(--color-text-muted)',
};

export default function CorrelationsPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [engines, setEngines] = useState<CorrelationEngineDefinition[]>(
    FALLBACK_CORRELATION_ENGINES,
  );
  const capabilities = getRoleCapabilities(sessionUser);
  const detail = GROUPS.find(g => g.id === selected);
  const coreEngines = engines.filter(engine => !engine.advanced);
  const advancedEngines = engines.filter(engine => engine.advanced);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

    async function loadCorrelationEngines(): Promise<void> {
      try {
        const response = await fetch(`${base}/api/v1/public/correlation/engines`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          data?: CorrelationEngineDefinition[];
        };

        if (Array.isArray(payload.data) && payload.data.length > 0) {
          setEngines(payload.data);
        }
      } catch {
        // Keep shared fallback catalog when API is unavailable.
      }
    }

    void loadCorrelationEngines();
    return () => controller.abort();
  }, []);

  if (!capabilities.canUseCorrelations) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Correlation Groups</div>
            <div className="page-subtitle">Correlation workflows are reserved for engineering and platform roles.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Company Admins do not manage incident-correlation groups. Sign in as Company Engineer or Platform Admin for RCA and signal-cluster workflows.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Correlation Groups</div>
          <div className="page-subtitle">{GROUPS.filter(g => g.status === 'Active' || g.status === 'Investigating').length} active · AI-detected signal clusters</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {GROUPS.map((g) => (
            <div
              key={g.id}
              className="glass-card"
              style={{ padding: '1.25rem', cursor: 'pointer', border: selected === g.id ? '1px solid var(--color-cyan)' : undefined }}
              onClick={() => setSelected(selected === g.id ? null : g.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{g.id}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_COLOR[g.status] }}>● {g.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{g.signals} signals</span>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: `conic-gradient(var(--color-cyan) ${g.confidence * 3.6}deg, rgba(255,255,255,0.05) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700 }}>
                    {g.confidence}%
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{g.name}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {g.cis.map(ci => (
                  <span key={ci} style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-violet)', fontSize: '0.68rem', padding: '0.1rem 0.5rem', borderRadius: '999px', border: '1px solid rgba(139,92,246,0.2)' }}>{ci}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {detail && (
          <div className="glass-card" style={{ padding: '1.5rem', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--color-cyan)', fontWeight: 700 }}>{detail.id}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>{detail.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>{detail.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Confidence', `${detail.confidence}%`], ['Signals', detail.signals], ['First Seen', detail.firstSeen], ['Last Seen', detail.lastSeen]].map(([k, v]) => (
                <div key={String(k)} className="glass-card" style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{k}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>LINKED INCIDENTS</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {detail.incidents.map(inc => <span key={inc} className="badge badge-warning">{inc}</span>)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
            Correlation Engines
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {engines.length} engines active: {coreEngines.length} core use cases and {advancedEngines.length} advanced differentiators.
          </div>
        </div>

        <div style={{ marginBottom: '0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Core Correlation Use Cases
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
          {coreEngines.map(engine => (
            <div key={engine.id} className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.3 }}>{engine.title}</div>
                <span className="badge badge-info">E-{engine.id.toString().padStart(2, '0')}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>How:</strong> {engine.how}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>Flow:</strong> {engine.flow}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>Requirement:</strong> {engine.requirement}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-green)', marginBottom: '0.25rem' }}>
                <strong>Solves:</strong> {engine.solves}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                <strong>Why:</strong> {engine.why}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.1rem', marginBottom: '0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Advanced Correlation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
          {advancedEngines.map(engine => (
            <div key={engine.id} className="glass-card" style={{ padding: '1rem', border: '1px solid rgba(0,212,255,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.8rem' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.3 }}>{engine.title}</div>
                <span className="badge badge-success">E-{engine.id.toString().padStart(2, '0')}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>How:</strong> {engine.how}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>Flow:</strong> {engine.flow}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                <strong>Requirement:</strong> {engine.requirement}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-green)', marginBottom: '0.25rem' }}>
                <strong>Solves:</strong> {engine.solves}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                <strong>Why:</strong> {engine.why}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
