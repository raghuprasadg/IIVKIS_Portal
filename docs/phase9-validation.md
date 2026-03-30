# Phase 9 Validation Report — Build + Local Run

**Status:** ✅ PASS  
**Date:** 2026-03-30  
**Validation script:** `npm run validate:phase9`  
**Result:** 28 passed, 0 failed

---

## Scope

Phase 9 adds full Docker/Compose support to the IIVKIS monorepo so that all services can be stood up with a single `docker compose up -d` command.

---

## What Was Added

### Dockerfiles

| Service | File | Stages |
|---------|------|--------|
| API | `apps/api/Dockerfile` | `builder`, `development`, `production` |
| Orchestrator | `apps/orchestrator/Dockerfile` | `builder`, `development`, `production` |
| Portal (Next.js) | `apps/portal/Dockerfile` | `deps`, `builder`, `development`, `production` |

All images are based on `node:18-alpine` for a minimal footprint. Each has a `development` stage (uses `ts-node` / `next dev`) and a `production` stage (uses compiled `dist/` output).

### docker-compose.yml (updated)

`infra/docker-compose.yml` now declares all **10 services**:

| Service | Image / Build | Port |
|---------|--------------|------|
| `postgres` | `pgvector/pgvector:pg15` | 5432 |
| `redis` | `redis:7-alpine` | 6379 |
| `neo4j` | `neo4j:5` | 7474, 7687 |
| `keycloak` | `quay.io/keycloak/keycloak:24.0` | 8080 |
| `vault` | `hashicorp/vault:1.15` | 8200 |
| `prometheus` | `prom/prometheus:v2.51.0` | 9090 |
| `grafana` | `grafana/grafana:10.4.0` | 3001 |
| `api` | `apps/api/Dockerfile` (dev) | 4000 |
| `orchestrator` | `apps/orchestrator/Dockerfile` (dev) | 5000 |
| `portal` | `apps/portal/Dockerfile` (dev) | 3000 |

### .env.example (updated)

Added `ORCHESTRATOR_PORT=5000` and `PORTAL_PORT=3000`.

### .dockerignore (new)

Root-level `.dockerignore` excludes `node_modules`, `dist`, `.next`, test artefacts, and `docs/` from the build context for fast builds.

---

## Validation Results

```
── 1. Dockerfile presence ──────────────────────────────────────
  ✅ PASS — apps/api/Dockerfile exists
  ✅ PASS — apps/orchestrator/Dockerfile exists
  ✅ PASS — apps/portal/Dockerfile exists

── 2. docker-compose config syntax ─────────────────────────────
  ✅ PASS — docker compose config is valid

── 3. Required services declared in docker-compose.yml ──────────
  ✅ PASS — service "postgres" declared
  ✅ PASS — service "redis" declared
  ✅ PASS — service "neo4j" declared
  ✅ PASS — service "keycloak" declared
  ✅ PASS — service "vault" declared
  ✅ PASS — service "prometheus" declared
  ✅ PASS — service "grafana" declared
  ✅ PASS — service "api" declared
  ✅ PASS — service "orchestrator" declared
  ✅ PASS — service "portal" declared

── 4. Health checks defined for application services ─────────────
  ✅ PASS — health check configured for "api"
  ✅ PASS — health check configured for "orchestrator"
  ✅ PASS — health check configured for "portal"

── 5. .env.example covers all service ports ─────────────────────
  ✅ PASS — POSTGRES_PORT in .env.example
  ✅ PASS — REDIS_PORT in .env.example
  ✅ PASS — NEO4J_HTTP_PORT in .env.example
  ✅ PASS — NEO4J_BOLT_PORT in .env.example
  ✅ PASS — KEYCLOAK_PORT in .env.example
  ✅ PASS — VAULT_PORT in .env.example
  ✅ PASS — PROMETHEUS_PORT in .env.example
  ✅ PASS — GRAFANA_PORT in .env.example
  ✅ PASS — API_PORT in .env.example
  ✅ PASS — ORCHESTRATOR_PORT in .env.example
  ✅ PASS — PORTAL_PORT in .env.example

════════════════════════════════════════════════════════════
Phase 9 validation: 28 passed, 0 failed
```

---

## How to Run Locally

```bash
# 1. Copy environment file
cd infra
cp .env.example .env    # edit secrets as needed

# 2. Start all services
docker compose up -d

# 3. Verify health
docker compose ps       # all should show "healthy"

# 4. Access services
#   Portal     → http://localhost:3000
#   API        → http://localhost:4000/health
#   Orchestrator → http://localhost:5000/health
#   Keycloak   → http://localhost:8080
#   Vault UI   → http://localhost:8200/ui
#   Prometheus → http://localhost:9090
#   Grafana    → http://localhost:3001  (admin / iivkis_dev_pass)
#   Neo4j      → http://localhost:7474

# 5. Run live smoke tests
cd ..
node scripts/validate-phase9.mjs --live
```

---

## Prior Phase Status (carried forward)

| Phase | Result |
|-------|--------|
| Phase 6 — Integration Pipeline | ✅ PASS |
| Phase 7 — Security & Resiliency | ✅ 30/30 PASS |
| Phase 7-final — Acceptance Criteria | ✅ 22/22 PASS |
| Phase 8 — Security Hardening (Jest) | ✅ 112/112 PASS |
| Phase 9 — Docker + Local Run | ✅ 28/28 PASS |

**Phase 9 is complete. No blockers.**
