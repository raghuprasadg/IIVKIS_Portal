'use client';

import { useEffect, useState } from 'react';

import { readSessionUser, type DemoUser } from './lib/demo-users';

type JourneyStep = {
  step: string;
  title: string;
  summary: string;
  detail: string;
  accent: 'cyan' | 'violet' | 'blue' | 'coral' | 'amber' | 'green';
};

const PLATFORM_ADMIN_JOURNEY: JourneyStep[] = [
  {
    step: '1',
    title: 'Provision Company Workspace',
    summary: 'Approve onboarding, isolation tier, and default policy packs for each company tenant.',
    detail: 'New companies enter the platform with baseline security, audit, and billing controls already attached.',
    accent: 'cyan',
  },
  {
    step: '2',
    title: 'Set Global Guardrails',
    summary: 'Maintain global RBAC, retention, connector, and AI governance defaults across all tenants.',
    detail: 'Platform-wide rules propagate without exposing one company to another company’s data.',
    accent: 'violet',
  },
  {
    step: '3',
    title: 'Watch Platform Health',
    summary: 'Track telemetry, correlation, identity posture, and service saturation across the shared platform.',
    detail: 'Platform admins care about fleet stability, tenant safety, and noisy-neighbor protection.',
    accent: 'blue',
  },
  {
    step: '4',
    title: 'Review Commercial State',
    summary: 'Validate plan adherence, overage exposure, and renewal posture across all active companies.',
    detail: 'Billing and utilization are operational levers for the platform team, not engineering detail.',
    accent: 'coral',
  },
  {
    step: '5',
    title: 'Handle Escalations',
    summary: 'Review cross-tenant incidents, policy drift, and support requests that require platform intervention.',
    detail: 'Only the platform role can safely operate above the company boundary.',
    accent: 'amber',
  },
  {
    step: '6',
    title: 'Close the Loop',
    summary: 'Export audit evidence, confirm remediation, and feed learned controls back into the platform baseline.',
    detail: 'The role ends with governance and service assurance, not ticket-level troubleshooting.',
    accent: 'green',
  },
];

const COMPANY_ADMIN_JOURNEY: JourneyStep[] = [
  {
    step: '1',
    title: 'Open Company Workspace',
    summary: 'Start from one tenant-scoped command center for subscription, tooling, and operations governance.',
    detail: 'Customer admins are responsible for enablement, spend, and access inside their own workspace.',
    accent: 'cyan',
  },
  {
    step: '2',
    title: 'Connect Business Systems',
    summary: 'Approve ITSM, alerting, SCM, and collaboration integrations needed by the company’s teams.',
    detail: 'Integrations are managed per company, not globally across the platform.',
    accent: 'violet',
  },
  {
    step: '3',
    title: 'Configure Policy & Budget',
    summary: 'Set telemetry retention, seat allocation, notification policy, and spend thresholds.',
    detail: 'The admin experience focuses on control, compliance, and predictable cost.',
    accent: 'blue',
  },
  {
    step: '4',
    title: 'Track Adoption',
    summary: 'Monitor connector health, workspace utilization, and role distribution across company teams.',
    detail: 'This view is operational but intentionally non-technical compared with the engineer workspace.',
    accent: 'coral',
  },
  {
    step: '5',
    title: 'Escalate Platform Needs',
    summary: 'Raise platform requests for capacity changes, onboarding, billing adjustments, or SLA reviews.',
    detail: 'Customer admins interact with the platform team through governed request paths.',
    accent: 'amber',
  },
  {
    step: '6',
    title: 'Prepare Audit Trail',
    summary: 'Export evidence packs and configuration records for internal review or compliance checks.',
    detail: 'The role closes with accountability and administrative readiness.',
    accent: 'green',
  },
];

