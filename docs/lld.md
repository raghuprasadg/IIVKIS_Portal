# IIVKIS Low-Level Design (LLD)

**Document ID:** IIVKIS-ARCH-002  
**Version:** 1.0.2  
**Status:** Validated — Phase 3 Validation Pass  
**Phase:** STEP 3 — Architecture Design  
**Author:** Architect Agent  
**Date:** 2026-03-28  
**References:** [IIVKIS-ARCH-001 HLD](hld.md), [IIVKIS-REQ-001 v1.1.0](requirements.md), [IIVKIS-SEC-001 v1.0.1](threat-model.md)

### Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-03-28 | Architect Agent | Initial LLD — database schemas, API contracts, service interfaces, KG schema, CE state machine, LLM gateway internals |
| 1.0.1 | 2026-03-28 | Architect Agent | Phase 3 Validation — added 6 missing routing entries, 5 missing DB schemas (notification_policies, chat_sessions/messages, feed_subscriptions, feature_flags), RLS on 5 tables (sla_policies, integration_events, subscriptions, usage_ledger, correlation_rules), FK on correlation_groups.root_cause_ci |
| 1.0.2 | 2026-04-03 | Engineering Agent | Implementation-alignment metadata refresh — added runtime note for tenant-bound DB context and route/schema contract updates tracked in implementation refresh document |

### Implementation Alignment Note (2026-04-03)

This LLD remains the architecture contract baseline. Runtime alignment changes
applied after the Phase 12 snapshot (tenant-bound request DB context, API
route/schema reconciliation, portal chat orchestrator fallback hardening)
are documented in:

- [Implementation Refresh (2026-04-03)](implementation-refresh-2026-04-03.md)

---

## Table of Contents

