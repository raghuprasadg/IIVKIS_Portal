'use client';

import { useState } from 'react';

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

const ALL_INCIDENTS: Incident[] = [
  { id: 'INC-2401', title: 'ServiceNow API timeout cascade — connection pool exhausted', severity: 'critical', status: 'In Progress', assignee: 'JR', created: '2024-01-15 14:20', sla: { label: '1h 40m', variant: 'warn' }, source: 'ServiceNow' },
  { id: 'INC-2398', title: 'Vault certificate renewal failure — vault-01', severity: 'high', status: 'Assigned', assignee: 'SK', created: '2024-01-15 13:58', sla: { label: '4h 02m', variant: 'ok' }, source: 'Vault' },
  { id: 'INC-2395', title: 'Neo4j query latency spike — p95 > 3s', severity: 'medium', status: 'Investigating', assignee: 'TL', created: '2024-01-15 13:00', sla: { label: '0h 48m', variant: 'breach' }, source: 'Prometheus' },
  { id: 'INC-2391', title: 'Grafana dashboard data gaps — metrics missing', severity: 'low', status: 'Monitoring', assignee: 'AM', created: '2024-01-15 12:00', sla: { label: '6h 00m', variant: 'ok' }, source: 'Grafana' },
  { id: 'INC-2388', title: 'Redis memory threshold exceeded — eviction triggered', severity: 'medium', status: 'Resolved', assignee: 'BW', created: '2024-01-15 11:30', sla: { label: 'Resolved', variant: 'ok' }, source: 'Redis' },
  { id: 'INC-2382', title: 'Keycloak SSO login failures — 503 rate > 5%', severity: 'high', status: 'Resolved', assignee: 'JR', created: '2024-01-15 09:15', sla: { label: 'Resolved', variant: 'ok' }, source: 'Keycloak' },
  { id: 'INC-2375', title: 'Jira webhook delivery failures — integration queue backlog', severity: 'medium', status: 'Resolved', assignee: 'SK', created: '2024-01-15 08:00', sla: { label: 'Resolved', variant: 'ok' }, source: 'Jira' },
  { id: 'INC-2371', title: 'PagerDuty escalation policy misconfiguration', severity: 'low', status: 'Resolved', assignee: 'TL', created: '2024-01-14 22:45', sla: { label: 'Resolved', variant: 'ok' }, source: 'PagerDuty' },
];

export default function IncidentsPage() {
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 6;

  const filtered = ALL_INCIDENTS.filter((inc) => {
    if (severity && inc.severity !== severity) return false;
    if (status && inc.status !== status) return false;
    if (search && !inc.title.toLowerCase().includes(search.toLowerCase()) && !inc.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Incidents</div>
          <div className="page-subtitle">{filtered.length} incidents · {ALL_INCIDENTS.filter(i => i.status !== 'Resolved').length} open</div>
        </div>
        <button className="btn-primary">＋ New Incident</button>
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

      {/* Table */}
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
                  <tr key={inc.id} style={{ cursor: 'pointer' }}>
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
