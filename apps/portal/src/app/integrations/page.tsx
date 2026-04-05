'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

type IntegrationStatus = 'connected' | 'degraded' | 'disconnected';

interface IntegrationDemo {
  id: string;
  name: string;
  vendor: string;
  type: string;
  status: IntegrationStatus;
  lastSync: string;
  events: number;
  icon: string;
  description: string;
  capabilities: string[];
  proof: string;
}

const INTEGRATIONS: IntegrationDemo[] = [
  {
    id: 'int-001',
    name: 'ServiceNow',
    vendor: 'ServiceNow',
    type: 'ITSM',
    status: 'connected',
    lastSync: '2m ago',
    events: 1842,
    icon: '🟠',
    description: 'Incident and CMDB sync with change intelligence and bidirectional ticket updates.',
    capabilities: ['Incident ingest', 'CMDB lookups', 'Change sync'],
    proof: 'Processed INC-3001 gateway timeout and CHG-8821 WAF change evidence.',
  },
  {
    id: 'int-002',
    name: 'PagerDuty',
    vendor: 'PagerDuty',
    type: 'Alerting',
    status: 'connected',
    lastSync: '30s ago',
    events: 4291,
    icon: '🟢',
    description: 'On-call escalation events, incident acknowledgements, and responder workflow capture.',
    capabilities: ['Escalations', 'Acknowledge', 'Resolve alerts'],
    proof: 'Correlated the Vault certificate expiry escalation with incident INC-3002.',
  },
  {
    id: 'int-003',
    name: 'Jira',
    vendor: 'Atlassian',
    type: 'Project',
    status: 'connected',
    lastSync: '5m ago',
    events: 731,
    icon: '🔵',
    description: 'Issue ingestion, workflow updates, and vendor advisory linking for engineering follow-up.',
    capabilities: ['Issue sync', 'Workflow state', 'Advisory tracking'],
    proof: 'Captured webhook backlog incident INC-3008 and advisory HCSB-2026-001.',
  },
  {
    id: 'int-004',
    name: 'Slack',
    vendor: 'Slack',
    type: 'Messaging',
    status: 'connected',
    lastSync: '1m ago',
    events: 12047,
    icon: '🟣',
    description: 'Alert fan-out, threaded incident updates, and human approval handoffs from the portal.',
    capabilities: ['Channel alerts', 'Thread updates', 'Operator approvals'],
    proof: 'Posted Grafana alert-storm suppression notices to #ops-war-room in 14 seconds.',
  },
  {
    id: 'int-005',
    name: 'Datadog',
    vendor: 'Datadog',
    type: 'Monitoring',
    status: 'degraded',
    lastSync: '18m ago',
    events: 8834,
    icon: '🟡',
    description: 'APM, host, and monitor ingestion for replica lag, Kubernetes OOM, and latency anomalies.',
    capabilities: ['Monitor ingest', 'Log queries', 'Trace evidence'],
    proof: 'Detected pg-replica-03 lag and worker-node-07 NotReady before manual escalation.',
  },
  {
    id: 'int-006',
    name: 'Splunk',
    vendor: 'Cisco Splunk',
    type: 'Log Analysis',
    status: 'connected',
    lastSync: '6m ago',
    events: 2147,
    icon: '🟥',
    description: 'Structured log forwarding, query pivots, and timeline reconstruction for root-cause analysis.',
    capabilities: ['Log ingest', 'Search pivots', 'Incident timelines'],
    proof: 'Reconstructed the orchestrator retry failure chain for int.sync dispatch errors.',
  },
  {
    id: 'int-007',
    name: 'GitHub',
    vendor: 'GitHub',
    type: 'SCM',
    status: 'connected',
    lastSync: '8m ago',
    events: 319,
    icon: '⚫',
    description: 'PR, workflow, and deployment telemetry linked to incidents and rollback recommendations.',
    capabilities: ['Workflow events', 'PR evidence', 'Deployment traceability'],
    proof: 'Mapped failed rollout metadata to the correlation-engine throughput regression.',
  },
  {
    id: 'int-008',
    name: 'AWS CloudWatch',
    vendor: 'AWS',
    type: 'Cloud',
    status: 'connected',
    lastSync: '3m ago',
    events: 5621,
    icon: '🟠',
    description: 'Cloud infrastructure alarms and log insights for node health, queues, and managed services.',
    capabilities: ['Alarm ingest', 'Metric streams', 'Log insights'],
    proof: 'Confirmed worker-node-07 saturation with EC2 and EKS control-plane alarms.',
  },
  {
    id: 'int-009',
    name: 'Prometheus',
    vendor: 'Prometheus',
    type: 'Metrics',
    status: 'connected',
    lastSync: '44s ago',
    events: 10231,
    icon: '🟧',
    description: 'Primary metric and alert signal feed for CE, API, Neo4j, and LLM latency anomalies.',
    capabilities: ['Alert rules', 'Metric ingest', 'SLO breach evidence'],
    proof: 'Raised p95 Neo4j and LLM P99 latency signals that seeded cg-3003 and cg-3004.',
  },
  {
    id: 'int-010',
    name: 'Grafana',
    vendor: 'Grafana Labs',
    type: 'Observability',
    status: 'connected',
    lastSync: '55s ago',
    events: 1688,
    icon: '🟠',
    description: 'Dashboard annotations, image snapshots, and alert rule context for operators.',
    capabilities: ['Alert images', 'Dashboard links', 'Annotation sync'],
    proof: 'Attached panel snapshots to the 22-minute data-gap and duplicate alert incidents.',
  },
  {
    id: 'int-011',
    name: 'Zabbix',
    vendor: 'Zabbix',
    type: 'Infrastructure',
    status: 'connected',
    lastSync: '9m ago',
    events: 911,
    icon: '🟩',
    description: 'Host and problem telemetry for bare-metal and legacy infrastructure outside Kubernetes.',
    capabilities: ['Problem sync', 'Host health', 'Legacy estate coverage'],
    proof: 'Imported disaster-level host alerts for edge routers during synthetic failover drills.',
  },
  {
    id: 'int-012',
    name: 'Keycloak',
    vendor: 'Red Hat',
    type: 'Identity',
    status: 'connected',
    lastSync: '7m ago',
    events: 644,
    icon: '🟦',
    description: 'Identity health, realm configuration drift, and login anomaly evidence for auth incidents.',
    capabilities: ['Realm health', 'SSO anomalies', 'Auth event ingest'],
    proof: 'Flagged the 5.3% login failure burst behind incident INC-3007.',
  },
];

