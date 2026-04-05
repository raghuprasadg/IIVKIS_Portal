'use client';

import { useEffect, useState } from 'react';

import { isConsoleAuthenticated, readConsoleMode, type ConsoleMode } from '../lib/console-mode';
import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'Open' | 'In Progress' | 'Investigating' | 'Monitoring' | 'Resolved';
  assignee: string;
  created: string;
  sla: { label: string; variant: 'ok' | 'warn' | 'breach' };
  source: string;
}

interface IncidentDeepDive {
  summary: string;
  impact: string;
  hypothesis: string;
  recommendedActions: string[];
  timeline: Array<{ time: string; event: string }>;
  correlationGroup?: {
    id: string;
    name: string;
    confidence: number;
    status: string;
    description: string;
    linkedIncidents: string[];
    cis: string[];
    signals: Array<{
      id: string;
      title: string;
      severity: string;
      source: string;
      ci: string;
      occurredAt: string;
    }>;
  };
}

const ALL_INCIDENTS: Incident[] = [
  { id: 'INC-2401', title: 'ServiceNow API timeout cascade — connection pool exhausted', severity: 'critical', status: 'In Progress', assignee: 'JR', created: '2024-01-15 14:20', sla: { label: '1h 40m', variant: 'warn' }, source: 'ServiceNow' },
  { id: 'INC-2398', title: 'Vault certificate renewal failure — vault-01', severity: 'high', status: 'In Progress', assignee: 'SK', created: '2024-01-15 13:58', sla: { label: '4h 02m', variant: 'ok' }, source: 'Vault' },
  { id: 'INC-2395', title: 'Neo4j query latency spike — p95 > 3s', severity: 'medium', status: 'Investigating', assignee: 'TL', created: '2024-01-15 13:00', sla: { label: '0h 48m', variant: 'breach' }, source: 'Prometheus' },
  { id: 'INC-2391', title: 'Grafana dashboard data gaps — metrics missing', severity: 'low', status: 'Monitoring', assignee: 'AM', created: '2024-01-15 12:00', sla: { label: '6h 00m', variant: 'ok' }, source: 'Grafana' },
  { id: 'INC-2388', title: 'Redis memory threshold exceeded — eviction triggered', severity: 'medium', status: 'Resolved', assignee: 'BW', created: '2024-01-15 11:30', sla: { label: 'Resolved', variant: 'ok' }, source: 'Redis' },
  { id: 'INC-2382', title: 'Keycloak SSO login failures — 503 rate > 5%', severity: 'high', status: 'Resolved', assignee: 'JR', created: '2024-01-15 09:15', sla: { label: 'Resolved', variant: 'ok' }, source: 'Keycloak' },
  { id: 'INC-2375', title: 'Jira webhook delivery failures — integration queue backlog', severity: 'medium', status: 'Resolved', assignee: 'SK', created: '2024-01-15 08:00', sla: { label: 'Resolved', variant: 'ok' }, source: 'Jira' },
  { id: 'INC-2371', title: 'PagerDuty escalation policy misconfiguration', severity: 'low', status: 'Resolved', assignee: 'TL', created: '2024-01-14 22:45', sla: { label: 'Resolved', variant: 'ok' }, source: 'PagerDuty' },
  { id: 'INC-2368', title: 'Datadog replica lag alert — pg-replica-03 breached 87s threshold', severity: 'high', status: 'In Progress', assignee: 'JR', created: '2024-01-14 21:10', sla: { label: '2h 15m', variant: 'warn' }, source: 'Datadog' },
  { id: 'INC-2361', title: 'Splunk timeline gap — orchestrator retry chain missing 6 spans', severity: 'medium', status: 'Investigating', assignee: 'TL', created: '2024-01-14 20:34', sla: { label: '1h 05m', variant: 'warn' }, source: 'Splunk' },
  { id: 'INC-2358', title: 'GitHub deployment rollback triggered after CE throughput regression', severity: 'high', status: 'Monitoring', assignee: 'BW', created: '2024-01-14 18:40', sla: { label: '3h 22m', variant: 'ok' }, source: 'GitHub' },
  { id: 'INC-2352', title: 'AWS CloudWatch alarm storm — worker-node-07 saturation detected', severity: 'critical', status: 'Open', assignee: 'AM', created: '2024-01-14 17:05', sla: { label: '0h 32m', variant: 'breach' }, source: 'CloudWatch' },
  { id: 'INC-2351', title: 'Cisco core router BGP flap storm detected from ServiceNow sync', severity: 'high', status: 'Investigating', assignee: 'JR', created: '2024-01-14 16:44', sla: { label: '1h 58m', variant: 'warn' }, source: 'Cisco' },
  { id: 'INC-2350', title: 'Palo Alto firewall policy push rollback after deny-all drift', severity: 'critical', status: 'In Progress', assignee: 'SK', created: '2024-01-14 16:31', sla: { label: '0h 26m', variant: 'breach' }, source: 'Palo Alto' },
  { id: 'INC-2348', title: 'Fortinet HA failover jitter on edge cluster ftg-east-02', severity: 'medium', status: 'Monitoring', assignee: 'BW', created: '2024-01-14 16:08', sla: { label: '4h 34m', variant: 'ok' }, source: 'Fortinet' },
  { id: 'INC-2347', title: 'F5 BIG-IP iRule regression causing intermittent 502 bursts', severity: 'high', status: 'Open', assignee: 'TL', created: '2024-01-14 15:59', sla: { label: '0h 52m', variant: 'warn' }, source: 'F5' },
  { id: 'INC-2349', title: 'Zabbix disaster alert — edge-router-02 packet loss during failover drill', severity: 'medium', status: 'Monitoring', assignee: 'SK', created: '2024-01-14 16:15', sla: { label: '5h 10m', variant: 'ok' }, source: 'Zabbix' },
  { id: 'INC-2344', title: 'Slack war-room flood — duplicate Grafana alerts posted to incident channel', severity: 'low', status: 'Resolved', assignee: 'JR', created: '2024-01-14 15:48', sla: { label: 'Resolved', variant: 'ok' }, source: 'Slack' },
];

