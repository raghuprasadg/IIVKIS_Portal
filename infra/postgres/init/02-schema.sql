-- IIVKIS full application schema — migration 0002
-- Applies all 27 tables defined in the LLD (IIVKIS-ARCH-002 v1.0.1).
-- Run after 01-extensions.sql which creates the iivkis schema and enables extensions.

SET search_path = iivkis, public;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.1  Core Tenant & Identity Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',   -- active | suspended | deleted
  isolation_tier TEXT NOT NULL DEFAULT 'T1',       -- T1 | T2 | T3
  plan_id        UUID NOT NULL,
  region         TEXT NOT NULL,
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  locale         TEXT NOT NULL DEFAULT 'en-US',
  byok_vault_path TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  retention_days INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',     -- active | suspended
  mfa_enabled  BOOLEAN NOT NULL DEFAULT false,
  sso_subject  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  device_info JSONB,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),         -- NULL = platform-global role
  name        TEXT NOT NULL,
  is_builtin  BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id),
  role_id    UUID NOT NULL REFERENCES roles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.2  Incident Management Schema
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('P1','P2','P3','P4','P5');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('open','in_progress','pending','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS incidents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),
  title                    TEXT NOT NULL,
  description              TEXT,
  severity                 incident_severity NOT NULL,
  status                   incident_status NOT NULL DEFAULT 'open',
  assignee_id              UUID REFERENCES users(id),
  team_id                  UUID,
  correlation_group_id     UUID,
  sla_policy_id            UUID,
  sla_response_deadline    TIMESTAMPTZ,
  sla_resolution_deadline  TIMESTAMPTZ,
  sla_response_breached    BOOLEAN NOT NULL DEFAULT false,
  sla_resolution_breached  BOOLEAN NOT NULL DEFAULT false,
  external_ref             JSONB,
  tags                     TEXT[] NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at              TIMESTAMPTZ,
  closed_at                TIMESTAMPTZ
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_tenant_isolation ON incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status   ON incidents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_severity ON incidents (tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_sla_deadline    ON incidents (tenant_id, sla_resolution_deadline)
  WHERE status NOT IN ('resolved', 'closed');

CREATE TABLE IF NOT EXISTS sla_policies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  name               TEXT NOT NULL,
  severity           incident_severity NOT NULL,
  response_minutes   INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  escalation_tiers   JSONB NOT NULL DEFAULT '[]',
  is_default         BOOLEAN NOT NULL DEFAULT false,
  version            INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_policies_tenant_isolation ON sla_policies
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.3  Vendor Knowledge Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id),       -- NULL = global shared corpus
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  source_type    TEXT NOT NULL,                     -- vendor_api | rss | upload | manual
  source_url     TEXT,
  source_id      TEXT,
  vendor_id      UUID,
  product_id     UUID,
  version_id     UUID,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  language       TEXT NOT NULL DEFAULT 'en',
  status         TEXT NOT NULL DEFAULT 'active',    -- active | superseded | draft
  review_status  TEXT NOT NULL DEFAULT 'auto_approved',
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_id      UUID REFERENCES knowledge_articles(id),
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  provenance     JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY ka_tenant_isolation ON knowledge_articles
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES tenants(id),
  chunk_index   INTEGER NOT NULL,
  chunk_text    TEXT NOT NULL,
  embedding     vector(1536) NOT NULL,
  model_version TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ke_embedding_global ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WHERE tenant_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.4  Knowledge Graph Schema (Adjacency-List)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kg_nodes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id),
  node_type  TEXT NOT NULL,   -- vendor | product | version | advisory | patch | eol | ci
  label      TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kg_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY kg_nodes_tenant_isolation ON kg_nodes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

