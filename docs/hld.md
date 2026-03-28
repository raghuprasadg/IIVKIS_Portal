# IIVKIS High-Level Design (HLD)

**Document ID:** IIVKIS-ARCH-001  
**Version:** 1.0.0  
**Status:** Approved — Phase 3 Baseline  
**Phase:** STEP 3 — Architecture Design  
**Author:** Architect Agent  
**Date:** 2026-03-28  
**References:** [IIVKIS-REQ-001 v1.1.0](requirements.md), [IIVKIS-SEC-001 v1.0.1](threat-model.md)

### Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-03-28 | Architect Agent | Initial HLD — system architecture, multi-tenant isolation tiers, SaaS + self-host deployment models, all major subsystems |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Guiding Principles](#2-guiding-principles)
3. [System Decomposition](#3-system-decomposition)
4. [Multi-Tenant Isolation Architecture](#4-multi-tenant-isolation-architecture)
5. [Deployment Topologies](#5-deployment-topologies)
   - 5.1 [SaaS — Shared-Infrastructure](#51-saas--shared-infrastructure)
   - 5.2 [SaaS — Dedicated Tenant Cluster](#52-saas--dedicated-tenant-cluster)
   - 5.3 [Self-Hosted — On-Premises Kubernetes](#53-self-hosted--on-premises-kubernetes)
6. [Core Subsystem Overviews](#6-core-subsystem-overviews)
   - 6.1 [API Gateway & Ingress Layer](#61-api-gateway--ingress-layer)
   - 6.2 [Engineering Orchestrator](#62-engineering-orchestrator)
   - 6.3 [Vendor Knowledge Agent & KG+RAG Pipeline](#63-vendor-knowledge-agent--kgrag-pipeline)
   - 6.4 [Correlation Engine](#64-correlation-engine)
   - 6.5 [LLM Gateway](#65-llm-gateway)
   - 6.6 [Integration Agent](#66-integration-agent)
   - 6.7 [Troubleshooting Agent](#67-troubleshooting-agent)
   - 6.8 [Analysis Agent](#68-analysis-agent)
   - 6.9 [Billing Engine](#69-billing-engine)
   - 6.10 [Notification Service](#610-notification-service)
   - 6.11 [Portal (Frontend)](#611-portal-frontend)
7. [Data Stores](#7-data-stores)
8. [Security Architecture Summary](#8-security-architecture-summary)
9. [Observability Architecture](#9-observability-architecture)
10. [Technology Stack Decisions](#10-technology-stack-decisions)
11. [Architecture Decision Records (ADRs)](#11-architecture-decision-records-adrs)

---

## 1. Introduction

### 1.1 Purpose

This document is the High-Level Design (HLD) for the **Intelligent IT Vendor Knowledge
Integration System (IIVKIS)**. It defines:

- The decomposition of the system into bounded subsystems and their responsibilities.
- The multi-tenant isolation architecture at every layer.
- Both **SaaS** (cloud-hosted) and **self-hosted** (on-premises Kubernetes) deployment
  topologies.
- The key architectural decisions that govern implementation.

This HLD is the input to the [Low-Level Design](lld.md) and [Data Flow Diagrams](dfd.md).

### 1.2 Scope

All components within the IIVKIS platform boundary are in scope. Third-party systems
(ServiceNow, Datadog, LLM providers, CMDB) are referenced as external actors.

### 1.3 Relationship to Other Documents

| Document | Role relative to HLD |
|---|---|
| [Requirements v1.1.0](requirements.md) | Inputs — all design decisions are traceable to FR/NFR IDs |
| [Threat Model v1.0.1](threat-model.md) | Security constraints propagated into every layer |
| [LLD](lld.md) | Detailed data models, API schemas, module interfaces |
| [DFD](dfd.md) | Data flow diagrams for each subsystem |

---

## 2. Guiding Principles

| # | Principle | Driving Requirement |
|---|---|---|
| P-01 | **Tenant isolation by default** — all data, queues, indexes, and encryption keys partitioned per tenant | FR-MT-001, FR-MT-003 |
| P-02 | **Stateless services** — API, Orchestrator, all Agents carry no per-request tenant state in memory; identity flows via JWT | FR-MT-002, NFR-SCALE-001 |
| P-03 | **Zero-trust internal network** — mTLS between all pods; OPA authorisation at every service boundary | NFR-SEC-030, NFR-SEC-031 |
| P-04 | **Graceful degradation** — AI features fail silently with fallback notice; core ITSM functions unaffected | NFR-RES-003 |
| P-05 | **Durable async task dispatch** — all agent work via message queue; at-least-once delivery with idempotency keys | NFR-RES-020, NFR-RES-022 |
| P-06 | **Observability first** — every service emits OpenTelemetry traces, Prometheus metrics, and structured JSON logs | NFR-OBS-001, NFR-OBS-002, NFR-OBS-003 |
| P-07 | **Infrastructure as code** — all cloud and on-premises resources declared in Terraform/Helm; no manual changes | NFR-MAINT-006 |
| P-08 | **API-first, version-stable** — all capabilities exposed via versioned REST endpoints; breaking changes prohibited within a major version | NFR-MAINT-007 |

---

## 3. System Decomposition

The IIVKIS platform is composed of **five tiers**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — INGRESS & SECURITY PERIMETER                              │
│  CDN / DDoS Scrubbing → WAF → TLS Termination → API Gateway         │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2 — APPLICATION LAYER                                         │
│  Portal (Next.js) │ REST API (Express) │ Orchestrator               │
└─────────────────────────────────────────────────────────────────────┘
                              │ (message queue)
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3 — AGENT LAYER                                               │
│  Vendor Knowledge Agent │ Troubleshooting Agent                     │
│  Integration Agent      │ Analysis Agent                            │
│  LLM Gateway            │ Correlation Engine                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 4 — DATA LAYER                                                │
│  PostgreSQL (RLS) │ Redis Cache │ Vector DB (tenant-isolated)       │
│  Knowledge Graph  │ Message Queue │ Object Store (audit / docs)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 5 — PLATFORM SERVICES                                         │
│  Vault (secrets) │ OPA (policy engine) │ SPIRE (mTLS identities)   │
│  Prometheus + Grafana │ Jaeger/Tempo (traces) │ Loki (logs)         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Service Inventory

| Service | Runtime | Scaling Unit | Tier |
|---|---|---|---|
| Portal | Next.js 15 (Node 18) | Kubernetes Deployment | 2 |
| API | Express 4 (Node 18) | Kubernetes Deployment | 2 |
| Orchestrator | Node 18 | Kubernetes Deployment | 2 |
| Vendor Knowledge Agent | Node 18 | Kubernetes Deployment | 3 |
| Troubleshooting Agent | Node 18 | Kubernetes Deployment | 3 |
| Integration Agent | Node 18 | Kubernetes Deployment | 3 |
| Analysis Agent | Node 18 | Kubernetes Deployment | 3 |
| LLM Gateway | Node 18 | Kubernetes Deployment | 3 |
| Correlation Engine | Node 18 + Python worker | Kubernetes Deployment | 3 |
| Billing Engine | Node 18 | Kubernetes Deployment | 2 |
| Notification Service | Node 18 | Kubernetes Deployment | 2 |
| PostgreSQL | Managed (RDS/CloudSQL) | Stateful cluster | 4 |
| Redis | Managed | Stateful cluster | 4 |
| Vector DB | pgvector (PostgreSQL extension) | Co-located with PG cluster | 4 |
| Knowledge Graph | PostgreSQL (graph schema) | Co-located with PG cluster | 4 |
| Message Queue | Apache Kafka | Stateful cluster | 4 |
| Object Store | S3-compatible | Managed | 4 |
| Vault | HashiCorp Vault | Stateful HA cluster | 5 |
| OPA | Kubernetes sidecar | Per-pod | 5 |
| SPIRE | Kubernetes DaemonSet | Node-level | 5 |

---

## 4. Multi-Tenant Isolation Architecture

IIVKIS supports three isolation tiers, selectable at tenant onboarding (FR-MT-003):

### 4.1 Isolation Tier Matrix

| Tier | Model | Suitable For | Database | Vector Index | Queue Topics | Network |
|---|---|---|---|---|---|---|
| **T1** | Shared infrastructure (RLS) | Starter / SMB tenants | Row-Level Security (tenant_id predicate) | Namespace partition in shared pgvector | Shared topics with `tenant_id` header filter | Shared namespace |
| **T2** | Shared infra + dedicated crypto | Professional tenants | RLS + per-tenant AES-256 BYOK encryption (Vault) | Dedicated schema / namespace | Dedicated Kafka topics per tenant | Shared namespace |
| **T3** | Dedicated cluster | Enterprise / regulated | Separate PG schema or separate PG instance | Separate pgvector index | Dedicated Kafka cluster | Dedicated Kubernetes namespace or separate cluster |

### 4.2 Row-Level Security Design (Tier T1/T2)

Every tenant-bearing table in PostgreSQL enforces an RLS policy:

```sql
-- Applied to every table that carries tenant data
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The API sets `app.current_tenant_id` via a connection pool middleware that extracts
`tenant_id` exclusively from the verified JWT claim (never from request parameters).
OPA sidecar enforces this invariant at the application layer before any DB call.

### 4.3 Vector Index Isolation (FR-VK-010)

```
SaaS Shared (T1)          SaaS Dedicated (T2)         Self-Hosted (T3)
  pgvector DB               pgvector DB                  pgvector DB
  ┌──────────┐              ┌──────────┐                ┌──────────┐
  │ ns:acme  │              │ idx:acme │                │ schema:  │
  │ ns:globex│              └──────────┘                │  acme    │
  │ ns:init  │              Separate physical index      └──────────┘
  └──────────┘              per tenant                  Separate PG
  Namespace filter                                       instance
  enforced by OPA
```

Vector search queries MUST pass through a VK Agent method that injects the tenant
namespace/index constraint. Direct database access bypassing the agent is architecturally
prevented by OPA network policy.

### 4.4 Encryption Key Hierarchy

```
HSM-Backed Master Key (Platform)
  └── Platform KEK (Vault Transit Engine)
        └── Tenant DEK (per-tenant, Vault-generated)
              └── Data encryption at rest (AES-256-GCM)
                    ├── Database rows (transparent via PG encryption ext.)
                    ├── Object store objects (SSE-C or envelope encryption)
                    └── Vector embeddings stored at rest
```

BYOK tenants (T2/T3) supply their own KEK stored in Vault. Platform operators CANNOT
decrypt tenant data without possessing the tenant's KEK.

### 4.5 Network Isolation

| Layer | Mechanism | Scope |
|---|---|---|
| Kubernetes NetworkPolicy | Deny-all default; explicit allow rules per service | Pod-to-pod |
| mTLS (SPIFFE/SPIRE) | All internal service calls mutually authenticated | Service-to-service |
| OPA Sidecar | Policy enforcement — RBAC + tenant isolation on every request | Request-level |
| Namespace Segregation (T3) | Kubernetes namespace per enterprise tenant | Kubernetes resource-level |

---

## 5. Deployment Topologies

### 5.1 SaaS — Shared-Infrastructure

```
                        Internet
                           │
              ┌────────────┴─────────────┐
              │   CDN + DDoS Scrubbing   │
              └────────────┬─────────────┘
                           │ HTTPS (TLS 1.3)
              ┌────────────┴─────────────┐
              │         WAF              │
              │  (OWASP CRS + custom)    │
              └────────────┬─────────────┘
                           │
              ┌────────────┴─────────────┐
              │  Cloud Load Balancer     │
              │  (multi-AZ, active-active)│
              └────────────┬─────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────┐
│  Kubernetes Cluster — Primary Region (multi-AZ)                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │   Portal    │  │     API     │  │      Orchestrator        │ │
│  │  (3 pods)   │  │  (5 pods)   │  │       (3 pods)           │ │
│  └─────────────┘  └──────┬──────┘  └───────────┬──────────────┘ │
│                          │ mTLS              Message Queue       │
│  ┌───────────────────────┴────────────────────────────────────┐ │
│  │  Agent Layer (autoscaling, 2–20 pods each)                 │ │
│  │  VK Agent │ TS Agent │ INT Agent │ ANLYS Agent │ LLM GW    │ │
│  │                              Correlation Engine             │ │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────┴────────────────────────────────────┐ │
│  │  Data Plane (shared, RLS-isolated)                         │ │
│  │  PostgreSQL HA  │  Redis Cluster  │  Kafka  │  S3          │ │
│  │  pgvector (ns-partitioned)  │  Knowledge Graph             │ │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Platform Services                                       │   │
│  │  Vault HA  │  OPA sidecars  │  SPIRE  │  Observability   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                           │ async DR replication
┌──────────────────────────┴───────────────────────────────────────┐
│  Kubernetes Cluster — Secondary Region (DR/passive standby)      │
│  Same topology, receives replication stream from primary         │
└──────────────────────────────────────────────────────────────────┘
```

**Key SaaS properties:**
- Cloud platform: AWS (primary) or Azure (configurable); IaC via Terraform modules
- Node pool auto-scaling via KEDA (event-driven — Kafka lag metric drives agent scaling)
- Zero-downtime deploys: rolling update strategy with PodDisruptionBudget
- Managed services used where available (RDS Aurora PostgreSQL, ElastiCache Redis, MSK Kafka, S3)
- Multi-AZ in primary region; cross-region active-passive DR (NFR-AVAIL-006)

### 5.2 SaaS — Dedicated Tenant Cluster

For Enterprise tenants requiring physical isolation (Isolation Tier T3):

```
  Shared Cluster                    Dedicated Tenant Namespace/Cluster
  ┌──────────────┐                  ┌────────────────────────────────┐
  │   API / GW   │── mTLS API call──▶│  Tenant-dedicated:             │
  │  Orchestrator│                  │  - PostgreSQL instance          │
  └──────────────┘                  │  - pgvector index               │
                                    │  - Kafka cluster                │
                                    │  - VK Agent pod                 │
                                    │  - BYOK Vault path              │
                                    └────────────────────────────────┘
```

### 5.3 Self-Hosted — On-Premises Kubernetes

For customers requiring full on-premises deployment (OQ-005 resolved: supported from GA):

```
Customer Data Centre / Private Cloud
┌─────────────────────────────────────────────────────────────────────┐
│  Customer Kubernetes (1.28+)                                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  IIVKIS Helm Chart (iivkis/iivkis-stack)                    │  │
│  │                                                              │  │
│  │  Portal  │  API  │  Orchestrator                            │  │
│  │  VK Agent │ TS Agent │ INT Agent │ ANLYS Agent │ LLM GW    │  │
│  │  Correlation Engine │ Billing Engine │ Notification Svc    │  │
│  │                                                              │  │
│  │  Data Layer (in-cluster or customer-managed):               │  │
│  │  PostgreSQL (bitnami/postgresql) + pgvector                  │  │
│  │  Redis (bitnami/redis)                                       │  │
│  │  Kafka (strimzi/strimzi-kafka-operator)                      │  │
│  │  MinIO (object store, S3-compatible)                         │  │
│  │                                                              │  │
│  │  Platform:  Vault  │  OPA  │  SPIRE                         │  │
│  │  Observability:  Prometheus  │  Grafana  │  Loki  │  Tempo   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  LLM Provider options (customer choice):                           │
│  - On-premises LLM (llama.cpp, Ollama, vLLM via OpenAI-compat API) │
│  - Air-gapped: no outbound LLM calls; on-prem model only           │
│  - Hybrid: on-prem for sensitive data, cloud for non-PII tasks     │
└─────────────────────────────────────────────────────────────────────┘
```

**Self-host packaging:**
- Single `helm install iivkis/iivkis-stack` with `values.yaml` overrides
- Helm sub-charts for each data dependency, individually disableable (for BYO databases)
- `values.yaml` profiles: `dev` (single-replica, no HA), `prod` (HA, PDB, anti-affinity)
- License validated offline via a signed JWT checked at startup; no phone-home required
- Air-gapped image bundle available as OCI tarball for fully disconnected environments

---

## 6. Core Subsystem Overviews

### 6.1 API Gateway & Ingress Layer

**Responsibility:** Terminate TLS, enforce WAF, authenticate every request, apply rate
limits, route to backend services.

```
Ingress Flow:
Browser / External System
  → CDN (TLS 1.3, HSTS, HTTP/2)
  → WAF (OWASP CRS 3.3, custom prompt-injection rules)
  → Cloud Load Balancer (multi-AZ)
  → NGINX Ingress Controller (Kubernetes)
  → API Gateway sidecar (rate limit, JWT verification, OPA enforcement)
  → Express API Pod
```

Key responsibilities:
- JWT verification (RS256, JWKS from Vault PKI); `alg:none` rejected
- `tenant_id` extracted from JWT claim; injected into all downstream calls
- Rate limiting: token-bucket per tenant per endpoint category (NFR-SEC-012)
- Rate-limit response headers `X-RateLimit-*` (NFR-SEC-016)
- Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options (NFR-SEC-013)
- OPA sidecar: pre-authorisation check before any handler executes

### 6.2 Engineering Orchestrator

**Responsibility:** Receive complex task requests from the API; decompose, dispatch, and
aggregate sub-tasks across Agents via the message queue.

```
API ──(HTTP/mTLS)──▶ Orchestrator
                        │
                        ├── Publish task to Kafka topic  ──▶ Agent(s)
                        │   (with idempotency key, tenant_id, trace_id)
                        │
                        ├── Wait for response (Kafka reply topic or callback)
                        │
                        └── Aggregate + return to API
```

- Routing table: maps task types to agent Kafka topics (extensible without code changes)
- Saga pattern for multi-agent workflows: compensating transactions on partial failure
- Bulkhead: independent Kafka consumer groups per agent type (NFR-RES-002)
- Circuit breaker per agent with configurable open/half-open thresholds (NFR-RES-011)
- Dead Letter Queue per agent topic for failed tasks (NFR-RES-021)

### 6.3 Vendor Knowledge Agent & KG+RAG Pipeline

**Responsibility:** Ingest, structure, and expose vendor knowledge as a searchable
Knowledge Graph (KG) and vector-indexed corpus for Retrieval-Augmented Generation (RAG).

#### KG+RAG Architecture Overview

```
External Sources                 Ingestion Pipeline
────────────────     ┌──────────────────────────────────────────────┐
Vendor REST APIs ───▶│  Feed Collector                             │
RSS/Atom Feeds   ───▶│    │ Signature verification (FR-INT-009)    │
PDF/CSV/JSON     ───▶│    │ Streaming parser + payload size cap     │
Manual Entry     ───▶│    ▼                                        │
                  │  Normaliser & Deduplicator (FR-VK-003)        │
                  │    │ canonical schema, provenance stamp        │
                  │    ▼                                          │
                  │  Knowledge Graph Updater ──────────────────▶  │
                  │    │ (PostgreSQL graph schema)                │
                  │    ▼                                          │
                  │  Embedding Generator                         │
                  │    │ chunk → OpenAI/local embedding model    │
                  │    ▼                                          │
                  │  Vector Store Writer                         │
                  │    │ pgvector, tenant-namespaced             │
                  └──────────────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │   VK Agent Query Interface          │
                 │   ┌──────────────────────────────┐  │
                 │   │ Keyword Search (full-text PG) │  │
                 │   │ Semantic Search (ANN, pgvector│  │
                 │   │ KG Traversal (graph query)   │  │
                 │   │ Hybrid: keyword + vector +KG  │  │
                 │   └──────────────────────────────┘  │
                 └─────────────────────────────────────┘
```

#### Knowledge Graph Schema (conceptual)

```
(Vendor)──[:HAS_PRODUCT]──(Product)──[:HAS_VERSION]──(Version)
                                │                         │
                          [:HAS_ADVISORY]          [:SUPERSEDES]
                                │
                          (Advisory)──[:AFFECTS]──(Version)
                                │──[:RECOMMENDS]──(Patch)
                                │──[:REFERENCES]──(KnowledgeArticle)
                                │
                     [:HAS_EOL]──(EolRecord)
```

#### RAG Query Flow

```
User Query (natural language)
  │
  ▼
Query Parser & Expander
  │ (extract entities: vendor, product, version, issue type)
  ▼
Hybrid Retrieval
  ├── Semantic search: pgvector ANN (top-K, cosine similarity, tenant-namespaced)
  ├── KG traversal: Cypher-like query on PostgreSQL graph schema
  └── Full-text search: PostgreSQL tsvector
  │
  ▼
Re-ranking & Context Assembly
  │ (BM25 + cross-encoder re-rank; max context window fitting)
  ▼
LLM Gateway ──▶ LLM Provider (with retrieved context in prompt)
  │
  ▼
Response + Citations (article IDs + source URLs)
```

### 6.4 Correlation Engine

**Responsibility:** Ingest signals from all sources, apply rule-based and ML-based
correlation, produce root-cause candidates with confidence scores.

#### Architecture

```
Signal Sources                Signal Ingestor
──────────────   ┌────────────────────────────────────────────────┐
Incidents     ──▶│  Kafka Consumer (per-tenant topics)           │
Monitoring    ──▶│    │ Enrichment (tenant_id, CI, severity, TS)  │
Alerts        ──▶│    ▼                                          │
CMDB Changes  ──▶│  Signal Normaliser                           │
Log Anomalies ──▶│    │ dedup (FR-INT-006 fingerprint)           │
Vendor Advis. ──▶│    ▼                                          │
              │  Signal Store (Redis time-series + PG archive)  │
              └─────────────────┬──────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────────────────┐
              │  Correlation Processors (parallel workers)     │
              │                                                │
              │  ┌──────────────────────────────────────────┐ │
              │  │ Temporal Correlator                      │ │
              │  │ Sliding window (default 5 min)           │ │
              │  │ Co-occurrence of CIs in same window      │ │
              │  └──────────────────────────────────────────┘ │
              │                                                │
              │  ┌──────────────────────────────────────────┐ │
              │  │ Topological Correlator                   │ │
              │  │ CI dependency graph (from CMDB replica)  │ │
              │  │ Traversal: signal CI → parent/child CIs  │ │
              │  └──────────────────────────────────────────┘ │
              │                                                │
              │  ┌──────────────────────────────────────────┐ │
              │  │ Semantic Correlator                      │ │
              │  │ LLM Gateway: signal description embedding│ │
              │  │ Cosine similarity > threshold            │ │
              │  └──────────────────────────────────────────┘ │
              │                                                │
              │  ┌──────────────────────────────────────────┐ │
              │  │ Rule Engine                              │ │
              │  │ Tenant-scoped DSL rules (versioned)      │ │
              │  │ Pattern matching on enriched signal      │ │
              │  └──────────────────────────────────────────┘ │
              │                                                │
              │  ┌──────────────────────────────────────────┐ │
              │  │ ML Correlator (Python worker)            │ │
              │  │ Trained model (GNN or transformer)       │ │
              │  │ Proposes candidates above conf. threshold │ │
              │  └──────────────────────────────────────────┘ │
              └─────────────────┬──────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────────────────┐
              │  Correlation Group Builder                     │
              │  Votes from processors → consensus threshold   │
              │  Root-cause candidate + confidence score       │
              │  Narrative via LLM Gateway                     │
              │  Publish: Kafka event + DB + webhook (FR-CE-024)│
              └───────────────────────────────────────────────┘
```

**Throughput design:** 10,000 signals/minute per tenant (FR-CE-003 / NFR-SCALE-004).
Signal processors are stateless; horizontally scaled via KEDA on Kafka lag.

### 6.5 LLM Gateway

**Responsibility:** Abstract LLM provider details; enforce token budgets; apply
guardrails; implement semantic caching; route to provider by tenant configuration.

```
Agent (any) ──▶ LLM Gateway API (internal mTLS)
                    │
                    ├── OPA: tenant budget check (FR-LLM-006)
                    ├── Cache lookup: pgvector cosine-sim ≥ 0.97 (FR-LLM-018)
                    ├── Guardrails: OPA + custom rules (FR-LLM-016, NFR-SEC-014)
                    │
                    ├── Provider Router
                    │     ├── Tenant config: primary provider
                    │     ├── Model-tier routing: task complexity → model tier
                    │     └── Fallback chain: primary → secondary → on-prem
                    │
                    ├── Streaming SSE (FR-LLM-017) or batch mode
                    ├── PII redaction before log write (FR-LLM-005)
                    └── Token usage metering → Billing Engine Kafka topic
```

Providers supported: OpenAI GPT-4 class, Anthropic Claude, Azure OpenAI,
OpenAI-compatible (Ollama, vLLM, llama.cpp) for self-hosted deployments.

### 6.6 Integration Agent

**Responsibility:** Manage bidirectional sync with external IT systems; validate
credentials; handle retries; enforce HMAC on inbound webhooks.

```
External Systems (ServiceNow, Datadog, Jira, etc.)
      │ Outbound: polling / webhook subscription
      ▼
Integration Agent
  ├── Adapter Registry (pluggable per-system adapters)
  ├── Inbound Webhook Handler
  │     ├── HMAC-SHA256 verification (FR-INT-009)
  │     ├── Timestamp replay prevention (5-min window)
  │     ├── IP allowlist check (FR-INT-010)
  │     └── Schema mapper → normalised IIVKIS event → Kafka
  ├── Outbound Sync Worker
  │     ├── Polling scheduler (per-integration interval)
  │     ├── Exponential backoff retry (NFR-RES-010)
  │     └── Circuit breaker per integration (NFR-RES-011)
  ├── Credential Store (Vault-backed, never in API responses)
  └── CI Graph Importer
        ├── CMDB sync (FR-INT-020/021/022)
        └── Topology graph update → PostgreSQL graph store
```

### 6.7 Troubleshooting Agent

**Responsibility:** Given an incident, generate step-by-step resolution plans using
LLM reasoning over vendor knowledge, incident history, and correlation data.

```
Incident ──▶ Troubleshooting Agent
                │
                ├── Context Assembly
                │     ├── VK Agent: relevant knowledge articles (RAG)
                │     ├── Correlation Engine: linked correlation group
                │     ├── Incident history: similar past incidents (vector search)
                │     └── CMDB: affected CI topology
                │
                ├── Prompt Construction (versioned template)
                │
                ├── LLM Gateway ──▶ Resolution Plan (structured JSON)
                │
                ├── Plan Validation (OPA guardrails)
                │
                └── Streaming SSE ──▶ Portal (progressive rendering)
```

### 6.8 Analysis Agent

**Responsibility:** Produce dashboards, trend analysis, anomaly detection, and
narrative summaries.

Key outputs:
- Incident volume trend, MTTR, top affected products (FR-AN-001)
- Correlation accuracy metrics (FR-CE-025)
- LLM usage / cost attribution (via billing ledger)
- Anomaly narrative: LLM-generated human-readable summaries (FR-LLM-013)
- Forecast: time-series projection (Holt-Winters or ML model)

### 6.9 Billing Engine

**Responsibility:** Metered usage tracking, plan enforcement, invoice generation.

```
All services emit usage events ──▶ Kafka billing.usage topic
                                         │
                                    Billing Engine
                                         ├── Real-time aggregation (Redis sliding window)
                                         ├── Token-budget enforcement (LLM Gateway check)
                                         ├── Tamper-evident usage ledger (append-only PG table)
                                         ├── Invoice generation (Stripe / payment processor)
                                         └── Threshold notifications ──▶ Notification Service
```

### 6.10 Notification Service

**Responsibility:** Fan-out notifications to configured channels (email, Slack, Teams,
PagerDuty, webhook) with per-tenant routing policies.

```
Event Sources ──▶ Notification Service
                     ├── Policy Engine: match event type to tenant channels
                     ├── Recipient validation (anti-misdirection check, FR-NOTIF-002)
                     ├── Channel adapters: Email (SES/SMTP), Slack, Teams, PD, Webhook
                     └── Delivery receipt logging (audit trail)
```

### 6.11 Portal (Frontend)

**Responsibility:** User-facing Next.js application — incident management, knowledge
browsing, AI chat, dashboards, admin panels.

Key architectural choices:
- **Server-Side Rendering (SSR):** Dashboard and incident list pages for SEO + fast TTI
- **Static Generation:** Knowledge article pages (ISR with 5-minute revalidation)
- **Client-Side:** AI chat widget (SSE streaming), real-time signal feeds (WebSocket)
- **No secrets in `getServerSideProps`:** Vault-only retrieval via API; never client-side
- **BFF pattern:** Portal API routes act as Backend-for-Frontend, never exposing internal
  service URLs to the browser

---

## 7. Data Stores

| Store | Technology | Purpose | Isolation Mechanism |
|---|---|---|---|
| Relational DB | PostgreSQL 15 + Aurora | Incidents, users, tenants, integrations, billing | Row-Level Security + tenant_id |
| Cache | Redis 7 Cluster | Session tokens, rate-limit counters, signal hot-store, LLM cache | Keyspace prefixed by tenant_id |
| Vector DB | pgvector (PostgreSQL extension) | Knowledge article embeddings, semantic cache | Schema namespace or separate index per tenant |
| Knowledge Graph | PostgreSQL (adjacency-list + closure table) | Vendor/product/advisory relationships, CI topology | tenant_id FK on all nodes + RLS |
| Message Queue | Apache Kafka 3.x | Async task dispatch, signal ingest, usage events | Per-tenant topics (T3) or tenant_id headers (T1/T2) |
| Object Store | S3-compatible (AWS S3 / MinIO) | Audit logs, document uploads, backups, SBOM | Per-tenant bucket prefix; bucket-level ACL |
| Secrets | HashiCorp Vault 1.15 | Credentials, API keys, encryption keys, OIDC tokens | Per-service, per-tenant Vault paths |

---

## 8. Security Architecture Summary

All security controls are derived from [threat-model.md v1.0.1](threat-model.md).
Key architecture-level enforcement points:

| Control | Where Enforced | Threat Mitigated |
|---|---|---|
| JWT RS256 + `alg` claim enforcement | API Gateway sidecar | TH-S-002 |
| MFA (TOTP + hardware key for super-admin) | Portal + IdP | TH-S-001, TH-S-008 |
| mTLS SPIFFE/SPIRE | All pod-to-pod communication | TH-S-003, TH-T-007 |
| OPA tenant isolation policy | Per-service sidecar | TH-E-001, TH-E-002, TH-E-007 |
| Row-Level Security | PostgreSQL | TH-I-001 |
| pgvector namespace enforcement | VK Agent (code + OPA) | TH-I-004 |
| Vault secrets management | All services — no env-var secrets | TH-I-005 |
| WAF (OWASP CRS 3.3 + custom) | Ingress layer | TH-T-001, TH-T-002, TH-D-001 |
| HMAC-SHA256 webhook verification | Integration Agent | TH-S-005, TH-T-004 |
| PII redaction before log write | LLM Gateway | TH-I-002 |
| Immutable audit log (WORM) | Object store | TH-T-005, TH-R-001 |
| Dependency CVE scan + SAST + image signing | CI/CD pipeline | TH-T-006 |
| OPA LLM input gate + guardrails | LLM Gateway | TH-T-002, TH-E-003 |

---

## 9. Observability Architecture

```
All Services
  │ OpenTelemetry SDK (traces, metrics, logs)
  ▼
OTel Collector (DaemonSet)
  ├── Traces ──▶ Jaeger / Grafana Tempo
  ├── Metrics ──▶ Prometheus ──▶ Grafana dashboards
  └── Logs ──▶ Loki (structured JSON, per-tenant log stream labels)

Alerting:
  Prometheus Alertmanager
    ├── Error rate > 1% ──▶ PagerDuty / Slack
    ├── p95 latency > SLA threshold ──▶ Slack
    ├── Kafka queue depth > 10,000 ──▶ PagerDuty
    ├── Circuit breaker open ──▶ Slack
    └── LLM budget > 80% ──▶ Tenant notification + internal alert
```

Tenant-scoped observability: Grafana folders per tenant; API-driven dashboard
provisioning; read-only tenant-admin access to their own metrics/logs.

---

## 10. Technology Stack Decisions

Answering open questions from [requirements.md](requirements.md):

| Question | Decision | Rationale |
|---|---|---|
| OQ-001 — Vector DB | **pgvector** (PostgreSQL extension) | Eliminates a separate infrastructure component; strong tenant-namespace partitioning; GA-ready with pgvector 0.7; can migrate to Pinecone/Qdrant if scale requires |
| OQ-002 — Cloud Platform | **AWS primary; Azure secondary** | AWS has broadest managed service coverage; Azure support required for Enterprise customers in Microsoft-stack environments |
| OQ-005 — Self-hosted at GA? | **Yes — Helm chart from day one** | Enterprise and regulated-industry customers require on-prem; Helm packaging is low additional effort given container-first design |
| OQ-007 — Message Queue | **Apache Kafka** (MSK on AWS, Strimzi on self-hosted) | Required throughput (1M signals/min aggregate, NFR-SCALE-004); durable, partitioned, at-least-once; strong Kubernetes operator ecosystem |

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: PostgreSQL + pgvector instead of dedicated vector database

**Status:** Accepted  
**Context:** FR-VK-008 and FR-VK-010 require tenant-isolated vector search. Options
considered: pgvector, Pinecone, Weaviate, Qdrant.  
**Decision:** Use pgvector as a PostgreSQL extension.  
**Rationale:** (a) Eliminates a dedicated operational database; (b) tenant isolation via
schema namespaces is a first-class Postgres feature; (c) transactional consistency
between graph store and vector index; (d) single backup/restore procedure.  
**Trade-offs:** Maximum index size (~100M vectors per index) may require migration to
Qdrant for hyperscale tenants; addressed by the vector abstraction layer in VK Agent.

### ADR-002: Apache Kafka as message queue

**Status:** Accepted  
**Context:** NFR-SCALE-004 requires ≥ 1M signals/minute aggregate. Options: Kafka,
RabbitMQ, AWS SQS, Azure Service Bus.  
**Decision:** Apache Kafka (MSK on SaaS, Strimzi operator on self-hosted).  
**Rationale:** (a) Kafka partitioning provides linear horizontal scaling; (b) log-based
retention enables replay for ML training; (c) strong Kubernetes operator (Strimzi) for
self-hosted; (d) KEDA Kafka trigger for autoscaling agents.

### ADR-003: Shared PostgreSQL with RLS for Tier 1/2 tenants

**Status:** Accepted  
**Context:** FR-MT-003 requires both shared and dedicated deployment options.  
**Decision:** Default to RLS-based shared PostgreSQL; dedicated instance for T3
Enterprise tenants.  
**Rationale:** RLS at the database layer is enforced independently of application code,
reducing risk of application-level bypass. OPA sidecar provides defence-in-depth.

### ADR-004: Helm chart as self-host packaging format

**Status:** Accepted  
**Context:** OQ-005 — self-hosted deployment required at GA.  
**Decision:** Single Helm umbrella chart with sub-charts per component.  
**Rationale:** (a) Standard Kubernetes packaging; (b) `values.yaml` overrides allow BYO
databases, custom TLS, and air-gapped image registries; (c) ArgoCD/Flux compatible for
GitOps customers.

### ADR-005: KG+RAG hybrid retrieval over pure vector search

**Status:** Accepted  
**Context:** FR-VK-001/008 require structured knowledge graph AND semantic search.  
**Decision:** Hybrid retrieval combining pgvector ANN + PostgreSQL graph traversal +
full-text search, re-ranked before LLM context assembly.  
**Rationale:** Pure vector search misses structured relationships (product → advisory →
patch). KG traversal provides precise structured lookups. Hybrid approach captures both.