const PLATFORM_SOURCES = new Set([
  'ServiceNow', 'Vault', 'Prometheus', 'Grafana', 'Redis', 'Keycloak', 'Jira', 'PagerDuty',
  'Datadog', 'Splunk', 'GitHub', 'CloudWatch', 'Zabbix', 'Slack',
]);

const FALLBACK_DEEP_DIVES: Record<string, IncidentDeepDive> = {
  'INC-2401': {
    summary: 'ServiceNow request latency increased sharply after database pool saturation and upstream retries amplified load on the API gateway.',
    impact: 'Ticket sync and operator workflows intermittently timed out across the incident intake path.',
    hypothesis: 'Primary bottleneck is downstream database connection exhaustion, not the ServiceNow edge itself.',
    recommendedActions: [
      'Review connection pool saturation on pg-primary and compare with API worker concurrency.',
      'Inspect recent MID Server or integration changes that increased retry frequency.',
      'Throttle non-critical ServiceNow sync jobs until the pool returns to steady-state.',
    ],
    timeline: [
      { time: '14:10', event: 'Slow query burst started on pg-primary.' },
      { time: '14:14', event: 'Connection pool wait time crossed warning threshold.' },
      { time: '14:20', event: 'Incident INC-2401 opened from ServiceNow timeout cascade.' },
      { time: '14:45', event: 'Correlation group confidence stabilized above 85%.' },
    ],
    correlationGroup: {
      id: 'CG-041',
      name: 'API Timeout + DB Slow Query Cluster',
      confidence: 87,
      status: 'Active',
      description: 'Cascading timeout pattern linking API latency, slow DB queries, and connection pool exhaustion.',
      linkedIncidents: ['INC-2401', 'INC-2395'],
      cis: ['api-gw-01', 'pg-primary', 'snow-conn-pool'],
      signals: [
        { id: 'SIG-4101', title: 'API p95 latency exceeded 4.2s', severity: 'high', source: 'Prometheus', ci: 'api-gw-01', occurredAt: '2024-01-15 14:12' },
        { id: 'SIG-4102', title: 'PostgreSQL slow query queue spike', severity: 'critical', source: 'Datadog', ci: 'pg-primary', occurredAt: '2024-01-15 14:13' },
        { id: 'SIG-4103', title: 'ServiceNow connector pool saturation', severity: 'high', source: 'ServiceNow', ci: 'snow-conn-pool', occurredAt: '2024-01-15 14:18' },
      ],
    },
  },
  'INC-2398': {
    summary: 'Vault certificate renewal failure is degrading downstream identity validation and token exchange paths.',
    impact: 'Authentication-dependent operations are slower and intermittently fail for operator sessions.',
    hypothesis: 'Expired or mismatched certificate material is causing trust failures between Vault and Keycloak-integrated consumers.',
    recommendedActions: [
      'Validate Vault certificate chain and renewal job logs for vault-01.',
      'Check Keycloak OIDC trust settings and recent secret rotations.',
      'Inspect whether fallback trust bundles were deployed to dependent services.',
    ],
    timeline: [
      { time: '13:50', event: 'Vault renewal job reported certificate write failure.' },
      { time: '13:56', event: 'Keycloak token validation errors began to rise.' },
      { time: '13:58', event: 'Incident INC-2398 opened.' },
    ],
    correlationGroup: {
      id: 'CG-040',
      name: 'Vault Auth Errors → Keycloak Degradation',
      confidence: 72,
      status: 'Investigating',
      description: 'Certificate and trust failures on Vault are propagating into auth degradation.',
      linkedIncidents: ['INC-2398'],
      cis: ['vault-01', 'keycloak-01'],
      signals: [
        { id: 'SIG-4001', title: 'Vault renewal pipeline failed to persist updated cert', severity: 'high', source: 'Vault', ci: 'vault-01', occurredAt: '2024-01-15 13:50' },
        { id: 'SIG-4002', title: 'OIDC validation errors crossed 5%', severity: 'medium', source: 'Keycloak', ci: 'keycloak-01', occurredAt: '2024-01-15 13:56' },
      ],
    },
  },
  'INC-2395': {
    summary: 'Neo4j-adjacent query latency and DB slowdown appear to be part of the same saturation chain affecting the API path.',
    impact: 'Correlation and evidence-enrichment paths are slower, delaying RCA for related incidents.',
    hypothesis: 'Shared database pressure is amplifying graph and API query contention.',
    recommendedActions: [
      'Profile slow query classes and compare against recent correlation-engine load spikes.',
      'Check whether graph enrichment jobs are overlapping with peak incident fan-in.',
      'Reduce non-essential enrichment tasks until latency normalizes.',
    ],
    timeline: [
      { time: '13:00', event: 'Latency anomaly opened for Neo4j/DB query path.' },
      { time: '14:10', event: 'Correlation engine linked the incident to the API timeout cluster.' },
    ],
    correlationGroup: {
      id: 'CG-041',
      name: 'API Timeout + DB Slow Query Cluster',
      confidence: 87,
      status: 'Active',
      description: 'Shared DB saturation chain linking multiple operator-facing symptoms.',
      linkedIncidents: ['INC-2401', 'INC-2395'],
      cis: ['api-gw-01', 'pg-primary', 'snow-conn-pool'],
      signals: [
        { id: 'SIG-4102', title: 'PostgreSQL slow query queue spike', severity: 'critical', source: 'Datadog', ci: 'pg-primary', occurredAt: '2024-01-15 14:13' },
      ],
    },
  },
};

