# IIVKIS Data Flow Diagrams (DFD)

**Document ID:** IIVKIS-ARCH-003  
**Version:** 1.0.1  
**Status:** Validated — Phase 3 Validation Pass  
**Phase:** STEP 3 — Architecture Design  
**Author:** Architect Agent  
**Date:** 2026-03-28  
**References:** [IIVKIS-ARCH-001 HLD](hld.md), [IIVKIS-ARCH-002 LLD](lld.md), [IIVKIS-SEC-001 v1.0.1](threat-model.md)

### Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-03-28 | Architect Agent | Initial DFD set — L0 context diagram, L1 system decomposition, L2 per-subsystem: Vendor Knowledge + KG+RAG, Correlation Engine, LLM Gateway, Integration Agent, Authentication, Billing |
| 1.0.1 | 2026-03-28 | Architect Agent | Phase 3 Validation — added L2 Analysis Agent DFD (§11); renumbered §11→§12 (Multi-Tenant Boundary Map), §12→§13 (Sequence Diagrams) |

---

## Table of Contents

1. [Diagram Conventions](#1-diagram-conventions)
2. [L0 — Context Diagram](#2-l0--context-diagram)
3. [L1 — System Decomposition](#3-l1--system-decomposition)
4. [L2 — Vendor Knowledge Agent & KG+RAG Pipeline](#4-l2--vendor-knowledge-agent--kgrag-pipeline)
5. [L2 — Correlation Engine](#5-l2--correlation-engine)
6. [L2 — LLM Gateway](#6-l2--llm-gateway)
7. [L2 — Integration Agent & Webhook Ingest](#7-l2--integration-agent--webhook-ingest)
8. [L2 — Authentication & Session Flow](#8-l2--authentication--session-flow)
9. [L2 — Billing & Usage Metering](#9-l2--billing--usage-metering)
10. [L2 — Notification Flow](#10-l2--notification-flow)
11. [L2 — Analysis Agent](#11-l2--analysis-agent)
12. [Multi-Tenant Data Boundary Map](#12-multi-tenant-data-boundary-map)
13. [Cross-Subsystem Sequence Diagrams](#13-cross-subsystem-sequence-diagrams)
    - 13.1 [Incident Resolution Plan Generation](#131-incident-resolution-plan-generation)
    - 13.2 [Signal Ingest → Correlation Group → Notification](#132-signal-ingest--correlation-group--notification)
    - 13.3 [Semantic Knowledge Search (RAG)](#133-semantic-knowledge-search-rag)

---

## 1. Diagram Conventions

```
┌────────┐   External entity (actor / external system)
│        │   — outside IIVKIS platform boundary
└────────┘

╔════════╗   IIVKIS internal process / service
║        ║
╚════════╝

┌ ─ ─ ─ ┐   Data store
│  ═════  │
└ ─ ─ ─ ┘

──────────▶  Data flow (direction of data movement)
- - - - -▶  Control/event flow (trigger, not data payload)
═══════════  Trust boundary crossing
[label]     Data label on flow arrow

Security notes on flows:
  TB = Trust Boundary crossing (numbered from threat-model.md §3.2)
  All TB crossings enforce: TLS 1.3 (external) or mTLS (internal)
```

---

## 2. L0 — Context Diagram

The L0 diagram shows IIVKIS as a single black box with all external actors.

```
                             ┌──────────────────┐
                             │  IT Ops Engineer  │
                             │  Tenant Admin     │
                             │  Billing Admin    │
                             └────────┬──────────┘
                                      │ HTTPS (TB-01: WAF+TLS)
                                      │ [portal interactions, API calls]
                    ┌─────────────────▼──────────────────────────────────────────┐
                    │                                                             │
┌───────────────┐   │                                                             │   ┌────────────────────┐
│  LLM          │◀══╪══[prompt/completion payloads]══════════════════════════════╪══▶│  Payment Processor  │
│  Providers    │   │        TB-05: TLS 1.3                                       │   │  (Stripe / Zuora)  │
│  OpenAI /     │   │                                                             │   └────────────────────┘
│  Anthropic /  │   │                                                             │
│  Azure OAI /  │   │                  IIVKIS PLATFORM                           │   ┌────────────────────┐
│  On-prem LLM  │   │                                                             │   │  Identity Provider │
└───────────────┘   │                                                             │◀══╪══[OIDC/SAML tokens]│
                    │                                                             │   │  (Okta / Azure AD) │
┌───────────────┐   │                                                             │   └────────────────────┘
│  Vendor       │◀══╪══[knowledge feed fetch]════════════════════════════════════╪
│  Systems      │   │        TB-09: TLS+Sig                                       │   ┌────────────────────┐
│  (REST APIs,  │   │                                                             │   │  Super-Admin       │
│   RSS, files) │   │                                                             │◀══╪══[admin portal]    │
└───────────────┘   │                                                             │   └────────────────────┘
                    │                                                             │
┌───────────────┐   │                                                             │
│  External IT  │══▶╪══[webhook inbound events]══════════════════════════════════╪
│  Systems      │   │        TB-08: HMAC+TLS                                      │
│  ServiceNow / │◀══╪══[incident/status push outbound]══════════════════════════╪
│  Jira / PD /  │   │        TB-08: TLS                                           │
│  Datadog etc. │   │                                                             │
└───────────────┘   └─────────────────────────────────────────────────────────────┘
```

**External Actors Summary:**

| Actor | Interaction | Direction | Protocol |
|---|---|---|---|
| IT Ops Engineer | Portal + API | Bidirectional | HTTPS |
| Tenant Admin | Portal + API | Bidirectional | HTTPS |
| Billing Admin | Portal + API | Bidirectional | HTTPS |
| Super-Admin | Admin portal + API | Bidirectional | HTTPS + Hardware MFA |
| LLM Providers | Completion/embedding API calls | IIVKIS → Provider | HTTPS TLS 1.3 |
| Vendor Systems | Knowledge feed pull | IIVKIS → Vendor | HTTPS TLS 1.3 |
| External IT Systems | Webhook push + status pull | Bidirectional | HTTPS + HMAC |
| Identity Provider | OAuth2/OIDC token issuance | Browser ↔ IdP, token → IIVKIS | HTTPS |
| Payment Processor | Subscription billing | IIVKIS → Processor | HTTPS |

---

## 3. L1 — System Decomposition

This diagram decomposes the IIVKIS platform into its major internal processes and data stores.

```
                                    ┌──────────────────┐
                                    │  IT Ops Engineer  │
                                    └────────┬──────────┘
                                             │ HTTPS
                                   ══════════╪═══════════════ TB-01 WAF+TLS
                                             ▼
                             ╔═══════════════════════════════╗
                             ║  [1] WAF + CDN + Ingress      ║
                             ╚═══════════════════════════════╝
                                             │ [JWT-authenticated request]
                             ╔═══════════════════════════════╗
                             ║  [2] API (Express /api/v1)    ║
                             ║  JWT verify | OPA | RateLimit ║
                             ╚═══════════╤═══════════════════╝
                        ┌───────────────┤ mTLS
                        │               │
                        ▼               ▼
           ╔════════════════╗  ╔════════════════════════╗
           ║  [3] Portal    ║  ║  [4] Orchestrator      ║
           ║  (Next.js SSR) ║  ║  task dispatch + saga  ║
           ╚════════════════╝  ╚══════════┤═════════════╝
                                          │ Kafka (mTLS)
                 ┌────────────────────────┼────────────────────────┐
                 │                        │                        │
                 ▼                        ▼                        ▼
  ╔═════════════════════╗  ╔═════════════════════╗  ╔═════════════════════╗
  ║ [5] Vendor          ║  ║ [6] Troubleshooting ║  ║ [7] Integration     ║
  ║ Knowledge Agent     ║  ║ Agent               ║  ║ Agent               ║
  ╚═════════════════════╝  ╚═════════════════════╝  ╚=════════════════════╝
                 │                        │                        │
  ╔═════════════════════╗  ╔═════════════════════╗                │
  ║ [8] Analysis Agent  ║  ║ [9] LLM Gateway     ║◀───────────────┘
  ╚═════════════════════╝  ╚═════════════════════╝       mTLS
                 │                        │
  ╔═════════════════════╗                 │ mTLS ═══ TB-05
  ║ [10] Correlation    ║                 │               ┌──────────────────┐
  ║ Engine              ║                 ▼               │  LLM Providers   │
  ╚═════════════════════╝        ┌────────────────┐       └──────────────────┘
                 │               │  External LLM  │
                 │               └────────────────┘
  ╔═════════════════════╗
  ║ [11] Billing Engine ║
  ╚═════════════════════╝
  ╔═════════════════════╗
  ║ [12] Notification   ║
  ║ Service             ║
  ╚═════════════════════╝

Data Stores (all tenant-isolated via RLS / namespace):
  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  │  DS-1: PostgreSQL (incidents, users, tenants, KG nodes/edges, audit logs)    │
  │  DS-2: pgvector (knowledge_embeddings, llm_cache)                            │
  │  DS-3: Redis (sessions, rate-limit counters, signal hot-store, LLM counters) │
  │  DS-4: Kafka (signal ingest, task dispatch, usage events, DLQ)               │
  │  DS-5: S3 / MinIO (audit log archive, documents, backups)                    │
  │  DS-6: Vault (secrets, encryption keys, OIDC/service tokens)                 │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 4. L2 — Vendor Knowledge Agent & KG+RAG Pipeline

### 4.1 Feed Ingestion Flow

```
┌─────────────────┐
│  Vendor Systems  │  (RSS, REST API, files)
└───────┬─────────┘
        │ [raw feed content] HTTPS + signature check
        ▼ TB-09
╔════════════════════════════════════╗
║  Feed Collector                   ║
║  - Signature verification         ║
║  - Streaming parser               ║
║  - Payload size cap (100 MB)      ║
╚════════════════╤═══════════════════╝
                 │ [parsed raw items]
                 ▼
╔════════════════════════════════════╗
║  Normaliser & Deduplicator        ║
║  - Map to canonical schema        ║
║  - Compute content_hash           ║
║  - Stamp provenance, source_id    ║
║  - Query DS-1: known hash? skip   ║
╚════════════════╤═══════════════════╝
                 │ [new/updated articles]
        ┌────────┴────────┐
        ▼                 ▼
╔═══════════════╗  ╔════════════════════════════════════╗
║  KG Updater   ║  ║  Embedding Generator               ║
║  - Upsert     ║  ║  - Chunk article (512 tok, 64 ovlp)║
║    kg_nodes   ║  ║  - Call LLM Gateway: llm.embed     ║
║  - Upsert     ║  ║  - Receive vector (1536 dims)      ║
║    kg_edges   ║  ╚════════════════╤═══════════════════╝
╚═══════┤═══════╝                   │ [chunks + vectors]
        │ [graph updates]           ▼
        ▼               ╔════════════════════════════════════╗
   ┌ ─ ─ ─ ─ ─ ┐       ║  Vector Store Writer               ║
   │  DS-1 KG   │       ║  - INSERT knowledge_embeddings     ║
   │  (kg_nodes,│       ║  - Namespace: tenant_id or NULL    ║
   │  kg_edges) │       ╚════════════════╤═══════════════════╝
   └ ─ ─ ─ ─ ─ ┘                        │ [indexed vectors]
                        ┌ ─ ─ ─ ─ ─ ─ ─ ─▼─ ─ ─ ─ ─ ─ ─ ┐
                        │  DS-2 pgvector                  │
                        │  (knowledge_embeddings)         │
                        └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 4.2 RAG Query Flow

```
┌──────────────┐
│  User Query  │  (natural language)
└──────┬───────┘
       │ [query text]
       ▼
╔═════════════════════════════════════════╗
║  Query Parser & Expander              ║
║  - NER: extract vendor, product, ver  ║
║  - Expand: synonyms, abbreviations    ║
╚═════════════════╤═══════════════════════╝
       │ [structured query + expanded terms]
       ▼
╔════════════════════════════════════════════════════════════╗
║  Hybrid Retriever (parallel)                              ║
║                                                          ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │  A. Vector Search (DS-2)                         │  ║
║  │     embed(query) → ANN search                    │  ║
║  │     WHERE tenant_id=$t OR tenant_id IS NULL      │  ║
║  │     LIMIT 50, sorted by cosine similarity        │  ║
║  └───────────────────────────────────────────────────┘  ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │  B. Full-Text Search (DS-1)                      │  ║
║  │     tsvector @@ tsquery, ts_rank                 │  ║
║  │     WHERE tenant_id=$t OR tenant_id IS NULL      │  ║
║  └───────────────────────────────────────────────────┘  ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │  C. KG Traversal (DS-1 graph)                    │  ║
║  │     Match extracted entities → KG nodes          │  ║
║  │     Traverse edges: HAS_ADVISORY, RECOMMENDS     │  ║
║  │     Return related articles + patch nodes        │  ║
║  └───────────────────────────────────────────────────┘  ║
╚════════════════════════╤═══════════════════════════════════╝
                         │ [A∪B∪C result sets]
                         ▼
╔════════════════════════════════════════════════════════════╗
║  Re-ranker (RRF + cross-encoder)                          ║
║  - Reciprocal Rank Fusion across 3 result sets           ║
║  - Top-N (default 10) selected                           ║
║  - Context window fitting: accumulate until token budget  ║
╚════════════════════════╤═══════════════════════════════════╝
                         │ [assembled context chunks + citations]
                         ▼
╔════════════════════════════════════════════════════════════╗
║  LLM Gateway                                              ║
║  - Prompt: system + context + user query                 ║
║  - Guardrails: input scan                                ║
║  - Provider dispatch                                     ║
╚════════════════════════╤═══════════════════════════════════╝
                         │ [LLM answer + citation refs]
                         ▼
              ┌──────────────────┐
              │  Response to     │
              │  calling agent / │
              │  portal user     │
              └──────────────────┘
```

---

## 5. L2 — Correlation Engine

```
Signal Sources                                 Platform Boundary
══════════════════════════════════════ TB-08 ══════════════════

┌─────────────────┐
│ Monitoring Sys  │──▶ [webhook / poll]
│ (Datadog etc.)  │                    ┐
└─────────────────┘                    │
┌─────────────────┐                    │ [raw signals, all sources]
│ Incidents (API) │──▶ [direct ingest] ├──▶
└─────────────────┘                    │        ╔═══════════════════════╗
┌─────────────────┐                    │        ║  Signal Ingestor      ║
│ Log Anomaly     │──▶ [via Int.Agent] ├──▶     ║  - Schema validate    ║
└─────────────────┘                    │        ║  - Fingerprint compute║
┌─────────────────┐                    │        ║  - Idempotency (upsert║
│ CMDB Changes    │──▶ [via Int.Agent] ┘        ║    ON CONFLICT skip)  ║
└─────────────────┘                             ╚═══════════╤═══════════╝
                                                            │ [enriched signal]
                                                            ▼
                                                ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                                                │  DS-3 Redis             │
                                                │  Signal hot-store       │
                                                │  (72h active window)    │
                                                └ ─ ─ ─ ─ ─▲─ ─ ─ ─ ─ ─ ┘
                                                            │ [CI lookup cache]
                                                ╔═══════════╧══════════════════════════════════╗
                                                ║  Correlation Processors (parallel fanout)   ║
                                                ║                                              ║
                                                ║  ┌──────────────────────────────────────┐  ║
                                                ║  │ Temporal Correlator                 │  ║
                                                ║  │ Sliding window (default 5 min)      │  ║
                                                ║  │ Group signals: same CI, same window │  ║
                                                ║  │ Score contribution: 0–25 points     │  ║
                                                ║  └──────────────────────────────────────┘  ║
                                                ║  ┌──────────────────────────────────────┐  ║
                                                ║  │ Topological Correlator              │  ║
                                                ║  │ CI dependency graph (DS-1 KG)       │  ║
                                                ║  │ Signal CI → parent/child up to 3hop │  ║
                                                ║  │ Score contribution: 0–30 points     │  ║
                                                ║  └──────────────────────────────────────┘  ║
                                                ║  ┌──────────────────────────────────────┐  ║
                                                ║  │ Semantic Correlator                 │  ║
                                                ║  │ Embed signal desc → LLM Gateway     │  ║
                                                ║  │ Cosine-sim between signal pairs     │  ║
                                                ║  │ Score contribution: 0–25 points     │  ║
                                                ║  └──────────────────────────────────────┘  ║
                                                ║  ┌──────────────────────────────────────┐  ║
                                                ║  │ Rule Engine                         │  ║
                                                ║  │ Eval tenant DSL rules (DS-1)        │  ║
                                                ║  │ Score contribution: 0–20 points     │  ║
                                                ║  └──────────────────────────────────────┘  ║
                                                ║  ┌──────────────────────────────────────┐  ║
                                                ║  │ ML Correlator (Python worker)       │  ║
                                                ║  │ GNN / transformer model             │  ║
                                                ║  │ Proposes candidates above threshold │  ║
                                                ║  └──────────────────────────────────────┘  ║
                                                ╚═══════════════════╤══════════════════════════╝
                                                                    │ [voted candidates + scores]
                                                                    ▼
                                                ╔═══════════════════════════════════════════════╗
                                                ║  Correlation Group Builder                   ║
                                                ║  - Consensus threshold check                ║
                                                ║  - Confidence = Σ processor scores (0–100)  ║
                                                ║  - LLM Gateway: generate narrative          ║
                                                ║  - INSERT correlation_groups (DS-1)         ║
                                                ║  - INSERT signal_group_memberships          ║
                                                ╚══════════════════════╤════════════════════════╝
                                                                       │
                        ┌──────────────────────────────────────────────┼───────────────────────┐
                        ▼                                              ▼                        ▼
               ╔════════════════╗                         ┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐     ╔════════════════════╗
               ║ Notification   ║                         │  DS-1 PostgreSQL  │     ║ Outbound Webhook   ║
               ║ Service        ║                         │  (correlation_    │     ║ (FR-CE-024)        ║
               ║ (alert ops)    ║                         │   groups table)   │     ║ → External ITSM    ║
               ╚════════════════╝                         └ ─ ─ ─ ─ ─ ─ ─ ─ ┘     ╚════════════════════╝
```

---

## 6. L2 — LLM Gateway

```
Internal Callers (all via mTLS)
╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗
║ VK Agent      ║  ║ TS Agent      ║  ║ CE Engine     ║  ║ Analysis Agent║
╚═══════╤═══════╝  ╚═══════╤═══════╝  ╚═══════╤═══════╝  ╚═══════╤═══════╝
        └──────────────────┴──────────────────┴──────────────────┘
                                    │ [LLMCompletionRequest] mTLS
                                    ▼
                     ╔══════════════════════════════════════════╗
                     ║  LLM Gateway                            ║
                     ║                                         ║
                     ║  Step 1: Budget Check                   ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                     ║  (Redis: tenant:X:llm_tokens:date)      ║    │  DS-3 Redis           │
                     ║  → 429 if over budget                   ║◀── │  (token counters)     │
                     ║                                         ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║  Step 2: Guardrails (OPA policy)        ║
                     ║  Input scan: injection patterns, PII    ║
                     ║  → 400 if blocked                       ║
                     ║                                         ║
                     ║  Step 3: Semantic Cache Lookup          ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                     ║  (if cacheable=true)                    ║    │  DS-2 pgvector        │
                     ║  Embed query → ANN search cos-sim≥0.97  ║◀── │  (llm_cache)          │
                     ║  Cache HIT → return cached response     ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║                                         ║
                     ║  Step 4: Model-Tier Routing             ║
                     ║  task_type → model tier                 ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                     ║  Lookup tenant provider config          ║    │  DS-6 Vault           │
                     ║                                         ║◀── │  (LLM API keys)       │
                     ║  Step 5: Provider Dispatch              ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║  (primary → fallback chain)             ║
                     ╚══════════════════════╤═══════════════════╝
                                            │                    ══ TB-05: TLS 1.3 ══
                    ┌───────────────────────┼───────────────────────────────────────┐
                    ▼                       ▼                                       ▼
         ┌──────────────────┐   ┌──────────────────┐                   ┌───────────────────┐
         │  OpenAI /        │   │  Anthropic       │                   │  On-prem LLM      │
         │  Azure OpenAI    │   │  Claude          │                   │  (Ollama/vLLM)    │
         └────────┬─────────┘   └────────┬─────────┘                   └─────────┬─────────┘
                  └───────────────────────┴──────────────────────────────────────┘
                                            │ [completion / stream]
                                            ▼
                     ╔══════════════════════════════════════════╗
                     ║  Post-Processing                        ║
                     ║  - PII redaction (regex + NER)         ║
                     ║  - Log write (prompt + completion)      ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                     ║  - Cache write (if cacheable)           ║    │  DS-1 audit_logs +    │
                     ║  - Token metering → Kafka               ║    │  DS-2 llm_cache       │
                     ║  - Streaming: SSE chunks to caller      ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ╚══════════════════════╤═══════════════════╝
                                            │ [token usage event]
                                            ▼
                                   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                                   │  DS-4 Kafka           │
                                   │  billing.usage topic  │
                                   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 7. L2 — Integration Agent & Webhook Ingest

### 7.1 Inbound Webhook Flow

```
┌────────────────────┐
│  External IT       │
│  System            │
│  (ServiceNow etc.) │
└─────────┬──────────┘
          │ HTTPS POST /api/v1/webhooks/{tenantSlug}/{token}
          │ Headers: X-Hub-Signature-256, X-Timestamp
          ▼  TB-08
╔═══════════════════════════════════════════════════════════════╗
║  API Gateway — Inbound Webhook Endpoint                      ║
║                                                             ║
║  1. Timestamp check: |now() - X-Timestamp| ≤ 5 min         ║──▶ REJECT (401) if stale
║  2. HMAC-SHA256 verify: compute HMAC(body, secret_from_Vault)║──▶ REJECT (401) if mismatch
║  3. IP allowlist check (if configured, FR-INT-010)          ║──▶ REJECT (403) if blocked
║  4. Route to Integration Agent (Kafka)                      ║
╚═══════════════════════════╤═══════════════════════════════════╝
                            │ [validated webhook body + metadata]
                            ▼ Kafka: agent.int.requests
╔═══════════════════════════════════════════════════════════════╗
║  Integration Agent — Webhook Processor                       ║
║                                                             ║
║  1. Identify adapter by integration_id                      ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
║  2. Parse body via adapter.parseWebhook()                   ║    │  DS-6 Vault (HMAC secret)   │
║  3. Fingerprint: SHA-256(sourceSystem+externalId+timestamp) ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
║  4. Idempotency: check integration_events table             ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
║  5. Map to normalised IIVKIS event schema                   ║    │  DS-1 PostgreSQL            │
║  6. Publish to target Kafka topic                           ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
╚═══════════════════════════╤═══════════════════════════════════╝
                            │ [normalised event]
               ┌────────────┼────────────────────┐
               ▼            ▼                    ▼
  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ce.signals         incident.events
  │ DS-4 Kafka         │  (→ Correlation Engine) (→ Incident Mgmt)
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 7.2 Outbound Sync Flow

```
╔═════════════════════════════════════════════════════╗
║  Integration Agent — Outbound Sync Scheduler       ║
║  - Poll interval per integration (min 15 min)      ║
║  - Triggered by: schedule | on-demand | event      ║
╚══════════════════════╤══════════════════════════════╝
                       │ [sync trigger]
                       ▼
╔═════════════════════════════════════════════════════╗
║  Adapter: fetchInbound(config, lastSyncCursor)     ║
║  - Fetch credentials from Vault                   ║──▶ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
║  - HTTP call to external system API               ║    │  DS-6 Vault                 │
║  - Parse response, build InboundEvent[]           ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
║  - Exponential backoff on failure                 ║
║  - Circuit breaker per integration                ║
╚══════════════════════╤══════════════════════════════╝
                       │ [InboundEvent[]]
                       ▼
╔═════════════════════════════════════════════════════╗
║  Event Processor                                   ║
║  - Fingerprint + idempotency check                 ║
║  - Normalise + enrich with tenant context          ║
║  - Insert integration_events (DS-1)                ║
║  - Publish to Kafka (ce.signals or incident topic) ║
╚═════════════════════════════════════════════════════╝
```

---

## 8. L2 — Authentication & Session Flow

```
                    ┌──────────────────┐
                    │  Browser / Client │
                    └────────┬──────────┘
                             │
              ┌──────────────┴─────────────────┐
              │ Option A: Username+Password+MFA │
              │ Option B: OIDC/SAML SSO         │
              └──────────────┬─────────────────┘
                             │
 ─────────────────────── TB-01 ────────────────────────
                             │
       ╔═════════════════════▼═══════════════════════╗
       ║  API /api/v1/auth/login                     ║
       ║  - Verify credentials (DS-1: users)         ║
       ║  - MFA verification (TOTP / WebAuthn)       ║
       ║  - If SSO: validate OIDC/SAML token         ║──▶ IdP (TB-03)
       ║  - Create session record (DS-1: sessions)   ║
       ║  - Sign JWT (RS256 via Vault Transit Engine) ║──▶ ┌ ─ ─ DS-6 Vault ─ ─ ┐
       ║    Claims: {sub, tenant_id, roles, exp}     ║◀── │  (JWT signing key)   │
       ╚═══════════════════════════════════════════╤═╝    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                                                   │ [access_token (JWT) + refresh_token]
                                                   ▼
                                        ┌──────────────────┐
                                        │  Client stores   │
                                        │  tokens (memory  │
                                        │  / secure cookie)│
                                        └──────────────────┘

Subsequent Request Flow:
  Client ──Bearer {JWT}──▶ API
                              │
                              ├─ JWT verify (RS256, JWKS from Vault PKI — no Vault call per request)
                              ├─ Extract tenant_id from claim (NEVER from request params)
                              ├─ Inject into DB connection: SET app.current_tenant_id
                              ├─ OPA pre-auth: role ∈ allowed_roles for this endpoint?
                              └─ Proceed to handler

Refresh Flow:
  Client ──refresh_token──▶ /api/v1/auth/refresh
                                   │
                                   ├─ Validate refresh token (Redis: session store)
                                   ├─ Confirm session not revoked (DS-1: sessions.revoked_at IS NULL)
                                   └─ Issue new JWT (short-lived: 15 min access / 7 day refresh)

Session Revocation (FR-IAM-008):
  User/Admin ──DELETE /api/v1/auth/sessions/{id}──▶ API
                                                       │
                                                       ├─ Mark sessions.revoked_at = now()
                                                       └─ Delete from Redis session cache
```

---

## 9. L2 — Billing & Usage Metering

```
Event Sources (all services emit to Kafka billing.usage topic)
══════════════════════════════════════════════════════════════

╔═══════════╗  ╔═══════════╗  ╔═══════════╗  ╔═══════════╗
║ API       ║  ║ LLM GW    ║  ║ VK Agent  ║  ║ Storage   ║
║ [api_call]║  ║[llm_token]║  ║[embedding]║  ║[storage_gb║
╚═════╤═════╝  ╚═════╤═════╝  ╚═════╤═════╝  ╚═════╤═════╝
      └───────────────┴──────────────┴──────────────┘
                                │ [UsageEvent{tenant_id, metric_type, value, period, source_ref}]
                    ┌ ─ ─ ─ ─ ─▼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                    │  DS-4 Kafka: billing.usage       │
                    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▲─ ─ ─ ─ ─ ┘
                                          │ [consume]
                                          ▼
                     ╔══════════════════════════════════════╗
                     ║  Billing Engine Consumer            ║
                     ║                                     ║
                     ║  1. Aggregate in Redis sliding window║──▶ ┌ ─ DS-3 Redis ─ ─ ┐
                     ║     tenant:{id}:usage:{metric}      ║◀── │ (real-time agg)   │
                     ║                                     ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║  2. Persist to usage_ledger (append)║──▶ ┌ ─ DS-1 PG ─ ─ ─ ─ ┐
                     ║     (tamper-evident: INSERT ONLY)   ║    │ (usage_ledger)     │
                     ║                                     ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║  3. LLM budget enforcement check    ║
                     ║     If usage ≥ budget → publish     ║──▶ ┌ ─ DS-4 Kafka ─ ─ ─ ┐
                     ║     notification event              ║    │ billing.alerts      │
                     ║                                     ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                     ║  4. Billing period close            ║
                     ║     Aggregate → Invoice             ║──▶ ┌──────────────────┐
                     ║     Push to payment processor       ║    │ Payment Processor│
                     ╚══════════════════════════════════════╝    └──────────────────┘
```

---

## 10. L2 — Notification Flow

```
Event Sources (internal Kafka topics)
══════════════════════════════════════

Kafka topics:
  notification.events  ◀── CE (new correlation group)
                        ◀── Incident mgmt (SLA breach, new assignment)
                        ◀── Billing (budget threshold, invoice)
                        ◀── Security (auth anomaly)

                 ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                 │  DS-4 Kafka: notification.events                                 │
                 └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▲─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                                                        │
                                                        ▼
                                         ╔══════════════════════════════╗
                                         ║  Notification Service       ║
                                         ║                             ║
                                         ║  1. Load tenant policy      ║──▶ DS-1 (notification_policies)
                                         ║     for event_type          ║
                                         ║                             ║
                                         ║  2. Recipient validation    ║
                                         ║     - Verify recipients in  ║
                                         ║       tenant user table     ║
                                         ║     - Anti-misdirection     ║
                                         ║                             ║
                                         ║  3. Fan out to channels     ║
                                         ╚═════════════╤═══════════════╝
                                                        │
                    ┌─────────────────┬─────────────────┼───────────────────┬─────────────────┐
                    ▼                 ▼                 ▼                   ▼                 ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   ┌─────────────────┐ ┌──────────────┐
           │  Email       │ │  Slack       │ │  MS Teams    │   │  PagerDuty /    │ │  Generic     │
           │  (SES/SMTP)  │ │  webhook     │ │  webhook     │   │  OpsGenie API   │ │  webhook     │
           └──────────────┘ └──────────────┘ └──────────────┘   └─────────────────┘ └──────────────┘
                                                        │
                                         ╔══════════════▼═══════════════╗
                                         ║  Delivery Receipt Log       ║──▶ DS-1 audit_logs
                                         ╚══════════════════════════════╝
```

---

## 11. L2 — Analysis Agent

The Analysis Agent produces dashboards, trend reports, anomaly detection runs, LLM
narrative summaries, and SLA compliance metrics. It is triggered by the Orchestrator
via Kafka and reads from PostgreSQL, Redis, and the billing ledger.

### 11.1 Report Generation Flow

```
╔════════════════════════════════════════════════════════════════════╗
║  Orchestrator                                                     ║
╚══════════════════════════╤═════════════════════════════════════════╝
                           │ Kafka: agent.anlys.requests
                           │ taskType = 'anlys.report' | 'anlys.anomaly'
                           ▼
╔════════════════════════════════════════════════════════════════════╗
║  Analysis Agent Consumer (KEDA auto-scaled on Kafka lag)          ║
║                                                                   ║
║  1. Validate tenant_id header against JWT (re-verify at boundary) ║
║  2. Dispatch to sub-handler based on taskType                     ║
╚══════════════════════════╤═════════════════════════════════════════╝
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
  [Report Handler]  [Anomaly Handler]  [Forecast Handler]
```

### 11.2 Report Handler Data Flow

```
╔════════════════════════════════════════════════════════╗
║  Report Handler                                       ║
╚══════════════════════╤═════════════════════════════════╝
                       │
       ┌───────────────┼─────────────────────────────┐
       │               │                             │
       ▼               ▼                             ▼
┌ ─ DS-1 PG ─ ─ ─ ┐  ┌ ─ DS-1 PG ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ┌ ─ DS-3 Redis ─ ─ ┐
│ incidents table  │  │ usage_ledger (billing metrics)   │  │ real-time agg     │
│ correlation_     │  │ correlation_groups (accuracy)    │  │ counters          │
│  groups table    │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
│ sla_policies     │
└ ─ ─ ─ ─ ─ ─ ─ ─ ┘
       │               │                             │
       └───────────────┴─────────────────────────────┘
                               │ [aggregated metrics]
                               ▼
╔════════════════════════════════════════════════════════╗
║  Metrics Aggregator                                   ║
║  - Incident volume trend (daily/weekly/monthly)       ║
║  - MTTR per severity, per product                     ║
║  - Top affected products / vendors                    ║
║  - SLA compliance rate per policy                     ║
║  - LLM usage & cost attribution                       ║
║  - Correlation accuracy (confirmed vs total groups)   ║
╚══════════════════════╤═════════════════════════════════╝
                       │ [report payload]
                       ▼
╔════════════════════════════════════════════════════════╗
║  Optional: LLM Gateway (narrative summary)            ║──▶ ┌ DS-9 LLM Providers ┐
║  taskType = 'llm.complete', cacheable = true          ║◀── └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
╚══════════════════════╤═════════════════════════════════╝
                       │ [narrative text + structured report]
                       ▼
╔════════════════════════════════════════════════════════╗
║  Result Publisher                                     ║
║  - Publish to Kafka reply topic (correlated by taskId)║──▶ ┌ ─ ─ DS-4 Kafka ─ ─ ─ ┐
║  - Persist report snapshot to S3 (time-series archive)║──▶ ┌ ─ ─ DS-5 S3 ─ ─ ─ ─ ┐
║  - Emit OTel trace + report metrics                   ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
╚════════════════════════════════════════════════════════╝    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 11.3 Anomaly Detection Flow

```
╔════════════════════════════════════════════════════════╗
║  Anomaly Handler (taskType = 'anlys.anomaly')         ║
╚══════════════════════╤═════════════════════════════════╝
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌ ─ DS-1 PG ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ┌ ─ DS-3 Redis ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│ signals (last 30 days)        │  │ signal hot-store (last 1 h)        │
│ incidents (last 30 days)      │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
       │                               │
       └───────────────┬───────────────┘
                       │ [time series: signal counts, MTTR, volume by CI]
                       ▼
╔════════════════════════════════════════════════════════╗
║  Statistical Anomaly Detector                         ║
║  - Holt-Winters (triple exponential smoothing)        ║
║  - Z-score on 7-day rolling baseline                  ║
║  - Output: anomaly candidates [{ci, metric, score}]   ║
╚══════════════════════╤═════════════════════════════════╝
                       │ [anomaly candidates (if any)]
                       ▼
╔════════════════════════════════════════════════════════╗
║  LLM Gateway — Narrative Generation (optional)        ║──▶ LLM Provider (TB-05)
║  "Unusual spike in P1 incidents on product X vs       ║
║   30-day baseline — possible upstream dependency"     ║
╚══════════════════════╤═════════════════════════════════╝
                       │ [anomaly report + narrative]
               ┌───────┴────────┐
               ▼                ▼
        Kafka reply topic    Kafka: notification.events (if severity = HIGH)
        (result to API)      → Notification Service → ops-engineer channels
```

### 11.4 Analysis Agent Kafka Topics

| Topic | Direction | Consumers | Description |
|---|---|---|---|
| `agent.anlys.requests` | Inbound | Analysis Agent | Report / anomaly task dispatch from Orchestrator |
| `agent.anlys.replies` | Outbound | Orchestrator | Task results (correlated by taskId) |
| `notification.events` | Outbound | Notification Service | High-severity anomaly alerts |

---

## 12. Multi-Tenant Data Boundary Map

This table maps each data store to the mechanism that prevents cross-tenant data leakage.

| Data Store | Boundary Mechanism | Enforcement Point | Threat Mitigated |
|---|---|---|---|
| PostgreSQL (all tables) | Row-Level Security: `tenant_id = current_setting(...)` | PostgreSQL kernel | TH-I-001 |
| pgvector (knowledge_embeddings) | WHERE clause `tenant_id = $1 OR tenant_id IS NULL` | VK Agent + OPA sidecar | TH-I-004 |
| pgvector (llm_cache) | Filtered HNSW index per tenant_id | LLM Gateway | TH-I-004 |
| Redis | Keyspace prefix: `tenant:{uuid}:*` | Application-layer key construction | TH-I-001 |
| Kafka topics | Per-tenant topics (T3) OR `tenant_id` header + consumer filter (T1/T2) | Kafka ACL + consumer code | TH-I-001 |
| S3 / MinIO | Per-tenant key prefix: `{tenant_id}/…` + bucket policy | IAM policy / MinIO policy | TH-I-001 |
| Vault | Per-tenant path: `secret/tenants/{tenant_id}/…` | Vault policy (per-token) | TH-I-005, TH-E-005 |
| Knowledge Graph (kg_nodes/kg_edges) | RLS: `tenant_id = current_setting(...)` OR tenant_id IS NULL | PostgreSQL kernel | TH-I-001 |

**Cross-tenant query prevention — defence in depth:**

```
Request ──▶ JWT verify (tenant_id extracted)
         ──▶ OPA sidecar (tenant_id in request ≠ JWT claim → DENY)
         ──▶ DB connection (SET app.current_tenant_id from JWT)
         ──▶ RLS policy (PostgreSQL enforces independently of application code)
         ──▶ VK Agent / LLM Gateway (code-level namespace filter)
```

Four independent layers must all be bypassed simultaneously for a cross-tenant leak.

---

## 13. Cross-Subsystem Sequence Diagrams

### 13.1 Incident Resolution Plan Generation

```
IT Ops Engineer          Portal          API           Orchestrator     TS Agent      VK Agent      LLM Gateway
       │                   │              │                  │               │              │               │
       │── Open incident ──▶│              │                  │               │              │               │
       │                   │── POST /chat ▶│                  │               │              │               │
       │                   │              │── POST /internal ▶│               │              │               │
       │                   │              │  /tasks {ts.plan} │               │              │               │
       │                   │              │                   │── Kafka pub ──▶│               │               │
       │                   │              │                   │  agent.ts.req  │               │              │
       │                   │              │                   │               │── Kafka pub ──▶│               │
       │                   │              │                   │               │  agent.vk.req  │               │
       │                   │              │                   │               │               │── pgvector ANN │
       │                   │              │                   │               │               │── KG traversal │
       │                   │              │                   │               │               │── rerank       │
       │                   │              │                   │               │◀── context ───│               │
       │                   │              │                   │               │ (chunks+cites) │               │
       │                   │              │                   │               │── LLM complete ──────────────▶│
       │                   │              │                   │               │                               │── provider
       │                   │              │                   │               │                               │◀─ stream
       │                   │              │                   │               │◀── SSE stream ────────────────│
       │◀─── SSE stream ───│◀── SSE ──────│◀── SSE ───────────│◀── SSE stream─│               │               │
       │  (progressive render)            │                   │               │               │               │
       │                   │              │                   │               │               │               │
       │                   │              │                   │               │── Audit log ──▶DS-1           │
       │                   │              │                   │               │               │               │
```

### 13.2 Signal Ingest → Correlation Group → Notification

```
External System   Integration Agent   Signal Ingestor   CE Processors   Group Builder   Notification Svc
       │                 │                  │                  │               │                │
       │── webhook POST ▶│                  │                  │               │                │
       │                 │─HMAC verify─     │                  │               │                │
       │                 │─timestamp chk─   │                  │               │                │
       │                 │── Kafka pub ─────▶│                  │               │                │
       │                 │  ce.signals       │                  │               │                │
       │                 │                  │─ fingerprint ─    │               │                │
       │                 │                  │─ idempotency ─    │               │                │
       │                 │                  │─ enrich CI ──     │               │                │
       │                 │                  │── Kafka pub ──────▶│               │                │
       │                 │                  │  ce.signals.enriched│               │                │
       │                 │                  │               ┌───┴───┐           │                │
       │                 │                  │         temporal topological       │                │
       │                 │                  │         semantic  rule  ML         │                │
       │                 │                  │               └───┬───┘           │                │
       │                 │                  │                   │─ votes + scores▶               │
       │                 │                  │                   │               │─ GROUP created  │
       │                 │                  │                   │               │─ LLM narrative  │
       │                 │                  │                   │               │─ INSERT DS-1 ── │
       │                 │                  │                   │               │── Kafka pub ────▶│
       │                 │                  │                   │               │  notification.evt│
       │                 │                  │                   │               │                │─ policy check
       │                 │                  │                   │               │                │─ send to channels
       │                 │                  │                   │               │                │─ delivery log
```

### 13.3 Semantic Knowledge Search (RAG)

```
IT Ops Engineer   Portal           API          VK Agent         pgvector (DS-2)   LLM Gateway
       │            │               │               │                   │               │
       │─ search ──▶│               │               │                   │               │
       │            │─POST /knowl.. ▶│               │                   │               │
       │            │  /search      │─── Kafka ─────▶│                   │               │
       │            │               │  vk.search     │                   │               │
       │            │               │               │─ embed query ───────────────────▶│
       │            │               │               │◀─ query_vec (1536d) ───────────────│
       │            │               │               │─ ANN search ──────▶│               │
       │            │               │               │  (ns: tenant_id)   │               │
       │            │               │               │◀─ top-50 chunks ───│               │
       │            │               │               │─ full-text search ─▶ DS-1 PG       │
       │            │               │               │─ KG traversal ────▶ DS-1 KG        │
       │            │               │               │─ RRF re-rank ──    │               │
       │            │               │               │─ context assemble  │               │
       │            │               │               │─ LLM complete ─────────────────────▶│
       │            │               │               │◀─ answer + citations────────────────│
       │            │               │◀─── response ─│                   │               │
       │◀─ results ─│               │               │                   │               │
       │  with citations            │               │                   │               │
```

---

*End of DFD document. See [HLD](hld.md) for architectural narrative and [LLD](lld.md) for detailed schemas and interface contracts.*
