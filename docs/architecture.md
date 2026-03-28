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
- Manages authentication and authorisation (future step)

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

## Development Phases

| Phase | Description | Status |
|---|---|---|
| **STEP 0** | System initialisation — monorepo structure, base configs, agent stubs | ✅ Done |
| **STEP 1** | Requirements — functional, NFRs, multi-tenancy, LLM, billing, security, resiliency | ✅ Done |
| **STEP 2** | Threat Modeling — STRIDE analysis, RBAC/mTLS/Vault/WAF/OPA controls, risk register | ✅ Done |
| **STEP 3** | Vendor Knowledge Agent implementation | 🔜 Pending |
| **STEP 4** | Troubleshooting Agent implementation | 🔜 Pending |
| **STEP 5** | Integration Agent implementation | 🔜 Pending |
| **STEP 6** | Analysis Agent + Correlation Engine implementation | 🔜 Pending |
| **STEP 7** | Orchestrator routing logic + LLM Gateway | 🔜 Pending |
| **STEP 8** | Portal UI development | 🔜 Pending |
| **STEP 9** | Billing Engine implementation | 🔜 Pending |
| **STEP 10** | End-to-end integration + testing | 🔜 Pending |