function defaultDeepDive(incident: Incident): IncidentDeepDive {
  return {
    summary: `${incident.title} is currently tracked without enriched backend evidence in the demo dataset.`,
    impact: `Source system ${incident.source} reported the incident and requires operator review for service impact confirmation.`,
    hypothesis: 'Correlation evidence has not yet been attached for this incident, so investigation is currently incident-local.',
    recommendedActions: [
      'Open the source system timeline and verify the first failing event.',
      'Check related CI health and recent change activity for the affected system.',
      'Search the Correlations view for matching CI names or nearby timestamps.',
    ],
    timeline: [
      { time: incident.created, event: `${incident.id} created from ${incident.source}.` },
    ],
  };
}

function mapApiDetail(incident: Incident, payload: Record<string, unknown>): IncidentDeepDive {
  const apiIncident = payload['incident'] as Record<string, unknown> | undefined;
  const correlationGroup = payload['correlationGroup'] as Record<string, unknown> | undefined;
  const fallback = FALLBACK_DEEP_DIVES[incident.id] ?? defaultDeepDive(incident);

  if (!apiIncident) return fallback;

  const signals = Array.isArray(correlationGroup?.['signals'])
    ? (correlationGroup?.['signals'] as Array<Record<string, unknown>>).map((signal, index) => ({
        id: String(signal['id'] ?? `signal-${index + 1}`),
        title: String(signal['title'] ?? signal['signal_type'] ?? 'Correlated signal'),
        severity: String(signal['severity'] ?? 'unknown'),
        source: String(signal['source_system'] ?? signal['source'] ?? 'unknown'),
        ci: String(signal['affected_ci_id'] ?? signal['ci'] ?? 'n/a'),
        occurredAt: String(signal['occurred_at'] ?? signal['occurredAt'] ?? 'n/a'),
      }))
    : fallback.correlationGroup?.signals ?? [];

  return {
    summary: String(apiIncident['description'] ?? fallback.summary),
    impact: String(apiIncident['external_ref'] ?? fallback.impact),
    hypothesis: fallback.hypothesis,
    recommendedActions: fallback.recommendedActions,
    timeline: [
      { time: String(apiIncident['created_at'] ?? incident.created), event: 'Incident opened.' },
      ...(apiIncident['updated_at'] ? [{ time: String(apiIncident['updated_at']), event: 'Latest incident update recorded.' }] : []),
    ],
    ...(correlationGroup && {
      correlationGroup: {
        id: String(correlationGroup['id'] ?? fallback.correlationGroup?.id ?? 'unknown'),
        name: String(correlationGroup['name'] ?? fallback.correlationGroup?.name ?? 'Correlation group'),
        confidence: Number(correlationGroup['confidence'] ?? fallback.correlationGroup?.confidence ?? 0),
        status: String(correlationGroup['status'] ?? fallback.correlationGroup?.status ?? 'unknown'),
        description: String(correlationGroup['description'] ?? fallback.correlationGroup?.description ?? ''),
        linkedIncidents: fallback.correlationGroup?.linkedIncidents ?? [incident.id],
        cis: fallback.correlationGroup?.cis ?? [],
        signals,
      },
    }),
  };
}

