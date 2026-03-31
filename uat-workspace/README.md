# IIVKIS UAT Workspace

> **Phase 10 — User Acceptance Testing Workspace**
>
> Isolated, self-contained environment seeded with realistic demo data, pre-wired mock connectors, and a dedicated portal UI tab.

---

## Directory Structure

```
uat-workspace/
├── seed/
│   ├── incidents.json   – 20 demo incidents covering all severity levels and states
│   ├── logs.json        – 20 structured log entries (errors, warnings, anomalies, info)
│   ├── metrics.json     – 10 time-series metric streams covering the cascade degradation event
│   └── signals.json     – 15 CE input signals (monitoring alerts, incidents, log anomalies, vendor advisories)
├── connectors/
│   └── config.json      – 6 pre-configured mock connectors (ServiceNow, PagerDuty, Prometheus, Jira, Grafana, Datadog)
└── README.md            – this file
```

---

## Quick Start

### 1. Run the Phase 10 validation (no Docker required)

```bash
npm run validate:phase10
```

Expected output: **39 checks PASS**

### 2. Start the full UAT stack

**Prerequisites:** Docker ≥ 24, Docker Compose v2, Node.js ≥ 18

```bash
# From the repository root
cd infra
cp .env.example .env           # copy env defaults (safe dev values pre-filled)

# Build app images and start every service in the background
docker compose -f docker-compose.yml -f docker-compose.uat.yml up --build -d
```

First run takes ~3–5 minutes to build the three app images (api, orchestrator, portal).

### 3. Verify services are healthy

```bash
docker compose -f docker-compose.yml -f docker-compose.uat.yml ps
```

All services should show **Up (healthy)** or **Up** within ~60 seconds.

### 4. Access the UAT endpoints

| Service | URL | Notes |
|---------|-----|-------|
| **Portal (UAT dashboard)** | http://localhost:3010/uat | Main UAT workspace UI |
| **API** | http://localhost:4010/api/v1 | REST API |
| **Orchestrator** | http://localhost:5010 | Pipeline endpoint |
| **Grafana** | http://localhost:3001 | admin / iivkis_dev_pass |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Keycloak** | http://localhost:8080 | admin / admin_dev_pass |
| **Neo4j Browser** | http://localhost:7474 | neo4j / iivkis_dev_pass |

> **Tip:** UAT ports are shifted +10 from dev ports (3010, 4010, 5010) so both environments can run simultaneously.

### 5. Seed data is loaded automatically

The `uat-seeder` container runs once on startup and loads all four seed files (incidents, logs, metrics, signals) plus the 6 mock connector configs into the UAT database (`iivkis_uat`). Check seeder output with:

```bash
docker logs iivkis-uat-seeder
```

### 6. Stop the UAT stack

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.uat.yml down
```

To also delete all UAT data volumes:
```bash
docker compose -f docker-compose.yml -f docker-compose.uat.yml down -v
```

---

## Seed Data

All seed files live under `uat-workspace/seed/`. They are used by the validation script and can be loaded into the live stack via:

```bash
# load incidents via API
node -e "
const incidents = require('./uat-workspace/seed/incidents.json');
// POST each to http://localhost:4000/api/v1/incidents
"
```

### Incidents (`seed/incidents.json`)

20 incidents spanning the full lifecycle:

| Severity | Count | Examples |
|----------|-------|---------|
| critical | 4 | INC-3001, INC-3006, INC-3015, INC-3020 |
| high | 7 | INC-3002, INC-3005, INC-3007, INC-3010, INC-3011, INC-3014, INC-3018 |
| medium | 6 | INC-3003, INC-3008, INC-3012, INC-3016, INC-3017, INC-3019 |
| low | 3 | INC-3004, INC-3009, INC-3013 |

Correlation groups pre-assigned:
- **cg-3001** — Gateway cascade (INC-3001, INC-3005, INC-3012)
- **cg-3002** — Vault TLS expiry (INC-3002)
- **cg-3003** — Neo4j + Orchestrator memory (INC-3003, INC-3017)
- **cg-3004** — Full-stack cascade (INC-3006, INC-3010, INC-3011, INC-3015, INC-3020)

### Logs (`seed/logs.json`)

20 log entries covering:
- `anomaly` — connection pool exhaustion, OOM events, throughput drops
- `error` — mTLS failures, remote-write failures, OOM kills, replication errors
- `warning` — circuit breaker opens, slow queries, Redis eviction
- `info` — correlation group creation, pipeline completion

### Metrics (`seed/metrics.json`)

10 time-series streams showing the 08:00–10:30 UTC degradation window:
- `cpu_usage_percent` — integration gateway CPU spike
- `memory_usage_percent` — Redis OOM climb and drop
- `http_request_latency_p99_ms` — API latency up to 45 s during cascade
- `http_error_rate_5xx` — error rate spike to 37 %
- `neo4j_query_duration_p95_ms` — KG latency spike to 4.1 s
- `correlation_engine_signal_throughput` — CE drop from 1950 to 498 signals/min
- `llm_embedding_latency_p99_ms` — LLM P99 up to 9.1 s
- `postgres_replication_lag_seconds` — replica lag to 91 s
- `active_incidents_count` — incident count rising to 9
- `correlation_groups_count` — group count rising to 4

### Signals (`seed/signals.json`)

15 CE input signals suitable for feeding directly into the correlation engine:
- 7 `monitoring_alert` events
- 5 `incident` events
- 1 `log_anomaly`
- 1 `cmdb_change`
- 1 `vendor_advisory`

---

## Mock Connectors (`connectors/config.json`)

6 connectors pre-configured in `mode: "mock"` — no live credentials needed:

| Connector | Type | Port | Capabilities |
|-----------|------|------|-------------|
| ServiceNow | ITSM | 8080 | ingest, create, update incidents; query CMDB |
| PagerDuty | Alerting | 8081 | ingest alerts; acknowledge/resolve; escalation |
| Prometheus | Metrics | 9090 | ingest & query metrics; manage alert silences |
| Jira | Project Mgmt | 8082 | ingest/create/update issues; link issues |
| Grafana | Observability | 3001 | ingest alerts; get panel images |
| Datadog | APM / Monitoring | 8083 | ingest monitors; query logs & traces |

All credentials are `__MOCK__` and must be replaced with real values before connecting to live systems.

---

## UAT Portal Page

The portal exposes a dedicated UAT workspace dashboard at `/uat`. It provides:

- **Seed data overview** — incident and log counts, metric stream list
- **Connector status tiles** — real-time mock connector health
- **Demo incident browser** — sortable/filterable table of all 20 seeded incidents
- **Correlation group cards** — visual summary of the 4 pre-assigned groups

---

## Resetting the UAT Workspace

To reset the workspace to its factory state:

```bash
# Re-run validation to confirm seed data is intact
npm run validate:phase10

# Truncate UAT tenant data (requires DB access)
psql $DATABASE_URL -c "DELETE FROM incidents WHERE tenant_id='tenant-uat';"
psql $DATABASE_URL -c "DELETE FROM correlation_groups WHERE tenant_id='tenant-uat';"
```

---

## Notes

- All seed data uses `tenantId: "tenant-uat"` to ensure isolation from other tenants.
- Mock connector credentials (`__MOCK__`) are intentionally invalid and will not authenticate against real external services.
- Correlation group assignments in `seed/incidents.json` reflect the groups that the Correlation Engine would produce when fed the signals in `seed/signals.json`.