CREATE TABLE IF NOT EXISTS kg_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  from_node   UUID NOT NULL REFERENCES kg_nodes(id),
  to_node     UUID NOT NULL REFERENCES kg_nodes(id),
  edge_type   TEXT NOT NULL,  -- HAS_PRODUCT | HAS_VERSION | HAS_ADVISORY | RECOMMENDS | AFFECTS | SUPERSEDES | HAS_EOL | DEPENDS_ON | HOSTS | RUNS_ON | PART_OF
  properties  JSONB NOT NULL DEFAULT '{}',
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY kg_edges_tenant_isolation ON kg_edges
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from   ON kg_edges (from_node, edge_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to     ON kg_edges (to_node, edge_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_tenant ON kg_edges (tenant_id, edge_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.5  Correlation Engine Schema
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE signal_type AS ENUM (
    'monitoring_alert', 'incident', 'cmdb_change', 'vendor_advisory',
    'log_anomaly', 'user_observation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS signals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  signal_type    signal_type NOT NULL,
  source_system  TEXT NOT NULL,
  external_id    TEXT,
  fingerprint    TEXT NOT NULL,
  affected_ci_id UUID,
  severity       TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  raw_payload    JSONB NOT NULL DEFAULT '{}',
  occurred_at    TIMESTAMPTZ NOT NULL,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  aged_out_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, fingerprint)
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY signals_tenant_isolation ON signals
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_signals_tenant_time ON signals (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_fingerprint ON signals (tenant_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_signals_ci          ON signals (tenant_id, affected_ci_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS correlation_groups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id),
  status                  TEXT NOT NULL DEFAULT 'proposed', -- proposed | confirmed | rejected | merged
  confidence              NUMERIC(5,2) NOT NULL,
  root_cause_ci           UUID REFERENCES kg_nodes(id),
  root_cause_narrative    TEXT,
  correlation_methods     TEXT[] NOT NULL DEFAULT '{}',
  rule_ids                UUID[],
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at             TIMESTAMPTZ
);

ALTER TABLE correlation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY cg_tenant_isolation ON correlation_groups
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS signal_group_memberships (
  signal_id            UUID NOT NULL REFERENCES signals(id),
  correlation_group_id UUID NOT NULL REFERENCES correlation_groups(id),
  added_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, correlation_group_id)
);

CREATE TABLE IF NOT EXISTS correlation_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id),           -- NULL = global platform rules
  name       TEXT NOT NULL,
  description TEXT,
  dsl_body   JSONB NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  version    INTEGER NOT NULL DEFAULT 1,
  parent_id  UUID REFERENCES correlation_rules(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE correlation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY correlation_rules_tenant_isolation ON correlation_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.6  Integration Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  system_type      TEXT NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'inactive',  -- active | inactive | error
  config_ref       TEXT NOT NULL,
  webhook_token    TEXT,
  ip_allowlist     INET[],
  last_sync_at     TIMESTAMPTZ,
  last_sync_cursor TEXT,
  error_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrations_tenant_isolation ON integrations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS integration_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  direction      TEXT NOT NULL,                       -- inbound | outbound
  event_type     TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,
  payload_ref    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',     -- pending | delivered | failed | dlq
  retry_count    INTEGER NOT NULL DEFAULT 0,
  next_retry_at  TIMESTAMPTZ,
  error_detail   TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_events_tenant_isolation ON integration_events
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.7  Billing Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  billing_period TEXT NOT NULL,                       -- monthly | annual
  features       JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),
  plan_id                  UUID NOT NULL REFERENCES plans(id),
  status                   TEXT NOT NULL DEFAULT 'active',  -- active | cancelled | past_due
  current_period_start     TIMESTAMPTZ NOT NULL,
  current_period_end       TIMESTAMPTZ NOT NULL,
  external_subscription_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  metric_type  TEXT NOT NULL,    -- api_call | llm_token | storage_gb | user
  metric_value NUMERIC(20,6) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  source_ref   TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_ledger_tenant_isolation ON usage_ledger
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_tenant_period ON usage_ledger (tenant_id, period_start, metric_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.8  Audit Log Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),
  actor_id      UUID,
  actor_type    TEXT NOT NULL,                        -- user | service | super_admin
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  source_ip     INET,
  user_agent    TEXT,
  request_id    TEXT,
  before_state  JSONB,
  after_state   JSONB,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time  ON audit_logs (actor_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.9  Notification Policies Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  event_type      TEXT NOT NULL,
  channel_type    TEXT NOT NULL,    -- email | slack | teams | pagerduty | opsgenie | webhook
  channel_config  JSONB NOT NULL DEFAULT '{}',
  recipient_ids   UUID[],
  severity_filter TEXT[],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_policies_tenant_isolation ON notification_policies
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_notif_policies_tenant_event ON notification_policies (tenant_id, event_type)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.10  Chat Sessions & Messages Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  incident_id UUID REFERENCES incidents(id),
  title       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',         -- active | archived
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_tenant_isolation ON chat_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_user ON chat_sessions (tenant_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  role        TEXT NOT NULL,                          -- user | assistant | system
  content     TEXT NOT NULL,
  citations   JSONB,
  model_used  TEXT,
  tokens_used INTEGER,
  feedback    TEXT,                                   -- positive | negative | NULL
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_tenant_isolation ON chat_messages
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, created_at ASC);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.11  Feed Subscriptions Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feed_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),        -- NULL = global platform feed
  name            TEXT NOT NULL,
  feed_type       TEXT NOT NULL,                      -- rss | atom | vendor_api | manual_upload
  source_url      TEXT,
  auth_ref        TEXT,
  schedule_cron   TEXT NOT NULL DEFAULT '0 */4 * * *',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_etag       TEXT,
  last_modified   TEXT,
  error_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feed_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_subscriptions_tenant_isolation ON feed_subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
      OR tenant_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_feed_subs_tenant_active ON feed_subscriptions (tenant_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.12  Feature Flags Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  description         TEXT,
  enabled_globally    BOOLEAN NOT NULL DEFAULT false,
  enabled_tenant_ids  UUID[],
  disabled_tenant_ids UUID[],
  rollout_pct         SMALLINT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags (name);

-- ─────────────────────────────────────────────────────────────────────────────
-- §7.2  LLM Cache Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS llm_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  prompt_hash       TEXT NOT NULL,
  prompt_embedding  vector(1536) NOT NULL,
  response_content  TEXT NOT NULL,
  model             TEXT NOT NULL,
  tokens_prompt     INTEGER NOT NULL,
  tokens_completion INTEGER NOT NULL,
  hit_count         INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_tenant_embed ON llm_cache
  USING hnsw (prompt_embedding vector_cosine_ops)
  WHERE tenant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration record
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO iivkis.schema_migrations (version, description)
VALUES ('0002', 'Full application schema — 27 tables (LLD IIVKIS-ARCH-002 v1.0.1)')
ON CONFLICT (version) DO NOTHING;