export default function IncidentsPage() {
  const [mode, setMode] = useState<ConsoleMode>('operator');
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDeepDive | null>(null);
  const [detailSource, setDetailSource] = useState<'fallback' | 'api'>('fallback');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const perPage = 6;

  useEffect(() => {
    setMode(readConsoleMode());
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  const scopedIncidents = ALL_INCIDENTS.filter((inc) => {
    const isPlatformIncident = PLATFORM_SOURCES.has(inc.source);
    return mode === 'operator' ? isPlatformIncident : !isPlatformIncident;
  });

  const filtered = scopedIncidents.filter((inc) => {
    if (severity && inc.severity !== severity) return false;
    if (status && inc.status !== status) return false;
    if (search && !inc.title.toLowerCase().includes(search.toLowerCase()) && !inc.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const selectedIncident = filtered.find((incident) => incident.id === selectedIncidentId) ?? null;

  useEffect(() => {
    if (!selectedIncident) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const activeIncident = selectedIncident;

    const controller = new AbortController();
    const fallback = FALLBACK_DEEP_DIVES[activeIncident.id] ?? defaultDeepDive(activeIncident);

    setDetail(fallback);
    setDetailSource('fallback');
    setDetailError(null);
    setDetailLoading(true);

    async function loadDeepDive(): Promise<void> {
      try {
        const response = await fetch(`/api/incidents/${activeIncident.id}`, { signal: controller.signal });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
          setDetailError(payload.error?.message ?? 'Deep-dive backend data is unavailable. Showing fallback context.');
          setDetailLoading(false);
          return;
        }

        const payload = (await response.json()) as { data?: Record<string, unknown> };
        if (payload.data) {
          setDetail(mapApiDetail(activeIncident, payload.data));
          setDetailSource('api');
        }
      } catch {
        setDetailError('Deep-dive backend data is unavailable. Showing fallback context.');
      } finally {
        setDetailLoading(false);
      }
    }

    void loadDeepDive();
    return () => controller.abort();
  }, [selectedIncident, sessionUser]);

  if (!isConsoleAuthenticated(mode)) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div className="page-title" style={{ marginBottom: '0.5rem' }}>Session Logged Out</div>
          <div className="page-subtitle">Login from the sidebar to access incidents.</div>
        </div>
      </div>
    );
  }

  if (!capabilities.canUseIncidents) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Incidents</div>
            <div className="page-subtitle">Incident operations are reserved for engineering and platform roles.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Customer Admins stay in governance, billing, and configuration views. Sign in as Customer Engineer or Platform Admin to work incident queues.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Incidents</div>
          <div className="page-subtitle">
            {mode === 'operator' ? 'Platform Admin Console · platform incidents' : 'Customer Engineer Console · customer incidents'} · {filtered.length} incidents · {scopedIncidents.filter(i => i.status !== 'Resolved').length} open
          </div>
        </div>
        {capabilities.canCreateIncident ? (
          <button className="btn-primary">＋ New Incident</button>
        ) : (
          <span className="badge badge-info">Read-only incident access</span>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="glass-input"
          style={{ maxWidth: '280px' }}
          placeholder="🔍  Search incidents…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="filter-select"
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          className="filter-select"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Investigating">Investigating</option>
          <option value="Monitoring">Monitoring</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedIncident ? '1.35fr 1fr' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <div className="data-table-wrap">
            <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Severity</th>
                <th>Title</th>
                <th>Status</th>
                <th>Source</th>
                <th>Assignee</th>
                <th>Created</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                    No incidents match the current filters
                  </td>
                </tr>
              ) : (
                paged.map((inc) => (
                  <tr
                    key={inc.id}
                    style={{
                      cursor: 'pointer',
                      background: selectedIncidentId === inc.id ? 'rgba(0, 212, 255, 0.08)' : undefined,
                    }}
                    onClick={() => setSelectedIncidentId(inc.id)}
                  >
                    <td>
                      <span className="metric-value" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{inc.id}</span>
                    </td>
                    <td>
                      <span className={`sev-badge sev-${inc.severity}`}>{inc.severity}</span>
                    </td>
                    <td style={{ maxWidth: '320px' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '320px' }}>
                        {inc.title}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${inc.status === 'Resolved' ? 'pill-green' : inc.status === 'In Progress' ? 'pill-cyan' : 'pill-violet'}`}
                        style={{ fontSize: '0.7rem' }}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{inc.source}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="assignee-av">{inc.assignee}</div>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{inc.assignee}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {inc.created}
                    </td>
                    <td>
                      <span className={`sla-badge sla-${inc.sla.variant}`}>{inc.sla.label}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {selectedIncident && detail && (
          <div className="glass-card" style={{ padding: '1.25rem', position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.9rem' }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'var(--color-cyan)', marginBottom: '0.3rem' }}>
                  {selectedIncident.id}
                </div>
                <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{selectedIncident.title}</div>
              </div>
              <button
                onClick={() => setSelectedIncidentId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className={`sev-badge sev-${selectedIncident.severity}`}>{selectedIncident.severity}</span>
              <span className={`pill ${selectedIncident.status === 'Resolved' ? 'pill-green' : selectedIncident.status === 'In Progress' ? 'pill-cyan' : 'pill-violet'}`} style={{ fontSize: '0.68rem' }}>
                {selectedIncident.status}
              </span>
              <span className="badge badge-info">{selectedIncident.source}</span>
              <span className="badge badge-success">{detailSource === 'api' ? 'Backend-enriched' : 'Fallback context'}</span>
            </div>

            {(detailLoading || detailError) && (
              <div style={{ marginBottom: '1rem', fontSize: '0.74rem', color: detailError ? 'var(--color-amber)' : 'var(--color-text-muted)' }}>
                {detailLoading ? 'Loading deep-dive evidence…' : detailError}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>SUMMARY</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{detail.summary}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>IMPACT</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{detail.impact}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>ROOT-CAUSE HYPOTHESIS</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{detail.hypothesis}</div>
            </div>

            {detail.correlationGroup && (
              <div className="glass-card" style={{ padding: '0.9rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--color-cyan)' }}>{detail.correlationGroup.id}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{detail.correlationGroup.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700 }}>{detail.correlationGroup.confidence}%</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{detail.correlationGroup.status}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: '0.7rem' }}>
                  {detail.correlationGroup.description}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  {detail.correlationGroup.linkedIncidents.map((incidentId) => (
                    <span key={incidentId} className="badge badge-warning">{incidentId}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {detail.correlationGroup.cis.map((ci) => (
                    <span
                      key={ci}
                      style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-violet)', fontSize: '0.68rem', padding: '0.1rem 0.5rem', borderRadius: '999px', border: '1px solid rgba(139,92,246,0.2)' }}
                    >
                      {ci}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>RECOMMENDED ACTIONS</div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {detail.recommendedActions.map((action) => (
                  <div key={action} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>• {action}</div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>TIMELINE</div>
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {detail.timeline.map((entry) => (
                  <div key={`${entry.time}-${entry.event}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '0.75rem' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{entry.time}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{entry.event}</div>
                  </div>
                ))}
              </div>
            </div>

            {detail.correlationGroup?.signals && detail.correlationGroup.signals.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>CORRELATED SIGNALS</div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {detail.correlationGroup.signals.map((signal) => (
                    <div key={signal.id} className="glass-card" style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{signal.title}</div>
                        <span className={`sev-badge sev-${signal.severity === 'critical' || signal.severity === 'high' || signal.severity === 'medium' || signal.severity === 'low' ? signal.severity : 'low'}`}>{signal.severity}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {signal.id} · {signal.source} · {signal.ci} · {signal.occurredAt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span>Showing {paged.length === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} incidents</span>
        <div className="pagination-btns">
          <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
        </div>
      </div>
    </div>
  );
}
