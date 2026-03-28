# IIVKIS — Local Development Environment (STEP 4)

This directory contains the Docker Compose configuration for running all IIVKIS
infrastructure services locally.

---

## Quick Start

```bash
# 1. Copy and (optionally) edit the environment file
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. Verify all services are healthy
docker compose ps
```

All services start in dependency order. The API waits for PostgreSQL and Redis
to be healthy before starting.

---

## Service Port Map

| Service    | Local URL                         | Description                         |
|------------|-----------------------------------|-------------------------------------|
| PostgreSQL | `localhost:5432`                  | Relational DB + pgvector             |
| Redis      | `localhost:6379`                  | Cache, sessions, rate-limit counters |
| Neo4j      | `http://localhost:7474` (browser) | Knowledge / CI topology graph        |
|            | `bolt://localhost:7687`            | Bolt driver connection               |
| Keycloak   | `http://localhost:8080`           | Identity Provider (OIDC/SAML)        |
|            | `http://localhost:8080/admin`     | Admin console                        |
| Vault      | `http://localhost:8200`           | Secrets manager (dev mode)           |
|            | `http://localhost:8200/ui`        | Vault UI                             |
| Prometheus | `http://localhost:9090`           | Metrics scraper                      |
| Grafana    | `http://localhost:3001`           | Dashboards                           |
| API        | `http://localhost:4000`           | IIVKIS Express API                   |

---

## Default Credentials (dev only — never use in production)

| Service    | Username    | Password          | Notes                          |
|------------|-------------|-------------------|--------------------------------|
| PostgreSQL | `iivkis`    | `iivkis_dev_pass` | DB: `iivkis`                   |
| Redis      | —           | `iivkis_dev_pass` | `-a` flag for `redis-cli`      |
| Neo4j      | `neo4j`     | `iivkis_dev_pass` |                                |
| Keycloak   | `admin`     | `admin_dev_pass`  | Admin console only             |
| Vault      | Token       | `iivkis-dev-root-token` | `VAULT_TOKEN` env var    |
| Grafana    | `admin`     | `iivkis_dev_pass` |                                |

Keycloak realm `iivkis` also includes two test users:

| Username   | Password       | Realm role      |
|------------|----------------|-----------------|
| `devuser`  | `devuser_pass` | `ops-engineer`  |
| `devadmin` | `devadmin_pass`| `tenant-admin`  |

---

## Health Checks

```bash
# All services
docker compose ps

# API liveness
curl http://localhost:4000/health

# API readiness (checks PG, Redis, Neo4j, Vault, Keycloak)
curl http://localhost:4000/health/ready

# Prometheus targets
open http://localhost:9090/targets
```

---

## Useful Commands

```bash
# Follow logs for a specific service
docker compose logs -f api
docker compose logs -f postgres

# Stop all services (data volumes preserved)
docker compose down

# Stop AND remove volumes (full reset)
docker compose down -v

# Restart a single service
docker compose restart api

# Run psql against the local database
docker compose exec postgres psql -U iivkis -d iivkis

# Run redis-cli
docker compose exec redis redis-cli -a iivkis_dev_pass

# Vault CLI from host (requires Vault CLI installed locally)
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=iivkis-dev-root-token
vault kv list secret/
```

---

## Directory Structure

```
infra/
├── docker-compose.yml               # Main compose file
├── .env.example                     # Environment variable template
├── README.md                        # This file
├── postgres/
│   └── init/
│       └── 01-extensions.sql        # pgvector + iivkis schema bootstrap
├── prometheus/
│   └── prometheus.yml               # Scrape configuration
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   └── prometheus.yml       # Auto-provisioned Prometheus datasource
│       └── dashboards/
│           └── dashboards.yml       # Dashboard file discovery config
└── keycloak/
    └── iivkis-realm.json            # IIVKIS realm with roles + clients
```

---

## Architecture Notes

- **PostgreSQL** uses the `pgvector/pgvector:pg15` image which bundles the
  `vector` extension for tenant-namespaced embedding storage (see HLD §4.3).
- **Neo4j** is used for the Knowledge Graph (CI topology, vendor/product
  relationships) alongside the PostgreSQL relational store.
- **Keycloak** provides OIDC/SAML identity in local development; production
  uses customer-managed IdP (Okta, Azure AD, etc.).
- **Vault** runs in **dev mode** locally (in-memory, auto-unsealed). In
  production it is a 3-node Raft Integrated Storage cluster (HLD ADR-007).
- All passwords in `.env.example` are **development-only** and **must** be
  rotated before any non-local deployment.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Neo4j takes > 60 s to start | Increase healthcheck `start_period` or wait longer |
| Keycloak realm not imported | Check `docker compose logs keycloak` — file must be valid JSON |
| `pg` extension not found | The `pgvector/pgvector:pg15` image includes it; rebuild the volume with `docker compose down -v` |
| API exits immediately | Inspect with `docker compose logs api` — usually a missing `ts-node` or build error |
