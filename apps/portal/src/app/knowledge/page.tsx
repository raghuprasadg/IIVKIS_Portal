'use client';

import { useState } from 'react';

interface Article {
  id: string;
  title: string;
  category: string;
  tags: string[];
  views: number;
  updated: string;
  author: string;
}

const ARTICLES = [
  { id: 'KB-0291', title: 'ServiceNow REST API rate-limiting & retry strategy', category: 'Integration', tags: ['servicenow', 'api', 'retry'], views: 342, updated: '2024-01-14', author: 'SK' },
  { id: 'KB-0288', title: 'Vault certificate lifecycle — renewal runbook', category: 'Security', tags: ['vault', 'certs', 'pki'], views: 218, updated: '2024-01-13', author: 'JR' },
  { id: 'KB-0285', title: 'Neo4j query optimisation — index hints & profiling', category: 'Database', tags: ['neo4j', 'performance', 'cypher'], views: 176, updated: '2024-01-12', author: 'TL' },
  { id: 'KB-0281', title: 'Redis cluster eviction policies — best practices', category: 'Database', tags: ['redis', 'memory', 'eviction'], views: 455, updated: '2024-01-11', author: 'AM' },
  { id: 'KB-0278', title: 'Keycloak realm configuration for multi-tenant OIDC', category: 'Auth', tags: ['keycloak', 'oidc', 'multi-tenant'], views: 389, updated: '2024-01-10', author: 'BW' },
  { id: 'KB-0274', title: 'Prometheus alerting rules — SLA breach detection', category: 'Observability', tags: ['prometheus', 'alerting', 'sla'], views: 207, updated: '2024-01-09', author: 'JR' },
  { id: 'KB-0271', title: 'Jira webhook integration — troubleshooting delivery failures', category: 'Integration', tags: ['jira', 'webhook', 'debug'], views: 134, updated: '2024-01-08', author: 'SK' },
  { id: 'KB-0268', title: 'PagerDuty escalation policy design — on-call best practices', category: 'Operations', tags: ['pagerduty', 'oncall', 'escalation'], views: 298, updated: '2024-01-07', author: 'TL' },
  { id: 'KB-0266', title: 'Datadog monitor triage — replica lag, node OOM, and APM evidence', category: 'Observability', tags: ['datadog', 'apm', 'monitor', 'replication'], views: 261, updated: '2024-01-06', author: 'AM' },
  { id: 'KB-0263', title: 'Grafana alert storm suppression — pending periods and label grouping', category: 'Observability', tags: ['grafana', 'alerts', 'dedup', 'dashboards'], views: 223, updated: '2024-01-05', author: 'JR' },
  { id: 'KB-0260', title: 'Splunk timeline reconstruction for orchestrator retry failures', category: 'Operations', tags: ['splunk', 'logs', 'orchestrator', 'timeline'], views: 188, updated: '2024-01-04', author: 'TL' },
  { id: 'KB-0257', title: 'GitHub deployment evidence — mapping failing rollouts to incidents', category: 'Integration', tags: ['github', 'actions', 'deployments', 'rollback'], views: 167, updated: '2024-01-03', author: 'BW' },
  { id: 'KB-0255', title: 'AWS CloudWatch alarm normalization — EC2, EKS, and queue depth', category: 'Cloud', tags: ['cloudwatch', 'aws', 'alarms', 'eks'], views: 194, updated: '2024-01-02', author: 'SK' },
  { id: 'KB-0252', title: 'Zabbix problem severity mapping for legacy infrastructure', category: 'Infrastructure', tags: ['zabbix', 'severity', 'legacy', 'json-rpc'], views: 143, updated: '2024-01-01', author: 'TL' },
  { id: 'KB-0249', title: 'Slack incident threads — operator approvals and war-room hygiene', category: 'Operations', tags: ['slack', 'threads', 'war-room', 'approvals'], views: 279, updated: '2023-12-31', author: 'JR' },
] as const satisfies readonly Article[];

const CATEGORIES = ['All', 'Integration', 'Security', 'Database', 'Auth', 'Observability', 'Operations', 'Cloud', 'Infrastructure'];
const FEATURED_VENDORS = ['ServiceNow', 'PagerDuty', 'Jira', 'Datadog', 'Grafana', 'Splunk', 'GitHub', 'CloudWatch', 'Zabbix', 'Slack'];

export default function KnowledgePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = ARTICLES.filter((a) => {
    const matchCat = category === 'All' || a.category === category;
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Knowledge Base</div>
          <div className="page-subtitle">{ARTICLES.length} articles · vendor, cloud, and ops runbooks</div>
        </div>
        <button className="btn-primary">＋ New Article</button>
      </div>

      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Vendor coverage</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {FEATURED_VENDORS.map((vendor) => (
            <span key={vendor} className="pill pill-violet" style={{ fontSize: '0.68rem' }}>
              {vendor}
            </span>
          ))}
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="glass-input"
          placeholder="Search articles or tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '1.5rem' }}>
        {filtered.map((a) => (
          <div key={a.id} className="glass-card" style={{ padding: '1.25rem', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.id}</span>
              <span className="badge badge-info">{a.category}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>{a.title}</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {a.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--color-cyan)', fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(0,212,255,0.18)' }}>
                  #{tag}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              <span>👁 {a.views} views</span>
              <span>Updated {a.updated}</span>
              <div className="user-avatar" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.6rem' }}>{a.author}</div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          No articles found for &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