const COMPANY_ENGINEER_JOURNEY: JourneyStep[] = [
  {
    step: '1',
    title: 'Triage the Signal',
    summary: 'Open incidents, inspect evidence, and narrow the problem to the affected services and timelines.',
    detail: 'Customer engineers stay inside their tenant context with direct access to technical evidence.',
    accent: 'cyan',
  },
  {
    step: '2',
    title: 'Ask the AI Assistant',
    summary: 'Use grounded AI suggestions to accelerate diagnosis without leaving the incident workflow.',
    detail: 'Responses are constrained by tenant scope, available evidence, and engineer permissions.',
    accent: 'violet',
  },
  {
    step: '3',
    title: 'Inspect Knowledge & Correlations',
    summary: 'Combine runbooks, vendor knowledge, and correlation groups to confirm root cause candidates.',
    detail: 'The engineer workspace is built for technical depth rather than admin oversight.',
    accent: 'blue',
  },
  {
    step: '4',
    title: 'Execute the Fix',
    summary: 'Follow resolution steps, capture outcomes, and keep investigation notes tied to the incident.',
    detail: 'This role is optimized for action, not billing or tenant administration.',
    accent: 'coral',
  },
  {
    step: '5',
    title: 'Validate Recovery',
    summary: 'Confirm telemetry returns to baseline and correlation confidence decays after remediation.',
    detail: 'Recovery proof matters as much as the initial diagnosis.',
    accent: 'amber',
  },
  {
    step: '6',
    title: 'Share Learned Knowledge',
    summary: 'Close the loop with runbook references and reusable patterns for future incidents.',
    detail: 'Engineers feed operational learning back into the company knowledge workflow.',
    accent: 'green',
  },
];

const PLATFORM_ADMIN_METRIC_CARDS = [
  { title: 'Active Companies', value: '42', icon: '🏢', color: 'var(--color-cyan)', trend: '+2', trendDir: 'up' as const },
  { title: 'Platform Saturation', value: '71%', icon: '🖥️', color: 'var(--color-amber)', trend: '+4%', trendDir: 'up' as const },
  { title: 'Shared Telemetry', value: '12.4k/s', icon: '📡', color: 'var(--color-violet)', trend: '+1.8k/s', trendDir: 'up' as const },
  { title: 'Billed Revenue', value: '$84,290', icon: '💳', color: 'var(--color-green)', trend: '+$3,410', trendDir: 'up' as const },
] as const;

const COMPANY_ADMIN_METRIC_CARDS = [
  { title: 'Connected Integrations', value: '11 / 12', icon: '🔌', color: 'var(--color-cyan)', trend: '+1', trendDir: 'up' as const },
  { title: 'Subscription Tier', value: 'Enterprise', icon: '📦', color: 'var(--color-violet)', trend: 'Renews in 42d', trendDir: 'up' as const },
  { title: 'Telemetry Budget', value: '73%', icon: '📡', color: 'var(--color-amber)', trend: '+6%', trendDir: 'up' as const },
  { title: 'Current Billing', value: '$18,420', icon: '💳', color: 'var(--color-green)', trend: '+$1,230', trendDir: 'up' as const },
] as const;