1. [Module Interfaces & Contracts](#1-module-interfaces--contracts)
2. [Database Schemas](#2-database-schemas)
   - 2.1 [Core Tenant & Identity Schema](#21-core-tenant--identity-schema)
   - 2.2 [Incident Management Schema](#22-incident-management-schema)
   - 2.3 [Vendor Knowledge Schema](#23-vendor-knowledge-schema)
   - 2.4 [Knowledge Graph Schema (Adjacency-List)](#24-knowledge-graph-schema-adjacency-list)
   - 2.5 [Correlation Engine Schema](#25-correlation-engine-schema)
   - 2.6 [Integration Schema](#26-integration-schema)
   - 2.7 [Billing Schema](#27-billing-schema)
   - 2.8 [Audit Log Schema](#28-audit-log-schema)
   - 2.9 [Notification Policies Schema](#29-notification-policies-schema)
   - 2.10 [Chat Sessions & Messages Schema](#210-chat-sessions--messages-schema)
   - 2.11 [Feed Subscriptions Schema](#211-feed-subscriptions-schema)
   - 2.12 [Feature Flags Schema](#212-feature-flags-schema)
3. [REST API Contract Sketches](#3-rest-api-contract-sketches)
4. [Internal Service Interfaces (TypeScript)](#4-internal-service-interfaces-typescript)
5. [KG+RAG Pipeline — Detailed Design](#5-kgrag-pipeline--detailed-design)
6. [Correlation Engine — Detailed Design](#6-correlation-engine--detailed-design)
7. [LLM Gateway — Detailed Design](#7-llm-gateway--detailed-design)
8. [Multi-Tenant Request Lifecycle](#8-multi-tenant-request-lifecycle)
9. [SaaS vs Self-Hosted Configuration Matrix](#9-saas-vs-self-hosted-configuration-matrix)
10. [Error Handling & Circuit Breaker Specification](#10-error-handling--circuit-breaker-specification)

---

## 1. Module Interfaces & Contracts

### 1.1 Agent Contract (All Agents)

Every agent implements the following interface (NFR-MAINT-003):

```typescript
// packages/shared/src/agent.ts

export interface AgentRequest {
  taskId: string;           // UUID — idempotency key (NFR-RES-022)
  taskType: AgentTaskType;  // enum — routes to correct agent
  tenantId: string;         // UUID — from JWT claim ONLY
  userId: string;           // UUID — requesting user
  traceId: string;          // OpenTelemetry trace ID
  spanId: string;           // OpenTelemetry span ID
  payload: Record<string, unknown>;
  timeoutMs: number;        // caller-specified timeout
  createdAt: string;        // ISO 8601 UTC
}

export interface AgentResponse {
  taskId: string;
  status: 'success' | 'partial' | 'failed' | 'degraded';
  tenantId: string;
  result?: Record<string, unknown>;
  error?: AgentError;
  latencyMs: number;
  modelUsed?: string;       // for LLM tasks: model name + version
  tokensUsed?: number;      // for LLM tasks
  createdAt: string;
}

export interface AgentError {
  code: string;             // machine-readable error code
  message: string;          // human-readable; no stack traces in production
  retryable: boolean;
  retryAfterMs?: number;
}

export type AgentTaskType =
  | 'vk.search'             // Vendor Knowledge semantic search
  | 'vk.ingest'             // Vendor Knowledge feed ingestion
  | 'vk.article.get'        // Get specific article
  | 'ts.plan.generate'      // Troubleshooting resolution plan
  | 'ts.chat.turn'          // Conversational chat turn
  | 'int.sync'              // Integration sync trigger
  | 'int.webhook.process'   // Inbound webhook processing
  | 'anlys.report'          // Analytics report generation
  | 'anlys.anomaly'         // Anomaly detection run
  | 'ce.signal.ingest'      // Signal ingestion into CE
  | 'ce.group.query'        // Query correlation groups
  | 'llm.complete'          // Direct LLM completion (internal)
  | 'llm.embed'             // Embedding generation (internal)
  ;
```

### 1.2 Orchestrator Routing Table

```typescript
// apps/orchestrator/src/routing-table.ts

export type RoutingTable = Map<AgentTaskType, {
  kafkaTopic: string;           // target topic
  timeoutMs: number;            // SLA-derived timeout
  maxRetries: number;
  circuitBreakerKey: string;
}>;

// Default routing configuration (overridable via feature flags)
export const DEFAULT_ROUTING: RoutingTable = new Map([
  ['vk.search',           { kafkaTopic: 'agent.vk.requests',      timeoutMs:  2_000, maxRetries: 2, circuitBreakerKey: 'vk-agent'    }],
  ['vk.ingest',           { kafkaTopic: 'agent.vk.requests',      timeoutMs: 30_000, maxRetries: 3, circuitBreakerKey: 'vk-agent'    }],
  ['vk.article.get',      { kafkaTopic: 'agent.vk.requests',      timeoutMs:  1_000, maxRetries: 2, circuitBreakerKey: 'vk-agent'    }],
  ['ts.plan.generate',    { kafkaTopic: 'agent.ts.requests',      timeoutMs: 10_000, maxRetries: 1, circuitBreakerKey: 'ts-agent'    }],
  ['ts.chat.turn',        { kafkaTopic: 'agent.ts.requests',      timeoutMs: 30_000, maxRetries: 0, circuitBreakerKey: 'ts-agent'    }],
  ['int.sync',            { kafkaTopic: 'agent.int.requests',     timeoutMs: 30_000, maxRetries: 3, circuitBreakerKey: 'int-agent'   }],
  ['int.webhook.process', { kafkaTopic: 'agent.int.requests',     timeoutMs:  5_000, maxRetries: 2, circuitBreakerKey: 'int-agent'   }],
  ['anlys.report',        { kafkaTopic: 'agent.anlys.requests',   timeoutMs: 60_000, maxRetries: 1, circuitBreakerKey: 'anlys-agent' }],
  ['anlys.anomaly',       { kafkaTopic: 'agent.anlys.requests',   timeoutMs: 30_000, maxRetries: 1, circuitBreakerKey: 'anlys-agent' }],
  ['ce.signal.ingest',    { kafkaTopic: 'ce.signals',             timeoutMs:  5_000, maxRetries: 3, circuitBreakerKey: 'ce'          }],
  ['ce.group.query',      { kafkaTopic: 'agent.ce.requests',      timeoutMs:  2_000, maxRetries: 2, circuitBreakerKey: 'ce'          }],
  ['llm.complete',        { kafkaTopic: 'llm.gateway.requests',   timeoutMs: 30_000, maxRetries: 1, circuitBreakerKey: 'llm-gateway' }],
  ['llm.embed',           { kafkaTopic: 'llm.gateway.requests',   timeoutMs:  5_000, maxRetries: 2, circuitBreakerKey: 'llm-gateway' }],
]);
```

### 1.3 Integration Adapter Interface

```typescript
// packages/agents/integration/src/adapter.ts

export interface IntegrationAdapter {
  readonly systemType: IntegrationSystemType;
  readonly version: string;

  /** Validate credentials and connectivity. */
  testConnection(config: IntegrationConfig): Promise<ConnectionTestResult>;

  /** Pull events/data since lastSyncCursor. */
  fetchInbound(config: IntegrationConfig, lastSyncCursor: string): Promise<InboundEvent[]>;

  /** Push an outbound update to the external system. */
  pushOutbound(config: IntegrationConfig, event: OutboundEvent): Promise<PushResult>;

  /** Parse a raw inbound webhook body (post-HMAC verification). */
  parseWebhook(body: unknown, headers: Record<string, string>): Promise<InboundEvent>;
}

export type IntegrationSystemType =
  | 'servicenow' | 'jira-sm' | 'pagerduty' | 'opsgenie'
  | 'datadog' | 'prometheus' | 'zabbix' | 'cloudwatch' | 'azure-monitor'
  | 'splunk' | 'generic-webhook';
```

---

## 2. Database Schemas

All tables use `UUID` primary keys and carry a `tenant_id UUID NOT NULL` foreign key
(except `tenants` itself). RLS policies are defined in the format shown in the HLD.

### 2.1 Core Tenant & Identity Schema

```sql
-- ─────────────────────────────────────────────
-- Tenants
-- ─────────────────────────────────────────────
CREATE TABLE tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,           -- URL-safe identifier
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active', -- active | suspended | deleted
  isolation_tier TEXT NOT NULL DEFAULT 'T1',     -- T1 | T2 | T3
  plan_id        UUID NOT NULL,
  region         TEXT NOT NULL,                  -- data-residency region
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  locale         TEXT NOT NULL DEFAULT 'en-US',
  byok_vault_path TEXT,                          -- Vault path for tenant KEK (T2/T3)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  retention_days INTEGER NOT NULL DEFAULT 30     -- post-deletion retention
);

-- ─────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',   -- active | suspended
  mfa_enabled  BOOLEAN NOT NULL DEFAULT false,
  sso_subject  TEXT,                             -- IdP sub claim (OIDC/SAML)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─────────────────────────────────────────────
-- Sessions
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  device_info  JSONB,                            -- {ua, ip, os, browser}
  last_active  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─────────────────────────────────────────────
-- Roles & Permissions
-- ─────────────────────────────────────────────
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),       -- NULL = platform-global role
  name        TEXT NOT NULL,
  is_builtin  BOOLEAN NOT NULL DEFAULT false,    -- true = tenant-admin | ops-engineer | read-only | billing-admin
  permissions JSONB NOT NULL DEFAULT '[]'        -- array of permission strings
);

CREATE TABLE user_roles (
  user_id     UUID NOT NULL REFERENCES users(id),
  role_id     UUID NOT NULL REFERENCES roles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
```

### 2.2 Incident Management Schema

```sql
CREATE TYPE incident_severity AS ENUM ('P1','P2','P3','P4','P5');
CREATE TYPE incident_status   AS ENUM ('open','in_progress','pending','resolved','closed');

CREATE TABLE incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  description     TEXT,
  severity        incident_severity NOT NULL,
  status          incident_status NOT NULL DEFAULT 'open',
  assignee_id     UUID REFERENCES users(id),
  team_id         UUID,
  correlation_group_id UUID,                     -- FK to correlation_groups
  sla_policy_id   UUID,                          -- FK to sla_policies
  sla_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_response_breached  BOOLEAN NOT NULL DEFAULT false,
  sla_resolution_breached BOOLEAN NOT NULL DEFAULT false,
  external_ref    JSONB,                         -- {system, id, url}
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_tenant_isolation ON incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_incidents_tenant_status  ON incidents (tenant_id, status);
CREATE INDEX idx_incidents_tenant_severity ON incidents (tenant_id, severity);
CREATE INDEX idx_incidents_sla_deadline   ON incidents (tenant_id, sla_resolution_deadline)
  WHERE status NOT IN ('resolved', 'closed');

-- SLA Policies
CREATE TABLE sla_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  severity        incident_severity NOT NULL,
  response_minutes  INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  escalation_tiers JSONB NOT NULL DEFAULT '[]',  -- [{tier:1, assignee_type, targets, notify_channels}]
  is_default      BOOLEAN NOT NULL DEFAULT false,
  version         INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_policies_tenant_isolation ON sla_policies
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2.3 Vendor Knowledge Schema

```sql
CREATE TABLE knowledge_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),   -- NULL = global shared corpus
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  content_hash    TEXT NOT NULL,                 -- SHA-256 for dedup
  source_type     TEXT NOT NULL,                 -- vendor_api | rss | upload | manual
  source_url      TEXT,
  source_id       TEXT,                          -- external identifier
  vendor_id       UUID,
  product_id      UUID,
  version_id      UUID,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  language        TEXT NOT NULL DEFAULT 'en',
  status          TEXT NOT NULL DEFAULT 'active', -- active | superseded | draft
  review_status   TEXT NOT NULL DEFAULT 'auto_approved', -- auto_approved | pending_review | approved | rejected
  version_number  INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES knowledge_articles(id), -- previous version
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  provenance      JSONB NOT NULL DEFAULT '{}'    -- {feed_id, signature_verified, ingestion_job_id}
);

ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY ka_tenant_isolation ON knowledge_articles
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);  -- global articles accessible to all tenants

-- Vector embeddings (pgvector)
-- One row per chunk of a knowledge article
CREATE TABLE knowledge_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id),   -- mirrors article.tenant_id for partition
  chunk_index     INTEGER NOT NULL,              -- 0-based chunk number within article
  chunk_text      TEXT NOT NULL,
  embedding       vector(1536) NOT NULL,         -- OpenAI text-embedding-3-small dimensions
  model_version   TEXT NOT NULL,                 -- embedding model name + version
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-namespaced ANN index: separate index per tenant (T3) or namespace filter (T1/T2)
CREATE INDEX idx_ke_embedding_global  ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
  WHERE tenant_id IS NULL;
-- Per-tenant indexes created dynamically at tenant onboarding (T2/T3):
-- CREATE INDEX idx_ke_embedding_{tenant_slug} ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops)
--   WHERE tenant_id = '{tenant_id}';
```

### 2.4 Knowledge Graph Schema (Adjacency-List)

```sql
-- Graph nodes: vendors, products, versions, advisories, patches, articles, EOL records
CREATE TABLE kg_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),       -- NULL = global
  node_type   TEXT NOT NULL,                     -- vendor | product | version | advisory | patch | eol
  label       TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kg_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY kg_nodes_tenant_isolation ON kg_nodes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

-- Graph edges: typed relationships
CREATE TABLE kg_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  from_node   UUID NOT NULL REFERENCES kg_nodes(id),
  to_node     UUID NOT NULL REFERENCES kg_nodes(id),
  edge_type   TEXT NOT NULL,                     -- HAS_PRODUCT | HAS_VERSION | HAS_ADVISORY | RECOMMENDS | AFFECTS | SUPERSEDES | HAS_EOL
  properties  JSONB NOT NULL DEFAULT '{}',
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY kg_edges_tenant_isolation ON kg_edges
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

CREATE INDEX idx_kg_edges_from   ON kg_edges (from_node, edge_type);
CREATE INDEX idx_kg_edges_to     ON kg_edges (to_node, edge_type);
CREATE INDEX idx_kg_edges_tenant ON kg_edges (tenant_id, edge_type);

-- CI Topology (from CMDB) — stored as KG nodes/edges with node_type = 'ci'
-- Edge types for CI: DEPENDS_ON | HOSTS | RUNS_ON | PART_OF
```

### 2.5 Correlation Engine Schema

```sql
CREATE TYPE signal_type AS ENUM (
  'monitoring_alert', 'incident', 'cmdb_change', 'vendor_advisory',
  'log_anomaly', 'user_observation'
);

CREATE TABLE signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  signal_type     signal_type NOT NULL,
  source_system   TEXT NOT NULL,
  external_id     TEXT,                          -- source system identifier
  fingerprint     TEXT NOT NULL,                 -- dedup hash (FR-INT-006)
  affected_ci_id  UUID,                          -- FK to kg_nodes (CI type)
  severity        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  raw_payload     JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aged_out_at     TIMESTAMPTZ,
  UNIQUE (tenant_id, fingerprint)
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY signals_tenant_isolation ON signals
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_signals_tenant_time ON signals (tenant_id, occurred_at DESC);
CREATE INDEX idx_signals_fingerprint ON signals (tenant_id, fingerprint);
CREATE INDEX idx_signals_ci          ON signals (tenant_id, affected_ci_id, occurred_at DESC);

-- Correlation Groups
CREATE TABLE correlation_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  status          TEXT NOT NULL DEFAULT 'proposed', -- proposed | confirmed | rejected | merged
  confidence      NUMERIC(5,2) NOT NULL,             -- 0.00 – 100.00
  root_cause_ci   UUID REFERENCES kg_nodes(id),           -- most likely root-cause CI (FK to CI node)
  root_cause_narrative TEXT,                         -- LLM-generated explanation
  correlation_methods TEXT[] NOT NULL DEFAULT '{}',  -- which processors contributed
  rule_ids        UUID[],                            -- rule-based: which rules matched
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

ALTER TABLE correlation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY cg_tenant_isolation ON correlation_groups
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Signal ↔ Correlation Group membership
CREATE TABLE signal_group_memberships (
  signal_id           UUID NOT NULL REFERENCES signals(id),
  correlation_group_id UUID NOT NULL REFERENCES correlation_groups(id),
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, correlation_group_id)
);

-- Correlation Rules (tenant-scoped, versioned)
CREATE TABLE correlation_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),       -- NULL = global platform rules
  name        TEXT NOT NULL,
  description TEXT,
  dsl_body    JSONB NOT NULL,                    -- rule definition (see CE detailed design §6)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  version     INTEGER NOT NULL DEFAULT 1,
  parent_id   UUID REFERENCES correlation_rules(id),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE correlation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY correlation_rules_tenant_isolation ON correlation_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);  -- global platform rules accessible to all tenants
```

### 2.6 Integration Schema

```sql
CREATE TABLE integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  system_type     TEXT NOT NULL,                 -- servicenow | datadog | ...
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'inactive', -- active | inactive | error
  config_ref      TEXT NOT NULL,                 -- Vault path (never stored inline)
  webhook_token   TEXT,                          -- hashed HMAC key reference (Vault)
  ip_allowlist    INET[],                        -- FR-INT-010
  last_sync_at    TIMESTAMPTZ,
  last_sync_cursor TEXT,
  error_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrations_tenant_isolation ON integrations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Integration Events (DLQ-inspectable)
CREATE TABLE integration_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  integration_id  UUID NOT NULL REFERENCES integrations(id),
  direction       TEXT NOT NULL,                 -- inbound | outbound
  event_type      TEXT NOT NULL,
  fingerprint     TEXT NOT NULL,
  payload_ref     TEXT,                          -- S3 key for large payloads
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | failed | dlq
  retry_count     INTEGER NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  error_detail    TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_events_tenant_isolation ON integration_events
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2.7 Billing Schema

```sql
CREATE TABLE plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                   -- Starter | Professional | Enterprise
  price_cents   INTEGER NOT NULL,
  billing_period TEXT NOT NULL,                  -- monthly | annual
  features      JSONB NOT NULL DEFAULT '{}',     -- {max_users, api_ratelimit, llm_tokens_day, ...}
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  plan_id       UUID NOT NULL REFERENCES plans(id),
  status        TEXT NOT NULL DEFAULT 'active',  -- active | cancelled | past_due
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end   TIMESTAMPTZ NOT NULL,
  external_subscription_id TEXT,                 -- Stripe subscription ID
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Tamper-evident usage ledger (append-only, never UPDATE/DELETE)
CREATE TABLE usage_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  metric_type   TEXT NOT NULL,                   -- api_call | llm_token | storage_gb | user
  metric_value  NUMERIC(20,6) NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  source_ref    TEXT,                            -- trace_id of originating request
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No UPDATE/DELETE privileges granted on this table
);

-- RLS is intentionally SELECT-only for the billing service role; INSERT allowed via dedicated role
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_ledger_tenant_isolation ON usage_ledger
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_usage_ledger_tenant_period ON usage_ledger (tenant_id, period_start, metric_type);
```

### 2.8 Audit Log Schema

```sql
-- Append-only table — no UPDATE/DELETE (enforced via GRANT SELECT, INSERT only)
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),     -- NULL for platform-level actions
  actor_id      UUID,                            -- user or service account
  actor_type    TEXT NOT NULL,                   -- user | service | super_admin
  action        TEXT NOT NULL,                   -- e.g. incident.create, tenant.suspend
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  source_ip     INET,
  user_agent    TEXT,
  request_id    TEXT,                            -- trace_id
  before_state  JSONB,
  after_state   JSONB,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partitioned by month for efficient archival
CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_actor_time  ON audit_logs (actor_id, occurred_at DESC);
```

### 2.9 Notification Policies Schema

```sql
-- Tenant-configurable routing: event_type → channel(s)
CREATE TABLE notification_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  event_type      TEXT NOT NULL,                 -- correlation.group.created | incident.sla_breach | billing.budget_threshold | security.auth_anomaly | ...
  channel_type    TEXT NOT NULL,                 -- email | slack | teams | pagerduty | opsgenie | webhook
  channel_config  JSONB NOT NULL DEFAULT '{}',   -- channel-specific config (e.g., {webhook_url, channel_id})
  recipient_ids   UUID[],                        -- target user IDs (empty = all ops-engineer role)
  severity_filter TEXT[],                        -- only trigger for these severities (empty = all)
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_policies_tenant_isolation ON notification_policies
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_notif_policies_tenant_event ON notification_policies (tenant_id, event_type)
  WHERE is_active = true;
```

### 2.10 Chat Sessions & Messages Schema

```sql
-- AI chat sessions (linked to incidents, or standalone knowledge queries)
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  incident_id     UUID REFERENCES incidents(id),   -- optional link to an incident
  title           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | archived
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_tenant_isolation ON chat_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_chat_sessions_tenant_user ON chat_sessions (tenant_id, user_id, created_at DESC);

CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  role            TEXT NOT NULL,                   -- user | assistant | system
  content         TEXT NOT NULL,
  citations       JSONB,                           -- [{article_id, title, url, chunk_index}]
  model_used      TEXT,                            -- for assistant messages
  tokens_used     INTEGER,
  feedback        TEXT,                            -- positive | negative | NULL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_tenant_isolation ON chat_messages
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at ASC);
```

### 2.11 Feed Subscriptions Schema

```sql
CREATE TABLE feed_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),     -- NULL = global platform feed
  name            TEXT NOT NULL,
  feed_type       TEXT NOT NULL,                   -- rss | atom | vendor_api | manual_upload
  source_url      TEXT,
  auth_ref        TEXT,                            -- Vault path to feed credentials (if needed)
  schedule_cron   TEXT NOT NULL DEFAULT '0 */4 * * *', -- default every 4 hours
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_etag       TEXT,                            -- HTTP ETag for conditional requests
  last_modified   TEXT,                            -- HTTP Last-Modified for conditional requests
  error_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feed_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_subscriptions_tenant_isolation ON feed_subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);  -- global feeds visible to all tenants

CREATE INDEX idx_feed_subs_tenant_active ON feed_subscriptions (tenant_id, is_active);
```

### 2.12 Feature Flags Schema

```sql
-- Feature flags (NFR-MAINT-005) — support gradual rollout and instant rollback
CREATE TABLE feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,            -- e.g. 'ce.ml_correlator', 'llm.semantic_cache'
  description     TEXT,
  enabled_globally BOOLEAN NOT NULL DEFAULT false,
  enabled_tenant_ids UUID[],                       -- explicit tenant allowlist (overrides global)
  disabled_tenant_ids UUID[],                      -- explicit tenant denylist (overrides global+allowlist)
  rollout_pct     SMALLINT NOT NULL DEFAULT 0,     -- 0–100 % gradual rollout (hash-based)
  metadata        JSONB NOT NULL DEFAULT '{}',     -- {owner, ticket, release_version}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — feature flags are readable by all authenticated services (platform-global)
-- Access is controlled at the API layer (ops-engineer and super-admin roles only for writes)
CREATE INDEX idx_feature_flags_name ON feature_flags (name);
```

All endpoints prefixed `/api/v1/`. Full OpenAPI 3.1 specs in `apps/api/openapi/`.

### 3.1 Authentication

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/sessions                    — list active sessions (FR-IAM-008)
DELETE /api/v1/auth/sessions/{sessionId}        — revoke session
DELETE /api/v1/auth/sessions                    — revoke all sessions
```

### 3.2 Incidents

```
GET    /api/v1/incidents                        — list (filter: status, severity, assignee)
POST   /api/v1/incidents                        — create
GET    /api/v1/incidents/{id}                   — get detail
PATCH  /api/v1/incidents/{id}                   — update (status, assignee, severity)
DELETE /api/v1/incidents/{id}                   — soft-delete

GET    /api/v1/incidents/{id}/timeline          — event timeline
GET    /api/v1/incidents/{id}/resolution-plan   — generated resolution plan
POST   /api/v1/incidents/{id}/resolution-plan   — trigger plan generation
GET    /api/v1/incidents/{id}/correlation-group — linked correlation group

GET    /api/v1/sla-policies
POST   /api/v1/sla-policies
PATCH  /api/v1/sla-policies/{id}
```

### 3.3 Vendor Knowledge

```
GET    /api/v1/knowledge/articles               — list (filter: vendor, product, tags)
GET    /api/v1/knowledge/articles/{id}          — get article
GET    /api/v1/knowledge/articles/{id}/versions — version history
POST   /api/v1/knowledge/search                 — semantic + keyword search
  Body: { query: string, topK?: number, filters?: {...} }
  Response: { results: [{article, score, chunks}] }

GET    /api/v1/knowledge/graph/vendors
GET    /api/v1/knowledge/graph/products
GET    /api/v1/knowledge/graph/advisories
GET    /api/v1/knowledge/graph/{nodeId}/neighbours  — 1-hop graph traversal

GET    /api/v1/knowledge/feeds                  — list feed subscriptions
POST   /api/v1/knowledge/feeds                  — subscribe to feed
PATCH  /api/v1/knowledge/feeds/{id}             — update feed config
DELETE /api/v1/knowledge/feeds/{id}             — unsubscribe
POST   /api/v1/knowledge/feeds/{id}/refresh     — trigger on-demand refresh
```

### 3.4 Correlation Engine

```
GET    /api/v1/correlation/groups               — list groups (filter: status, confidence)
GET    /api/v1/correlation/groups/{id}          — group detail + contributing signals
PATCH  /api/v1/correlation/groups/{id}          — accept | reject | merge
GET    /api/v1/correlation/signals              — list signals (filter: type, time range, CI)
POST   /api/v1/correlation/signals              — manually inject a signal

GET    /api/v1/correlation/rules
POST   /api/v1/correlation/rules
PATCH  /api/v1/correlation/rules/{id}
DELETE /api/v1/correlation/rules/{id}
```

### 3.5 AI Chat (Troubleshooting)

```
POST   /api/v1/chat/sessions                    — create chat session (linked to incident)
GET    /api/v1/chat/sessions/{id}               — get session + history
POST   /api/v1/chat/sessions/{id}/messages      — send message
  Response: text/event-stream (SSE) — FR-LLM-017 streaming
GET    /api/v1/chat/sessions/{id}/messages      — full message history
POST   /api/v1/chat/sessions/{id}/feedback      — thumbs up/down (FR-LLM-015)
```

### 3.6 Integrations

```
GET    /api/v1/integrations
POST   /api/v1/integrations
GET    /api/v1/integrations/{id}
PATCH  /api/v1/integrations/{id}
DELETE /api/v1/integrations/{id}
POST   /api/v1/integrations/{id}/test           — connectivity test
POST   /api/v1/integrations/{id}/sync           — on-demand sync trigger
GET    /api/v1/integrations/{id}/health         — status, last-sync, error count

POST   /api/v1/webhooks/{tenantSlug}/{endpointToken}  — inbound webhook receiver
```

### 3.7 Analytics

```
GET    /api/v1/analytics/incidents              — volume trend, MTTR
GET    /api/v1/analytics/products               — top affected products
GET    /api/v1/analytics/correlation            — accuracy metrics
GET    /api/v1/analytics/llm-usage              — token consumption, cost
GET    /api/v1/analytics/sla                    — SLA compliance metrics
```

---

## 4. Internal Service Interfaces (TypeScript)

### 4.1 LLM Gateway Interface

```typescript
// packages/shared/src/llm-gateway.ts

export interface LLMCompletionRequest {
  taskId: string;
  tenantId: string;
  userId?: string;
  model?: 'auto' | 'fast' | 'capable' | string;  // tier or explicit model
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;                               // FR-LLM-017
  taskType?: 'chat' | 'plan' | 'search' | 'summary' | 'embedding';
  cacheable?: boolean;                            // opt-in for semantic caching
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionResponse {
  taskId: string;
  content: string;
  model: string;
  tokensPrompt: number;
  tokensCompletion: number;
  cached: boolean;
  provider: string;
  latencyMs: number;
}

export type LLMStreamChunk = {
  type: 'delta';
  content: string;
  done: false;
} | {
  type: 'done';
  totalTokens: number;
  done: true;
};
```

### 4.2 Correlation Engine Signal Interface

```typescript
// packages/shared/src/correlation.ts

export interface SignalIngestionRequest {
  tenantId: string;
  signals: Signal[];
}

export interface Signal {
  externalId?: string;
  signalType: SignalType;
  sourceSystem: string;
  affectedCiId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description?: string;
  rawPayload?: Record<string, unknown>;
  occurredAt: string;   // ISO 8601
}

export type SignalType =
  | 'monitoring_alert' | 'incident' | 'cmdb_change'
  | 'vendor_advisory' | 'log_anomaly' | 'user_observation';
```

---

## 5. KG+RAG Pipeline — Detailed Design

### 5.1 Chunking Strategy

Knowledge articles are split into overlapping chunks before embedding:

```
Article (full text)
  │
  ▼
Chunker (sliding window)
  chunk_size = 512 tokens (overlap = 64 tokens)
  respects paragraph/section boundaries
  │
  ├── Chunk 0: tokens 0–511
  ├── Chunk 1: tokens 448–959
  ├── Chunk 2: tokens 896–1407
  └── ...

Each chunk → Embedding model (text-embedding-3-small, 1536 dims)
          → Stored in knowledge_embeddings with chunk_index
```

### 5.2 Hybrid Retrieval Algorithm

```
Query → Query Embedder → q_vec (1536 dims)

Parallel retrieval (tenant-namespaced):
  A. Vector search:     SELECT id, chunk_text, 1 - (embedding <=> q_vec) AS cos_sim
                        FROM knowledge_embeddings
                        WHERE tenant_id = $1 OR tenant_id IS NULL
                        ORDER BY embedding <=> q_vec LIMIT 50;

  B. Full-text search:  SELECT id, ts_rank(to_tsvector(content), query) AS rank
                        FROM knowledge_articles
                        WHERE (tenant_id = $1 OR tenant_id IS NULL)
                          AND to_tsvector(content) @@ plainto_tsquery($2)
                        ORDER BY rank DESC LIMIT 20;

  C. KG traversal:      Extract entities from query (vendor, product, version)
                        → SELECT * FROM kg_edges WHERE from_node IN (matched_nodes)
                          AND edge_type IN ('HAS_ADVISORY','RECOMMENDS','AFFECTS')
                          AND (tenant_id = $1 OR tenant_id IS NULL);

Merge & Re-rank:
  RRF (Reciprocal Rank Fusion) score = Σ 1/(k + rank_i)  for each result list
  → Top-N (default 10) after RRF
  → Context window fitting: accumulate chunks until max_context_tokens reached

LLM prompt assembly:
  System: "You are an IT knowledge assistant. Answer using only the provided context."
  Context: [assembled chunks with source citations]
  User: [original query]
```

### 5.3 Feed Ingestion State Machine

```
States: PENDING → FETCHING → PARSING → DEDUPLICATING → EMBEDDING → COMPLETE
                                                                   ↗ FAILED (retryable)

Transitions:
  PENDING      → FETCHING:       scheduler triggers or on-demand request
  FETCHING     → PARSING:        HTTP response received (streaming parser)
  FETCHING     → FAILED:         HTTP error / timeout / payload > 100 MB
  PARSING      → DEDUPLICATING:  all items parsed to canonical schema
  PARSING      → FAILED:         schema validation failure
  DEDUPLICATING → EMBEDDING:     new/changed items identified (hash comparison)
  EMBEDDING    → COMPLETE:       all new chunks embedded and indexed
  EMBEDDING    → FAILED:         embedding API failure (retried with backoff)
  FAILED       → PENDING:        retry scheduler (max 3 retries)
```

---

## 6. Correlation Engine — Detailed Design

### 6.1 Signal Processing Pipeline

```
Kafka Topic: ce.signals.{tenantId}  (T3)
          or ce.signals (T1/T2, partitioned by tenant_id)

Consumer Group: ce-processor (KEDA auto-scaled on Kafka lag)

Per-message processing (target: < 100ms per signal):
  1. Deserialise + validate signal schema
  2. Compute fingerprint: SHA-256(tenantId + sourceSystem + externalId + occurredAt.floor(minute))
  3. Idempotency check: INSERT INTO signals ... ON CONFLICT (tenant_id, fingerprint) DO NOTHING
  4. Enrich: resolve affectedCiId from CMDB graph (cache: Redis, TTL 5 min)
  5. Publish enriched signal to internal fanout topic: ce.signals.enriched
```

### 6.2 Correlation DSL

Rule-based correlation uses a JSON DSL stored in `correlation_rules.dsl_body`:

```json
{
  "name": "Database host down → cascade",
  "match": {
    "any": [
      { "field": "signal_type", "eq": "monitoring_alert" },
      { "field": "signal_type", "eq": "log_anomaly" }
    ]
  },
  "group_by": {
    "topology": { "relation": "DEPENDS_ON", "hops": 2 },
    "time_window_minutes": 10
  },
  "require_signals": { "min": 3 },
  "output": {
    "confidence_base": 75,
    "confidence_boost_per_additional_signal": 5,
    "max_confidence": 95
  }
}
```

### 6.3 Confidence Scoring

```
confidence = base_confidence
           + temporal_score   (0–25: signals within 1 min = 25, within 5 min = 10)
           + topological_score (0–30: direct parent CI = 30, 2-hop = 15, 3-hop = 5)
           + semantic_score   (0–25: cosine-sim > 0.9 = 25, > 0.7 = 15)
           + rule_score       (0–20: matching rule adds rule.output.confidence_base weight)
           clamped to [0, 100]
```

### 6.4 Correlation Group State Machine

```
States: PROPOSED → CONFIRMED → RESOLVED
                ↘ REJECTED
                ↘ MERGED (into another group)

Transitions:
  PROPOSED  → CONFIRMED: engineer accepts (FR-CE-023)
  PROPOSED  → REJECTED:  engineer rejects
  PROPOSED  → MERGED:    engineer merges with another group
  CONFIRMED → RESOLVED:  all linked incidents resolved
  CONFIRMED → MERGED:    subsequent merge with higher-confidence group
```

---

## 7. LLM Gateway — Detailed Design

### 7.1 Request Pipeline

```
Inbound request (internal mTLS)
  │
  ├─ 1. Budget check (Redis: tenant daily token counter)
  │      If counter + estimated_tokens > budget → HTTP 429 with Retry-After
  │
  ├─ 2. Guardrails — input scan (OPA policy)
  │      Blocked patterns: prompt injection keywords, PII patterns in system prompt
  │      If blocked → HTTP 400 with guardrail_reason
  │
  ├─ 3. Semantic cache lookup (only if cacheable=true)
  │      q_vec = embed(messages[-1].content)  [fast in-process embedding]
  │      SELECT content, cos_sim FROM llm_cache
  │        WHERE tenant_id = $1 AND (1 - (embedding <=> q_vec)) >= 0.97
  │        ORDER BY embedding <=> q_vec LIMIT 1;
  │      Cache hit → return cached response, skip provider call
  │
  ├─ 4. Model-tier routing
  │      task_complexity = classify(messages) → simple | moderate | complex
  │      model = tenant_config.model_tier_map[task_complexity] ?? default
  │
  ├─ 5. Provider dispatch
  │      primary_provider = tenant_config.providers[task_type] ?? platform_default
  │      Try primary; on failure (5xx / timeout) → fallback provider
  │      Circuit breaker per provider (open after 5 failures / 60s)
  │
  ├─ 6. Streaming (if stream=true)
  │      SSE: push delta chunks to caller as received from provider
  │
  ├─ 7. PII redaction
  │      Redact before writing prompt+completion to audit log
  │      Patterns: email, phone, SSN, credit card, IP address (regex + NER model)
  │
  ├─ 8. Cache write (if cacheable=true and not already cached)
  │      INSERT INTO llm_cache (tenant_id, prompt_embedding, content, ...)
  │
  └─ 9. Token metering
         Publish to Kafka: billing.usage { metric: 'llm_token', value: total_tokens, ... }
         Increment Redis counter: tenant:{id}:llm_tokens:{date}
```

### 7.2 LLM Cache Schema

```sql
CREATE TABLE llm_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  prompt_hash     TEXT NOT NULL,                 -- SHA-256(serialised messages)
  prompt_embedding vector(1536) NOT NULL,        -- for similarity lookup
  response_content TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_prompt   INTEGER NOT NULL,
  tokens_completion INTEGER NOT NULL,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at     TIMESTAMPTZ
);

CREATE INDEX idx_llm_cache_tenant_embed ON llm_cache
  USING hnsw (prompt_embedding vector_cosine_ops)
  WHERE tenant_id IS NOT NULL;  -- filtered index per tenant namespace
```

---

## 8. Multi-Tenant Request Lifecycle

Tracing a single API request end-to-end:

```
1. Browser → HTTPS → WAF → Ingress → API Pod

2. API middleware stack (in order):
   a. TLS termination (ingress level)
   b. OTel trace extraction / injection
   c. JWT verification (RS256, JWKS from Vault)
   d. tenant_id extraction from JWT claim
   e. DB connection pool: SET app.current_tenant_id = '{tenant_id}'
   f. OPA pre-authorisation: allow/deny + rbac check
   g. Rate-limit check (Redis token bucket: tenant:{id}:rl:{endpoint})
   h. Request handler

3. Handler calls Orchestrator (mTLS):
   POST /internal/v1/tasks  {taskType, tenantId, userId, traceId, payload}

4. Orchestrator:
   a. Looks up routing table → target Kafka topic
   b. Assigns idempotency key (taskId = UUID)
   c. Publishes to Kafka with headers: tenant_id, trace_id, task_id
   d. Awaits response on reply topic (correlation by task_id)

5. Agent consumes message:
   a. Validates tenant_id in header against JWT (re-verification at agent boundary)
   b. Calls DB/Redis/VectorDB with tenant_id constraint
   c. Publishes result to reply topic

6. Orchestrator receives result → HTTP response to API

7. API:
   a. Writes audit log entry (actor, action, resource, tenant_id, source_ip, trace_id)
   b. Returns HTTP response with security headers

8. Throughout: OTel spans capture each hop with tenant_id as span attribute
```

---

## 9. SaaS vs Self-Hosted Configuration Matrix

| Feature | SaaS | Self-Hosted |
|---|---|---|
| Database | AWS Aurora PostgreSQL (managed) | bitnami/postgresql Helm chart or BYO |
| pgvector | Aurora pgvector extension | postgresql-pgvector sidecar |
| Redis | AWS ElastiCache | bitnami/redis Helm chart or BYO |
| Kafka | AWS MSK | strimzi-kafka-operator or BYO |
| Object Store | AWS S3 | MinIO Helm chart or BYO S3-compatible |
| Vault | HCP Vault or self-managed on EKS | HashiCorp Vault Helm chart |
| LLM Provider | OpenAI / Anthropic / Azure OpenAI | Ollama / vLLM / cloud (customer choice) |
| Ingress | AWS ALB + NGINX Ingress | NGINX Ingress or Traefik (customer choice) |
| TLS | AWS ACM | cert-manager + Let's Encrypt or custom CA |
| Observability | AWS CloudWatch + managed Grafana | Prometheus + Grafana + Loki + Tempo (in-cluster) |
| Backups | AWS automated (RDS snapshots, S3 versioning) | velero + pgBackRest (customer manages) |
| License validation | Online JWT check at startup | Offline signature check (no phone-home) |
| Updates | Platform-managed rolling deploy | `helm upgrade iivkis/iivkis-stack` |

---

## 10. Error Handling & Circuit Breaker Specification

### 10.1 HTTP Error Response Format

```typescript
// All error responses follow this schema (no stack traces in production)
export interface ApiError {
  error: {
    code: string;           // machine-readable: TENANT_NOT_FOUND | RATE_LIMIT_EXCEEDED | ...
    message: string;        // human-readable
    requestId: string;      // trace_id for correlation with internal logs
    retryable: boolean;
    retryAfterMs?: number;  // for 429 / 503
  };
}
```

### 10.2 Circuit Breaker Configuration

Each external dependency (LLM provider, integration, agent) has a circuit breaker:

```typescript
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;       // default: 5 consecutive failures
  failureWindowMs: number;        // within this window: default 60_000 ms
  halfOpenProbeIntervalMs: number; // default: 30_000 ms
  halfOpenSuccessThreshold: number; // default: 2 successes to close
  timeoutMs: number;              // request timeout before counting as failure
}
```

States: `CLOSED` (normal) → `OPEN` (all requests rejected fast) → `HALF_OPEN` (probe) → `CLOSED`

### 10.3 Retry Policy

```typescript
export interface RetryPolicy {
  maxRetries: number;             // default: 3 (internal), 0 for streaming
  initialDelayMs: number;         // default: 500
  backoffMultiplier: number;      // default: 2.0 (exponential)
  maxDelayMs: number;             // cap: default 30_000
  jitterFactor: number;           // random jitter: 0.0–1.0, default 0.3
  retryableStatusCodes: number[]; // default: [429, 500, 502, 503, 504]
}
```

Idempotency: all retried tasks use the same `taskId` UUID. The agent's INSERT uses
`ON CONFLICT (tenant_id, fingerprint) DO NOTHING` to prevent duplicate processing.
