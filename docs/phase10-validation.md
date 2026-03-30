# Phase 10 Validation Report — UAT Environment

**Status:** ✅ PASS  
**Date:** 2026-03-30  
**Checks:** 39 / 39 passed  
**Command:** `npm run validate:phase10`

---

## Overview

Phase 10 delivers the User Acceptance Testing (UAT) workspace — a fully
isolated, self-contained environment seeded with realistic demo data, pre-wired
mock connectors, and a dedicated Docker Compose overlay.  The UAT stack runs on
distinct ports (API: 4010, Orchestrator: 5010, Portal: 3010) so it cannot
interfere with a concurrently-running development stack.

---

## Validation Summary

| # | Section | Checks | Result |
|---|---------|--------|--------|
| 1 | UAT workspace structure | 5 | ✅ PASS |
| 2 | Seed file JSON validity | 4 | ✅ PASS |
| 3 | Incidents data quality | 5 | ✅ PASS |
| 4 | Logs data quality | 4 | ✅ PASS |
| 5 | Signals data quality | 3 | ✅ PASS |
| 6 | Metrics data quality | 3 | ✅ PASS |
| 7 | Cross-referencing integrity | 4 | ✅ PASS |
| 8 | Connector config | 7 | ✅ PASS |
| 9 | UAT environment independence | 4 | ✅ PASS |
| | **Total** | **39** | ✅ **39 / 39** |

---

## Checks by Section

### 1. UAT Workspace Structure

| Check | Result |
|-------|--------|
| `uat-workspace/` directory exists | ✅ |
| `uat-workspace/seed/` directory exists | ✅ |
| `uat-workspace/connectors/` directory exists | ✅ |
| `uat-workspace/README.md` exists | ✅ |
| All 4 seed files present | ✅ |

### 2. Seed File JSON Validity

| Check | Result |
|-------|--------|
| `incidents.json` is valid JSON | ✅ |
| `logs.json` is valid JSON | ✅ |
| `metrics.json` is valid JSON | ✅ |
| `signals.json` is valid JSON | ✅ |

### 3. Incidents Data Quality

| Check | Result |
|-------|--------|
| incidents count ≥ 20 (actual: 20) | ✅ |
| all incidents have required fields (`id`, `title`, `severity`, `status`, `tenantId`, `source`) | ✅ |
| all incidents have `tenantId="tenant-uat"` | ✅ |
| all 4 severity levels present (`critical`, `high`, `medium`, `low`) | ✅ |
| all incidents have `sla` block | ✅ |

### 4. Logs Data Quality

| Check | Result |
|-------|--------|
| logs count ≥ 20 (actual: 20) | ✅ |
| all logs have required fields (`id`, `timestamp`, `level`, `service`, `message`, `tenantId`) | ✅ |
| all logs have `tenantId="tenant-uat"` | ✅ |
| logs contain `ERROR` level entries | ✅ |

### 5. Signals Data Quality

| Check | Result |
|-------|--------|
| signals count ≥ 15 (actual: 15) | ✅ |
| all signals have required fields (`signalType`, `severity`, `affectedCiId`, `title`, `occurredAt`) | ✅ |
| signals contain ≥ 3 distinct signal types (actual: 5) | ✅ |

### 6. Metrics Data Quality

| Check | Result |
|-------|--------|
| `metrics.json` has `meta` and `series` fields | ✅ |
| metrics has ≥ 5 time-series streams (actual: 10) | ✅ |
| every metrics series has at least 1 datapoint | ✅ |

### 7. Cross-Referencing Integrity

| Check | Result |
|-------|--------|
| ≥ 2 incidents share a `correlationGroupId` (cascade scenario) | ✅ |
| signals and incidents share ≥ 1 `affectedCiId` | ✅ |
| logs share ≥ 1 host with incident/signal CIs | ✅ |
| all incident timestamps are valid ISO-8601 | ✅ |

### 8. Connector Config

| Check | Result |
|-------|--------|
| connector config has `tenantId="tenant-uat"` | ✅ |
| 6 connectors defined | ✅ |
| all connectors have required fields (`id`, `name`, `type`, `vendor`, `enabled`, `mode`) | ✅ |
| all connectors have `mode="mock"` | ✅ |
| connector credentials use `__MOCK__` placeholders (no live secrets) | ✅ |
| ServiceNow connector present and enabled | ✅ |
| PagerDuty connector present and enabled | ✅ |

### 9. UAT Environment Independence

| Check | Result |
|-------|--------|
| `infra/docker-compose.uat.yml` exists | ✅ |
| UAT compose declares a `uat-seeder` service | ✅ |
| UAT compose uses UAT-specific database (`iivkis_uat`) | ✅ |
| UAT compose uses distinct ports from dev stack (4010, 5010, 3010) | ✅ |

---

## UAT Environment Highlights

### Seed Data

| Dataset | Count | Scenario |
|---------|-------|----------|
| Incidents | 20 | ServiceNow API gateway cascade (INC-3001 – INC-3020) |
| Logs | 20 | Structured logs covering ERROR/WARN/INFO for the cascade event |
| Signals | 15 | 5 signal types: monitoring_alert, incident, log_anomaly, cmdb_change, vendor_advisory |
| Metrics | 10 series | 90-minute window (2026-01-15 08:00–10:30 UTC) |

### Mock Connectors

| Connector | Type | Status |
|-----------|------|--------|
| ServiceNow (Mock) | itsm | enabled |
| PagerDuty (Mock) | alerting | enabled |
| Prometheus (Mock) | metrics | enabled |
| Jira (Mock) | project_management | enabled |
| Grafana (Mock) | observability | enabled |
| Datadog (Mock) | apm_monitoring | enabled |

### Port Allocation (UAT vs Dev)

| Service | Dev port | UAT port |
|---------|----------|----------|
| API | 4000 | **4010** |
| Orchestrator | 5000 | **5010** |
| Portal | 3000 | **3010** |
| PostgreSQL | 5432 | (shared) |
| Redis | 6379 | (shared) |

---

## Quick Start

```bash
# 1. Static validation (no Docker required)
npm run validate:phase10

# 2. Start full UAT stack
cd infra
docker compose -f docker-compose.yml -f docker-compose.uat.yml up -d

# 3. Open UAT portal
open http://localhost:3010
```

---

*Generated automatically by `scripts/validate-phase10.mjs`*