const VENDOR_FAMILIES = ['ITSM', 'Alerting', 'Observability', 'SCM', 'Messaging', 'Cloud', 'Identity'];

const STATUS_STYLES: Record<IntegrationStatus, { color: string; label: string }> = {
  connected: { color: 'var(--color-green)', label: 'Connected' },
  degraded: { color: 'var(--color-amber)', label: 'Degraded' },
  disconnected: { color: 'var(--color-coral)', label: 'Disconnected' },
};

export default function IntegrationsPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);
  const types = ['All', ...Array.from(new Set(INTEGRATIONS.map(i => i.type)))];
  const filtered = filter === 'All' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.type === filter);

  if (!capabilities.canManageIntegrations) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Integrations</div>
            <div className="page-subtitle">Integration administration is available only to customer and platform administrators.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Customer Admin or Platform Admin to review or manage customer integrations.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Integrations</div>
          <div className="page-subtitle">
            {INTEGRATIONS.length} vendor examples ·{' '}
            {INTEGRATIONS.filter(i => i.status === 'connected').length} connected ·{' '}
            {INTEGRATIONS.filter(i => i.status === 'degraded').length} degraded ·{' '}
            {INTEGRATIONS.filter(i => i.status === 'disconnected').length} disconnected
          </div>
        </div>
        <button className="btn-primary">＋ Add Integration</button>
      </div>

      <div className="filter-bar">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={filter === t ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Coverage proof</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: '46rem', lineHeight: 1.5 }}>
              Demo evidence spans incidents, alerts, metrics, log timelines, vendor advisories, and deployment events across the supported vendor families.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {VENDOR_FAMILIES.map((family) => (
              <span key={family} className="pill pill-violet" style={{ fontSize: '0.68rem' }}>
                {family}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '1.5rem' }}>
        {filtered.map((intg) => {
          const s = STATUS_STYLES[intg.status];
          return (
            <div key={intg.id} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{intg.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{intg.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{intg.vendor} · {intg.type}</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color }}>● {s.label}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {intg.description}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                {intg.capabilities.map((capability) => (
                  <span key={capability} className="pill pill-cyan" style={{ fontSize: '0.66rem' }}>
                    {capability}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: '0.9rem' }}>
                Proof: {intg.proof}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                <span>🔄 Last sync: {intg.lastSync}</span>
                <span>📡 {intg.events.toLocaleString()} events</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '0.35rem', fontSize: '0.74rem' }}>Configure</button>
                {intg.status !== 'connected' && (
                  <button className="btn-primary" style={{ flex: 1, padding: '0.35rem', fontSize: '0.74rem' }}>Reconnect</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
