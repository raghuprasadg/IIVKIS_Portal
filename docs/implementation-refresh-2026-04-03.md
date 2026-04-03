# IIVKIS Implementation Refresh

**Document ID:** IIVKIS-IMPL-REFRESH-2026-04-03  
**Version:** 1.0.0  
**Status:** Active  
**Date:** 2026-04-03

---

## Purpose

This document captures implementation-level updates applied after the Phase 12 validation snapshot so operational docs remain aligned with the running code.

---

## Key Updates

### 1. Tenant-bound DB session model (API)

- Introduced request-scoped PostgreSQL session context in `apps/api/src/infra/db.ts`.
- Tenant middleware now acquires one DB client per request and binds
  `app.current_tenant_id` on that exact connection.
- All updated route handlers use request-bound DB access (`getRequestDb(req)`),
  reducing tenant-context drift across pooled connections.

### 2. API route and schema alignment

- Chat routes aligned to `chat_sessions`/`chat_messages` schema and tenant scoping.
- Knowledge routes aligned to `knowledge_articles` fields (`content`, `content_hash`,
  `vendor_id`, `product_id`, `version_id`, `ingested_at`).
- Incident and correlation routes aligned to current relation/table names and active
  state fields.
- Integration routes updated to current `integrations` schema (`system_type`, `status`,
  `config_ref`) and orchestrator-driven manual sync.

### 3. Portal chat resiliency and UX

- Removed direct model-provider bypass from portal route.
- Added orchestrator endpoint fallback chain (`/tasks`, `/orchestrate`) with
  multiple candidate base URLs for local/container/UAT networking.
- Added actionable backend error messaging in chat UI instead of raw `fetch failed`.
- Added concise personalized co-working assistant welcome message in new/empty chats.

### 4. Docker updates

- Orchestrator Dockerfile now builds required workspace packages to ensure runtime
  module availability in container.
- Portal Dockerfile includes `public/` in copied build context.
- Compose adjustments include safer Keycloak and UAT port overrides.

---

## Current Reality Snapshot

- Security middleware is implemented (auth, tenant context, WAF, mTLS, rate-limit,
  Vault secret resolution).
- Agent orchestration is implemented with active routing and resiliency wrappers.
- KG and RAG paths remain partially implemented in runtime (mixed real + stub paths,
  depending on provider/service availability and environment variables).
- Local-first model strategy is still in transition; external-provider compatibility
  remains active.

---

## Operational Note

When troubleshooting chat failures, verify these in order:

1. Portal route can reach orchestrator base URL from its runtime network.
2. Orchestrator health endpoint is reachable.
3. `LLM_API_KEY` and provider endpoint configuration are present (or fallback mode is accepted).
4. API and orchestrator share consistent tenant and auth expectations.
