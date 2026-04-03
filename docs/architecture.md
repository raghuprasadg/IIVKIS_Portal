# IIVKIS Architecture

## Overview

**IIVKIS** (Intelligent IT Vendor Knowledge Integration System) is an AI-driven
platform that simplifies IT troubleshooting and vendor data analysis. The system
is built as a **monorepo** using npm workspaces and TypeScript throughout.

---

## System Components

### 1. Portal (`apps/portal`)
The user-facing web application built with **Next.js** and **React**. IT
operations teams interact with the system through this interface to:
- Browse vendor knowledge
- Submit and track incident tickets
- View analytics dashboards
- Monitor integration status

### 2. API (`apps/api`)
A **Node.js/Express** REST API that:
- Serves the portal's data requests
- Forwards complex tasks to the Orchestrator
- Enforces authentication, tenant context propagation, and rate limiting

### 3. Engineering Orchestrator (`apps/orchestrator`)
The central coordination layer that:
- Receives task requests from the API
- Determines which agent(s) should handle each task
- Dispatches subtasks and aggregates responses
- Handles agent failures and retries

### 4. AI Agents (`packages/agents/*`)

| Agent | Package | Purpose |
|---|---|---|
| Vendor Knowledge | `@iivkis/agents-vendor-knowledge` | Queries vendor/product data, maintains knowledge graph |
| Troubleshooting | `@iivkis/agents-troubleshooting` | Analyses incidents, generates step-by-step resolution plans |
| Integration | `@iivkis/agents-integration` | Connects to external CMDB, ITSM, and monitoring systems |
| Analysis | `@iivkis/agents-analysis` | Runs trend analysis, surfaces insights, generates reports |

### 5. Shared Packages

| Package | Purpose |
|---|---|
| `@iivkis/shared` | TypeScript types and utilities shared across all packages |
| `@iivkis/ui` | Reusable React components used by the portal |

---

## Request Flow

```
User (Browser)
     │  HTTP
     ▼
@iivkis/portal  (Next.js)
     │  REST
     ▼
@iivkis/api  (Express)
     │  Internal call
     ▼
@iivkis/orchestrator
     ├─▶ @iivkis/agents-vendor-knowledge
     ├─▶ @iivkis/agents-troubleshooting
     ├─▶ @iivkis/agents-integration
     └─▶ @iivkis/agents-analysis
```

---

## Technology Choices

| Concern | Technology |
|---|---|
| Language | TypeScript 5 |
| Frontend | React 18, Next.js 15 |
| Backend | Node.js 18+, Express 4 |
| Monorepo | npm workspaces |
| Linting | ESLint 8 + `@typescript-eslint` |
| Formatting | Prettier 3 |
| Build | tsc (per package) |

---

## Architecture Documents (Phase 3)

Full architecture documentation produced in Phase 3 (all validated — see validation report):

| Document | Version | Description |
|---|---|---|
| [High-Level Design (HLD)](hld.md) | v1.0.1 | System decomposition, multi-tenant isolation tiers, SaaS + self-host deployment topologies, all subsystem overviews, ADRs |
| [Low-Level Design (LLD)](lld.md) | v1.0.1 | Database schemas (27 tables), REST API contracts, TypeScript interfaces, KG+RAG pipeline, CE state machines, LLM gateway internals |
| [Data Flow Diagrams (DFD)](dfd.md) | v1.0.1 | L0 context, L1 system decomposition, L2 per-subsystem DFDs (all 12 services), cross-subsystem sequence diagrams |
| [Architecture Validation Report](architecture-validation.md) | v1.0.0 | Phase 3 validation — 28 gaps closed, 10 SPOFs resolved, PASS verdict |

Key architectural decisions:
- **PostgreSQL + pgvector** for relational + vector storage (single operational unit, tenant-namespace isolation)
- **Apache Kafka** for durable async task dispatch (supports ≥ 1M signals/min aggregate)
- **Helm umbrella chart** for self-hosted on-premises Kubernetes deployment (supported from GA)
- **AWS primary / Azure secondary** cloud platform
- **KG+RAG hybrid retrieval**: pgvector ANN + PostgreSQL graph traversal + full-text search, RRF re-ranked
- **Three multi-tenant isolation tiers**: T1 (shared+RLS), T2 (shared+BYOK), T3 (dedicated cluster)

## Development Phases

| Phase | Description | Status |
|---|---|---|
| **STEP 0** | System initialisation — monorepo structure, base configs, agent stubs | ✅ Done |
| **STEP 1** | Requirements — functional, NFRs, multi-tenancy, LLM, billing, security, resiliency | ✅ Done |
| **STEP 2** | Threat Modeling — STRIDE analysis, RBAC/mTLS/Vault/WAF/OPA controls, risk register | ✅ Done |
| **STEP 3** | Architecture Design — HLD, LLD, DFD; multi-tenant isolation, KG+RAG, CE, SaaS+self-host | ✅ Done (Validated) |
| **STEP 4** | Vendor Knowledge Agent implementation | ✅ Implemented (partial runtime stubs remain for some retrieval backends) |
| **STEP 5** | Troubleshooting Agent implementation | ✅ Implemented |
| **STEP 6** | Integration Agent implementation | ✅ Implemented |
| **STEP 7** | Analysis Agent + Correlation Engine implementation | ✅ Implemented |
| **STEP 8** | Orchestrator routing logic + LLM Gateway | ✅ Implemented |
| **STEP 9** | Portal UI development | ✅ Implemented |
| **STEP 10** | Billing Engine implementation | ✅ Implemented |
| **STEP 11** | End-to-end integration + testing | ✅ Validation suites implemented |

## Implementation Refresh

For post-validation runtime changes and contract-alignment updates, see:

- [Implementation Refresh (2026-04-03)](implementation-refresh-2026-04-03.md)
