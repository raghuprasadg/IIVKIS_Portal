# IIVKIS Phase 6 — Core Engine Integration Validation

**Date:** 2026-03-29  
**Validator:** `scripts/validate-phase6.mjs`  
**Status:** ✅ PASS

---

## Pipeline Stages

### Stage 1 — NormalizationEngine
Raw events from Zabbix + ServiceNow → canonical `Signal[]`

- 7 raw events ingested
- Field mappings applied: `zbx_trigger_id → externalId`, `host → affectedCiId`, `priority → severity` (severity_map), etc.
- Required defaults filled in when source fields absent (`signalType`, `sourceSystem`, `occurredAt`)
- Output: 7 canonical `Signal` objects with correct `severity`, `title`, `affectedCiId`, `sourceSystem`

### Stage 2 — KG Topology Enrichment
`KGService.batchGetTopologyInfo()` called for all unique CI IDs before CE ingest.
Each signal receives a `topologyDepth` (0–3) derived deterministically from the CI UUID hash
(production path: Neo4j Bolt query; Phase 6 validation: deterministic stub).

### Stage 3 — Correlation Engine (16 processors)
7 signals → `CorrelationEngine.process()` → 5 correlated groups + 1 suppressed duplicate

| Processor | Groups proposed | Signals suppressed |
|-----------|----------------|--------------------|
| time-window | 1 | 0 |
| topology | 1 | 0 |
| deduplication | 0 | **1** (ZBX-1001 duplicate suppressed) |
| blast-radius | 1 | 0 |
| threshold-grouping | 1 | 0 |
| cross-service | 1 | 0 |

---

## Correlated Output with Evidence

### Group 1 — `time-window` (confidence: 60)
5 signals from `zabbix` within 10-minute window on CI `ci-e04d8e5c0145` (db-primary):
- High CPU utilization (95%)
- Database connection pool exhausted
- Slow query threshold exceeded
- Disk utilization above 80%
- High CPU utilization (duplicate, before dedup)

**Evidence:** "5 signals from 'zabbix' within 10 min window. Temporal score: 25."

### Group 2 — `topology` (confidence: 60)
7 signals across CI `ci-e04d8e5c0145` and `ci-a7a1d1b1b26d` (web-app) — 3 hops apart in dependency graph.

**Evidence:** "CIs 'ci-e04d8e5c0145' (depth 3) and 'ci-a7a1d1b1b26d' (depth 0) are 3 hop(s) apart. Topological score: 5."

### Group 3 — `blast-radius` (confidence: 90) ⭐ Highest confidence
7 signals: HTTP 503 on web-app is a downstream effect of the DB failure. Core CI is `ci-a7a1d1b1b26d`.

**Evidence:** "Blast radius from core CI 'ci-a7a1d1b1b26d' (depth 0, severity high). Downstream CIs affected: ci-e04d8e5c0145."

### Group 4 — `threshold-grouping` (confidence: 75)
Alert storm: 4 high/critical threshold-breach signals on `ci-e04d8e5c0145` within 5 minutes.

**Evidence:** "Alert storm: 4 threshold-breach signals on CI 'ci-e04d8e5c0145' within 5 min."

### Group 5 — `cross-service` (confidence: 65)
6 signals from 2 different source systems (zabbix + servicenow) both pointing to the same CI.

**Evidence:** "Cross-service correlation: CI 'ci-e04d8e5c0145' has signals from 2 source systems: zabbix, servicenow."

---

## Integration Contracts Wired

| Contract | Previous state | Phase 6 state |
|----------|---------------|---------------|
| `ce.signal.ingest` → analysis agent | `degraded` stub | ✅ Real `CorrelationEngine.process()` |
| `int.sync` → integration agent | `degraded` stub | ✅ Real `ConnectorRegistry.get().sync()` |
| `int.webhook.process` → integration agent | `degraded` stub | ✅ Real HMAC-validated webhook handler |
| `vk.search` → vendor-knowledge agent | `degraded` stub | ✅ Real RAG pipeline |
| `ts.plan.generate` → troubleshooting agent | `degraded` stub | ✅ Wired (returns degraded — full impl STEP 7) |
| Raw events → Signal[] | Manual connector code only | ✅ `NormalizationEngine` |
| Signal → topologyDepth | No KG enrichment | ✅ `KGService` stub (Neo4j in production) |
| ProposedGroup → evidence | Lost after CE | ✅ `groupSignalMap` + `groupNarrativeMap` |
| Full pipeline endpoint | No HTTP endpoint | ✅ `POST /pipeline/run` |

---

## Validation Script Output (summary)

```
✅ PASS — 5 group(s) carry correlated signal evidence.
✅ PASS — 5 group(s) have confidence ≥ 30.
Phase 6 validation: ✅ PASS
```

**Phase 6 validation: COMPLETE ✅**