const COMPANY_ENGINEER_METRIC_CARDS = [
  { title: 'Active Incidents', value: '24', icon: '🚨', color: 'var(--color-coral)', trend: '+3', trendDir: 'up' as const },
  { title: 'Correlation Groups', value: '7', icon: '🔗', color: 'var(--color-cyan)', trend: '-2', trendDir: 'down' as const },
  { title: 'Knowledge Articles', value: '1,248', icon: '📚', color: 'var(--color-violet)', trend: '+12', trendDir: 'up' as const },
  { title: 'Avg Resolution', value: '2h 34m', icon: '⏱️', color: 'var(--color-amber)', trend: '-18m', trendDir: 'down' as const },
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

const COMPANY_ADMIN_CONTROLS = [
  { label: 'Subscriptions', value: 'Enterprise', detail: 'AI Ops, KG, 12 connectors, premium support' },
  { label: 'Contract Renewal', value: '42 days', detail: 'Auto-renew enabled with spend cap guardrail' },
  { label: 'Seat Utilization', value: '68 / 85', detail: '17 seats available across Acme service teams' },
  { label: 'Telemetry Retention', value: '90 days', detail: 'Expanded retention applied to critical incident classes' },
] as const;

const PLATFORM_ADMIN_CONTROLS = [
  { label: 'Tenant Onboarding Queue', value: '3 pending', detail: 'Two production company workspaces and one sandbox are awaiting policy-pack approval.' },
  { label: 'Global Policy Drift', value: '2 alerts', detail: 'RBAC and retention policies are out of sync in two tenants after last night’s rollout.' },
  { label: 'Escalated Support', value: '5 open', detail: 'Requests requiring platform intervention are inside their contractual SLA windows.' },
  { label: 'Revenue at Risk', value: '$12.4k', detail: 'Usage and renewal posture indicate one enterprise account needs immediate review.' },
] as const;

const PLATFORM_ADMIN_QUEUE = [
  { title: 'Approve Northwind production tenant', detail: 'Isolation tier T2, BYOK requested, finance review complete.', tone: 'pill-cyan' },
  { title: 'Investigate OPA policy drift in tenant-beta', detail: 'Tenant bundle is one version behind the enforced platform baseline.', tone: 'pill-coral' },
  { title: 'Review weekend telemetry burst request', detail: 'Acme needs a temporary ingest ceiling increase for load testing.', tone: 'pill-violet' },
] as const;

const COMPANY_ADMIN_PRIORITIES = [
  { title: 'Approve GitHub Enterprise connector', detail: 'Callback validation is pending before the connector becomes available to engineers.', tone: 'pill-cyan' },
  { title: 'Review telemetry budget threshold', detail: 'Weekend load tests may exceed the current retention and ingest allowance.', tone: 'pill-amber' },
  { title: 'Confirm April renewal pack', detail: 'Invoice pack, add-on usage, and SLA terms are ready for sign-off.', tone: 'pill-violet' },
] as const;

const TELEMETRY_STREAMS = [
  { name: 'Incidents', throughput: '2.1k/day', status: 'Healthy' },
  { name: 'Metrics', throughput: '8.4M/day', status: 'Healthy' },
  { name: 'Logs', throughput: '215 GB/day', status: 'Watch budget' },
  { name: 'Change Events', throughput: '740/day', status: 'Healthy' },
] as const;

const BILLING_LINES = [
  { item: 'Base subscription', amount: '$9,500', delta: 'Fixed' },
  { item: 'Telemetry overage', amount: '$2,120', delta: '+14% vs last month' },
  { item: 'LLM consumption', amount: '$4,880', delta: '+$640 vs last month' },
  { item: 'Premium support', amount: '$1,920', delta: 'Within contracted band' },
] as const;

const PLATFORM_TICKETS = [
  { id: 'PLAT-1184', title: 'Increase Datadog ingest allowance for weekend load tests', status: 'Awaiting platform review', sla: '4h' },
  { id: 'PLAT-1176', title: 'Add GitHub Enterprise webhook endpoint for production org', status: 'In progress', sla: '1d' },
  { id: 'PLAT-1171', title: 'Validate ServiceNow connector failover policy before renewal', status: 'Resolved', sla: 'Closed' },
] as const;

const EXPERIENCE_TABS = ['IDE', 'Code Security', 'CI/CD', 'Runtime Tests', 'AI Assistant'] as const;

const EXPERIENCE_FINDINGS = [
  { title: 'SQL injection in auth flow', severity: 'High', tone: 'pill-coral' },
  { title: 'Outdated package in portal-ui', severity: 'Medium', tone: 'pill-amber' },
  { title: 'Leaked GitHub token in config', severity: 'Critical', tone: 'pill-coral' },
] as const;

const ENGINEER_ASSETS = ['Runbooks', 'Correlated signals', 'Timeline notes', 'Root-cause hypotheses', 'Recovery checks', 'Postmortem drafts'] as const;

type WorkspaceKind = 'platform-admin' | 'company-admin' | 'company-engineer';

function getWorkspaceKind(user: DemoUser): WorkspaceKind {
  if (user.role === 'Platform Admin') return 'platform-admin';
  if (user.role === 'Customer Admin') return 'company-admin';
  return 'company-engineer';
}

function renderMetricCards(
  cards: ReadonlyArray<{
    title: string;
    value: string;
    icon: string;
    color: string;
    trend: string;
    trendDir: 'up' | 'down';
  }>,
) {
  return (
    <div className="metrics-grid">
      {cards.map((card) => (
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
  );
}

function IncidentTable() {
  return (
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
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{inc.id}</div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{inc.title}</div>
            </td>
            <td>
              <span className="pill pill-cyan" style={{ fontSize: '0.8rem' }}>{inc.status}</span>
            </td>
            <td style={{ color: 'var(--color-text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>{inc.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CorrelationPanel() {
  return (
    <>
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
    </>
  );
}

function SparklinePanel() {
  return (
    <div className="glass-card section-card" style={{ flex: 1 }}>
      <div className="section-title"><span>📈</span> KA Search Volume</div>
      <div style={{ fontSize: '0.92rem', color: 'var(--color-text-secondary)' }}>Last 12 hours</div>
      <div className="sparkline">
        {SPARK_HEIGHTS.map((h, i) => (
          <div key={i} className="spark-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function getJourneySteps(workspace: WorkspaceKind): JourneyStep[] {
  if (workspace === 'platform-admin') return PLATFORM_ADMIN_JOURNEY;
  if (workspace === 'company-admin') return COMPANY_ADMIN_JOURNEY;
  return COMPANY_ENGINEER_JOURNEY;
}

function JourneyRail({ workspace }: { workspace: WorkspaceKind }) {
  return (
    <div className="story-journey-grid">
      {getJourneySteps(workspace).map((item) => (
        <article key={item.step} className={`glass-card journey-card accent-${item.accent}`}>
          <div className="journey-step">Step {item.step}</div>
          <div className="journey-title">{item.title}</div>
          <div className="journey-summary">{item.summary}</div>
          <div className="journey-detail">{item.detail}</div>
        </article>
      ))}
    </div>
  );
}

function ExperienceBoard({ workspace, sessionUser }: { workspace: WorkspaceKind; sessionUser: DemoUser }) {
  if (workspace === 'platform-admin') {
    return (
      <section className="glass-card experience-board">
        <div className="experience-board-header">
          <div>
            <div className="experience-kicker">Platform Admin Workspace</div>
            <div className="experience-title">Operate the shared platform behind every company workspace</div>
            <div className="experience-subtitle">Tenant onboarding, policy enforcement, commercial exposure, and platform escalations live here.</div>
          </div>
          <div className="experience-actions">
            <button className="btn-primary">Approve Tenant</button>
            <button className="btn-ghost">Review Drift</button>
          </div>
        </div>

        <div className="experience-grid">
          <div className="glass-card section-card">
            <div className="section-title"><span>🏢</span> Global Controls</div>
            {PLATFORM_ADMIN_CONTROLS.map((item) => (
              <div key={item.label} className="story-list-row">
                <div>
                  <div className="story-list-title">{item.label}</div>
                  <div className="story-list-detail">{item.detail}</div>
                </div>
                <span className="story-list-value">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="glass-card section-card">
            <div className="section-title"><span>🛡️</span> Governance Queue</div>
            {PLATFORM_ADMIN_QUEUE.map((item) => (
              <div key={item.title} className="experience-finding-item">
                <div>
                  <div className="experience-finding-title">{item.title}</div>
                  <div className="experience-finding-meta">{item.detail}</div>
                </div>
                <span className={`pill ${item.tone}`}>Review</span>
              </div>
            ))}
          </div>

          <div className="glass-card section-card">
            <div className="section-title"><span>📈</span> Shared Platform Health</div>
            <div className="story-list-row compact"><span className="story-list-title">Policy compliance</span><span className="story-list-value">97.4%</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Cross-tenant noise events</span><span className="story-list-value">02</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Platform SLA attainment</span><span className="story-list-value">99.95%</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Open escalations</span><span className="story-list-value">05</span></div>
          </div>
        </div>
      </section>
    );
  }

  if (workspace === 'company-admin') {
    return (
      <section className="glass-card experience-board">
        <div className="experience-board-header">
          <div>
            <div className="experience-kicker">Customer Admin Workspace</div>
            <div className="experience-title">Govern the {sessionUser.org} workspace without entering engineer-only flows</div>
            <div className="experience-subtitle">This view is for subscriptions, integrations, spend, policy, and platform requests.</div>
          </div>
          <div className="experience-actions">
            <button className="btn-primary">Review Renewal</button>
            <button className="btn-ghost">Open Platform Ticket</button>
          </div>
        </div>

        <div className="experience-grid">
          <div className="glass-card section-card">
            <div className="section-title"><span>🧭</span> Company Controls</div>
            {COMPANY_ADMIN_CONTROLS.map((item) => (
              <div key={item.label} className="story-list-row">
                <div>
                  <div className="story-list-title">{item.label}</div>
                  <div className="story-list-detail">{item.detail}</div>
                </div>
                <span className="story-list-value">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="glass-card section-card">
            <div className="section-title"><span>✅</span> Admin Priorities</div>
            {COMPANY_ADMIN_PRIORITIES.map((item) => (
              <div key={item.title} className="experience-finding-item">
                <div>
                  <div className="experience-finding-title">{item.title}</div>
                  <div className="experience-finding-meta">{item.detail}</div>
                </div>
                <span className={`pill ${item.tone}`}>Open</span>
              </div>
            ))}
          </div>

          <div className="glass-card section-card">
            <div className="section-title"><span>📊</span> Governance Snapshot</div>
            <div className="story-list-row compact"><span className="story-list-title">Managed users</span><span className="story-list-value">85</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Connected tools</span><span className="story-list-value">11</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Open vendor approvals</span><span className="story-list-value">03</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Budget watch items</span><span className="story-list-value">02</span></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card experience-board">
      <div className="experience-board-header">
        <div>
            <div className="experience-kicker">Customer Engineer Workspace</div>
          <div className="experience-title">Secure delivery view for {sessionUser.org}</div>
          <div className="experience-subtitle">Incident response, AI guidance, correlation, and knowledge work stay in one engineer-focused console.</div>
        </div>
        <div className="experience-actions">
          <button className="btn-primary">Run All Scans</button>
          <button className="btn-ghost">Deploy Guarded</button>
        </div>
      </div>

      <div className="experience-tabs">
        {EXPERIENCE_TABS.map((tab, index) => (
          <span key={tab} className={`experience-tab${index === 0 ? ' active' : ''}`}>{tab}</span>
        ))}
      </div>

      <div className="experience-grid">
        <div className="experience-editor glass-card">
          <div className="experience-editor-topbar">
            <span>auth.ts</span>
            <span>user.js</span>
            <span>product.js</span>
          </div>
          <pre className="experience-code-block">{`const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { user, pass } = req.body;
  const query = "SELECT * FROM users WHERE user='" + user + "' AND pass='" + pass + "'";
  db.query(query, (err, result) => {
    res.json(result);
  });
});`}</pre>
        </div>

        <div className="experience-assistant glass-card">
          <div className="experience-panel-title">AI Assistant</div>
          <div className="experience-assistant-copy">
            This query is vulnerable to SQL injection. Replace string concatenation with parameterized queries and preserve the existing login contract.
          </div>
          <div className="experience-patch-preview">
            <div className="experience-patch-label">Suggested patch</div>
            <div className="experience-patch-body">db.query(&apos;SELECT * FROM users WHERE user = $1 AND pass = $2&apos;, [user, pass]);</div>
          </div>
          <button className="btn-primary" style={{ width: '100%' }}>Apply Fix</button>
        </div>

        <div className="experience-findings glass-card">
          <div className="experience-panel-title">Security Findings</div>
          <div className="experience-finding-list">
            {EXPERIENCE_FINDINGS.map((finding) => (
              <div key={finding.title} className="experience-finding-item">
                <div>
                  <div className="experience-finding-title">{finding.title}</div>
                  <div className="experience-finding-meta">Correlated across code, dependency, and runtime evidence</div>
                </div>
                <span className={`pill ${finding.tone}`}>{finding.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="experience-footer">
        <div className="experience-correlation glass-card">
          <div className="experience-panel-title">Correlation Path</div>
          <div className="experience-correlation-flow">
            <span>Code</span>
            <span>API</span>
            <span>Runtime</span>
            <span>Exposure</span>
          </div>
          <div className="experience-correlation-note">Exploit path remains open until fix, test, and deploy complete.</div>
        </div>

        <div className="experience-integrations glass-card">
          <div className="experience-panel-title">Investigation Assets</div>
          <div className="experience-integration-list">
            {ENGINEER_ASSETS.map((asset) => (
              <span key={asset} className="integration-chip">{asset}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleSpotlight({ workspace }: { workspace: WorkspaceKind }) {
  if (workspace === 'company-admin') {
    return (
      <div className="story-side-stack">
        <div className="glass-card section-card">
          <div className="section-title"><span>📦</span> Subscription Controls</div>
          {COMPANY_ADMIN_CONTROLS.map((item) => (
            <div key={item.label} className="story-list-row">
              <div>
                <div className="story-list-title">{item.label}</div>
                <div className="story-list-detail">{item.detail}</div>
              </div>
              <span className="story-list-value">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="glass-card section-card">
          <div className="section-title"><span>💳</span> Billing Snapshot</div>
          {BILLING_LINES.map((line) => (
            <div key={line.item} className="story-list-row compact">
              <div>
                <div className="story-list-title">{line.item}</div>
                <div className="story-list-detail">{line.delta}</div>
              </div>
              <span className="story-list-value">{line.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (workspace === 'platform-admin') {
    return (
      <div className="story-side-stack">
        <div className="glass-card section-card">
          <div className="section-title"><span>🏢</span> Platform Controls</div>
          {PLATFORM_ADMIN_CONTROLS.map((item) => (
            <div key={item.label} className="story-list-row compact">
              <span className="story-list-title">{item.label}</span>
              <span className="story-list-value">{item.value}</span>
            </div>
          ))}
        </div>
        <SparklinePanel />
      </div>
    );
  }

  return (
    <div className="story-side-stack">
      <div className="glass-card section-card">
        <div className="section-title"><span>📚</span> Vendor Proof</div>
        {VENDOR_PROOF.map((item) => (
          <div key={item.vendor} className="story-list-row compact">
            <span className="story-list-title">{item.vendor}</span>
            <span className="story-list-detail" style={{ textAlign: 'right' }}>{item.example}</span>
          </div>
        ))}
      </div>
      <SparklinePanel />
    </div>
  );
}

function CompanyEngineerWorkspace() {
  return (
    <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">🚨</span>
          Recent Incidents
        </div>
        <IncidentTable />
      </div>

      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">🔗</span>
          Correlation Activity
        </div>
        <CorrelationPanel />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SparklinePanel />
        <div className="glass-card section-card" style={{ flex: 1 }}>
          <div className="section-title"><span>🧪</span> Vendor Proof</div>
          {VENDOR_PROOF.map((item) => (
            <div key={item.vendor} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.55rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{item.vendor}</span>
              <span style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}>{item.example}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompanyAdminWorkspace() {
  return (
    <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">🧭</span>
          Tenant Controls
        </div>
        {COMPANY_ADMIN_CONTROLS.map((item) => (
          <div key={item.label} style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{item.label}</span>
              <span style={{ color: 'var(--color-cyan)' }}>{item.value}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">📡</span>
          Telemetry Allocation
        </div>
        {TELEMETRY_STREAMS.map((stream) => (
          <div key={stream.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.7rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{stream.name}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{stream.throughput}</div>
            </div>
            <span className={stream.status === 'Healthy' ? 'pill pill-green' : 'pill pill-cyan'} style={{ alignSelf: 'center' }}>
              {stream.status}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">💳</span>
          Billing Snapshot
        </div>
        {BILLING_LINES.map((line) => (
          <div key={line.item} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{line.item}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{line.delta}</div>
            </div>
            <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{line.amount}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card section-card" style={{ flex: 1 }}>
          <div className="section-title"><span>🎫</span> Platform Tickets</div>
          {PLATFORM_TICKETS.map((ticket) => (
            <div key={ticket.id} style={{ padding: '0.7rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.2rem' }}>
                <span className="pill pill-violet">{ticket.id}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ticket.sla}</span>
              </div>
              <div style={{ fontSize: '0.86rem', marginBottom: '0.2rem' }}>{ticket.title}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>{ticket.status}</div>
            </div>
          ))}
        </div>

        <div className="glass-card section-card" style={{ flex: 1 }}>
          <div className="section-title"><span>🔌</span> Integration Status</div>
          {[
            { name: 'ServiceNow', status: 'Connected', tone: 'pill-green' },
            { name: 'GitHub', status: 'Pending validation', tone: 'pill-cyan' },
            { name: 'Datadog', status: 'Budget watch', tone: 'pill-cyan' },
            { name: 'Slack', status: 'Connected', tone: 'pill-green' },
          ].map((integration) => (
            <div key={integration.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{integration.name}</span>
              <span className={`pill ${integration.tone}`}>{integration.status}</span>
            </div>
          ))}
        </div>

        <div className="glass-card section-card" style={{ flex: 1 }}>
          <div className="section-title"><span>📎</span> Admin Actions</div>
          {['Review subscription add-ons', 'Raise platform support ticket', 'Approve connector onboarding', 'Export monthly billing pack'].map((action) => (
            <div key={action} style={{ marginBottom: '0.6rem', fontSize: '0.86rem', color: 'var(--color-text-secondary)' }}>
              • {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlatformAdminWorkspace() {
  return (
    <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">🏢</span>
          Tenant Governance
        </div>
        {PLATFORM_ADMIN_CONTROLS.map((item) => (
          <div key={item.label} style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{item.label}</span>
              <span style={{ color: 'var(--color-cyan)' }}>{item.value}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="glass-card section-card">
        <div className="section-title">
          <span className="section-title-icon">🔗</span>
          Cross-Tenant Correlation Activity
        </div>
        <CorrelationPanel />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SparklinePanel />
        <div className="glass-card section-card" style={{ flex: 1 }}>
          <div className="section-title"><span>📦</span> Platform Queue</div>
          {PLATFORM_ADMIN_QUEUE.map((item) => (
            <div key={item.title} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{item.title}</span>
              <span className={`pill ${item.tone}`}>Open</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [time, setTime] = useState('');
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  if (!sessionUser) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div className="page-title" style={{ marginBottom: '0.5rem' }}>Session Logged Out</div>
          <div className="page-subtitle">Use the sidebar to login as Platform Admin, Customer Admin, or Customer Engineer.</div>
        </div>
      </div>
    );
  }

  const workspace = getWorkspaceKind(sessionUser);
  const metricCards =
    workspace === 'platform-admin'
      ? PLATFORM_ADMIN_METRIC_CARDS
      : workspace === 'company-admin'
        ? COMPANY_ADMIN_METRIC_CARDS
        : COMPANY_ENGINEER_METRIC_CARDS;
  const subtitle =
    workspace === 'platform-admin'
      ? 'Operate the shared platform with company onboarding, global controls, escalations, and commercial oversight.'
      : workspace === 'company-admin'
        ? 'Control subscriptions, integrations, telemetry, billing, and platform requests for one company workspace.'
        : 'Investigate incidents with AI guidance, correlation, and tenant-scoped knowledge built for engineers.';

  return (
    <div className="landing-dashboard dashboard-story">
      <section className="story-hero glass-card">
        <div className="story-hero-copy">
          <div className="story-kicker">Secure Developer Suite</div>
          <div className="story-title">Each role gets its own governed workspace.</div>
          <div className="story-subtitle">{subtitle}</div>

          <div className="story-hero-actions">
            <button className="btn-primary">Open Workspace</button>
            <button className="btn-ghost">Review Risk Graph</button>
          </div>

          <div className="story-hero-legend">
            <span className="story-legend-pill">Built-in IDE</span>
            <span className="story-legend-pill">SAST + SCA + Secrets</span>
            <span className="story-legend-pill">AI-Assisted Remediation</span>
            <span className="story-legend-pill">Runtime Correlation</span>
          </div>
        </div>

        <div className="story-command-card glass-card">
          <div className="story-command-topline">
            <span className="status-badge online">Secure Delivery Active</span>
            <span className="metric-value">{time}</span>
          </div>

          <div className="story-command-user">Welcome back, {sessionUser.displayName}</div>
          <div className="story-command-role">{sessionUser.role} · {sessionUser.org}</div>

          <div className="story-command-metrics">
            <div>
              <div className="story-command-label">Projects protected</div>
              <div className="story-command-value">128</div>
            </div>
            <div>
              <div className="story-command-label">High-risk findings</div>
              <div className="story-command-value">07</div>
            </div>
            <div>
              <div className="story-command-label">Deploy readiness</div>
              <div className="story-command-value">82%</div>
            </div>
          </div>

          <div className="story-command-rail">
            <div className="story-rail-label">Attack surface drift</div>
            <div className="story-mini-chart">
              {SPARK_HEIGHTS.slice(0, 10).map((height, index) => (
                <span key={index} style={{ height: `${Math.max(22, height)}%` }} />
              ))}
            </div>
            <div className="story-rail-note">Runtime protections and code changes remain correlated across this release window.</div>
          </div>
        </div>
      </section>

      {renderMetricCards(metricCards)}

      <section className="story-section">
        <div className="story-section-heading">
          <div>
            <div className="page-title">Role Journey</div>
            <div className="page-subtitle">The portal changes shape by responsibility, so every role sees the workflow that actually belongs to them.</div>
          </div>
        </div>

        <JourneyRail workspace={workspace} />
      </section>

      <section className="story-main-grid">
        <ExperienceBoard workspace={workspace} sessionUser={sessionUser} />
        <div className="story-right-column">
          <div className="glass-card section-card story-love-card">
            <div className="section-title"><span>✓</span> Why Teams Stay In One Console</div>
            <div className="story-love-list">
              <div>Each role lands on purpose-built content instead of a generic shared homepage.</div>
              <div>AI suggestions stay grounded in tenant-safe evidence and role permissions.</div>
              <div>Administrative users stay in governance flows while engineers stay in technical workflows.</div>
              <div>Cross-tenant actions remain exclusive to the platform role.</div>
            </div>
          </div>

          <div className="glass-card section-card">
            <div className="section-title"><span>🚀</span> Platform Outcomes</div>
            <div className="story-list-row compact"><span className="story-list-title">Mean time to triage</span><span className="story-list-value">11m</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Automated fix acceptance</span><span className="story-list-value">73%</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Correlated runtime signals</span><span className="story-list-value">14.2k</span></div>
            <div className="story-list-row compact"><span className="story-list-title">Tenant evidence packs</span><span className="story-list-value">42</span></div>
          </div>
        </div>
      </section>

      <section className="story-role-grid">
        <div className="glass-card section-card">
          <div className="section-title">
            <span className="section-title-icon">🚨</span>
            Live Incident Feed
          </div>
          <IncidentTable />
        </div>

        <RoleSpotlight workspace={workspace} />
      </section>

      <section className="story-role-grid">
        {workspace === 'platform-admin' && <PlatformAdminWorkspace />}
        {workspace === 'company-admin' && <CompanyAdminWorkspace />}
        {workspace === 'company-engineer' && <CompanyEngineerWorkspace />}
      </section>
    </div>
  );
}
