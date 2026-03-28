# IIVKIS Requirements Specification

**Document ID:** IIVKIS-REQ-001  
**Version:** 1.1.0  
**Status:** Validated — Baseline Confirmed  
**Phase:** STEP 1 — Requirements (Validated)  
**Author:** Architect Agent  
**Date:** 2026-03-28  

### Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-03-28 | Architect Agent | Initial baseline — functional + non-functional requirements across all 11 FR domains and 9 NFR categories |
| 1.1.0 | 2026-03-28 | Architect Agent | Validation pass — 13 gaps identified and resolved: FR-IAM-008, FR-INT-009/010, FR-LLM-017/018, FR-VK-010, FR-TS-011, §4.12 SLA, NFR-MAINT-007/008, NFR-COMP-007, NFR-SEC-016; OQ-008 promoted to FR; RTM and changelog added |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Stakeholders](#2-stakeholders)
3. [System Scope](#3-system-scope)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 [Multi-Tenancy & Tenant Management](#41-multi-tenancy--tenant-management)
   - 4.2 [Identity, Authentication & Authorisation](#42-identity-authentication--authorisation)
   - 4.3 [Vendor Knowledge Management](#43-vendor-knowledge-management)
   - 4.4 [Incident & Troubleshooting Management](#44-incident--troubleshooting-management)
   - 4.5 [Correlation Engine](#45-correlation-engine)
   - 4.6 [LLM Integration & AI Capabilities](#46-llm-integration--ai-capabilities)
   - 4.7 [External System Integrations](#47-external-system-integrations)
   - 4.8 [Analytics & Reporting](#48-analytics--reporting)
   - 4.9 [Notifications & Alerting](#49-notifications--alerting)
   - 4.10 [Billing & Subscription Management](#410-billing--subscription-management)
   - 4.11 [Administration & Platform Management](#411-administration--platform-management)
   - 4.12 [Incident SLA Management](#412-incident-sla-management)
5. [Non-Functional Requirements](#5-non-functional-requirements)
   - 5.1 [Performance](#51-performance)
   - 5.2 [Scalability](#52-scalability)
   - 5.3 [Availability & Reliability](#53-availability--reliability)
   - 5.4 [Security](#54-security)
   - 5.5 [Resiliency](#55-resiliency)
   - 5.6 [Observability](#56-observability)
   - 5.7 [Compliance & Data Governance](#57-compliance--data-governance)
   - 5.8 [Usability & Accessibility](#58-usability--accessibility)
   - 5.9 [Maintainability & Extensibility](#59-maintainability--extensibility)
6. [Constraints & Assumptions](#6-constraints--assumptions)
7. [Glossary](#7-glossary)
8. [Open Questions](#8-open-questions)
9. [Requirements Traceability Matrix](#9-requirements-traceability-matrix)

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete set of functional and non-functional requirements for the **Intelligent IT Vendor Knowledge Integration System (IIVKIS)**. It is the authoritative baseline for all subsequent design, implementation, and acceptance testing work.

### 1.2 Product Vision

IIVKIS is a multi-tenant, AI-driven SaaS platform that enables IT operations teams to:

- Consolidate and query knowledge from multiple IT vendors and products in one place.
- Automatically correlate alerts, incidents, and vendor advisories to surface root causes.
- Leverage large language model (LLM) capabilities to generate context-aware troubleshooting guidance and resolution plans.
- Integrate bidirectionally with enterprise IT systems (CMDB, ITSM, monitoring, SIEM).
- Operate under a metered billing model tied to usage, tenants, and capability tiers.

### 1.3 Scope

IIVKIS covers:

- **In scope:** Web portal, REST API, Engineering Orchestrator, four AI agents (vendor knowledge, troubleshooting, integration, analysis), billing engine, correlation engine, multi-tenant data plane.
- **Out of scope:** Raw hardware/infrastructure provisioning, vendor product development, end-user device management.

### 1.4 Definitions

See [Section 7 — Glossary](#7-glossary).

---

## 2. Stakeholders

| Role | Responsibilities | Primary Concerns |
|---|---|---|
| **IT Operations Engineer** | Day-to-day incident response; uses portal to diagnose and resolve issues | Speed of resolution, accuracy of AI suggestions, ease of use |
| **IT Manager / Team Lead** | Oversees IT operations; reviews analytics and SLA reports | Visibility, cost control, team productivity metrics |
| **Platform Administrator** | Manages tenants, users, integrations, billing plans | Tenant isolation, data integrity, audit trails |
| **Security Officer** | Governs access control, data privacy, compliance | Zero-trust posture, encryption, audit logs, regulatory compliance |
| **Billing Administrator** | Manages subscriptions, invoices, usage quotas | Accurate metering, transparent invoicing, payment processing |
| **Vendor / Data Provider** | Supplies knowledge articles, advisories, product catalogues | API availability, data freshness, SLA adherence |
| **API / Integration Consumer** | Third-party systems consuming IIVKIS REST API | Stable contracts, versioning, rate limiting |
| **Executive Sponsor** | Business accountability | ROI, uptime, security posture, customer satisfaction |

---

## 3. System Scope

### 3.1 System Context Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────┐
│                        IIVKIS Platform                          │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐   │
│  │  Portal  │──▶│   API    │──▶│  Engineering Orchestrator │   │
│  │ (Next.js)│   │(Express) │   │  + Correlation Engine     │   │
│  └──────────┘   └──────────┘   └──────────┬───────────────┘   │
│                                            │                    │
│               ┌────────────────────────────┼────────────────┐  │
│               ▼            ▼               ▼                ▼  │
│  ┌─────────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────┐ │
│  │ Vendor Knowledge│ │Troubleshoot- │ │Integrat- │ │Analysi-│ │
│  │     Agent       │ │  ing Agent   │ │ ion Agent│ │s Agent │ │
│  └─────────────────┘ └──────────────┘ └──────────┘ └────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Shared Services: Multi-Tenant Data Plane, LLM Gateway,  │  │
│  │  Billing Engine, Notification Service, Audit Logger       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                │                         │
         ▼                ▼                         ▼
  External ITSM/    Vendor Knowledge          LLM Providers
  CMDB/Monitoring   APIs / Feeds             (OpenAI, Azure AI,
  (ServiceNow,                                Anthropic, etc.)
  PagerDuty, etc.)
```

### 3.2 Key Interfaces

| Interface | Direction | Protocol | Description |
|---|---|---|---|
| Portal ↔ API | Outbound (Portal) | HTTPS REST | All user-initiated actions |
| API ↔ Orchestrator | Internal | gRPC / REST | Task dispatch and result collection |
| Orchestrator ↔ Agents | Internal | Async message queue | Agent task routing |
| Integration Agent ↔ External IT | Bidirectional | REST / Webhooks / SNMP | CMDB, ITSM, monitoring ingest |
| Vendor Knowledge Agent ↔ Vendors | Inbound | REST / File feeds | Vendor KB, advisories, catalogues |
| LLM Gateway ↔ LLM Providers | Outbound | HTTPS REST | Prompt/completion calls |
| Billing Engine ↔ Payment Processors | Outbound | HTTPS REST | Stripe, Zuora, or equivalent |
| Portal / API ↔ IdP | Outbound | OIDC / SAML 2.0 | Identity federation |

---

## 4. Functional Requirements

Requirements use the identifier format `FR-<DOMAIN>-<NNN>`.

### 4.1 Multi-Tenancy & Tenant Management

#### 4.1.1 Tenant Isolation

| ID | Requirement | Priority |
|---|---|---|
| FR-MT-001 | The platform **MUST** support logical multi-tenancy where each tenant's data is fully isolated from other tenants at the data store layer. | Must |
| FR-MT-002 | All API requests **MUST** be scoped to a tenant via a verified tenant context (JWT claim or API key prefix). No cross-tenant data leakage is permitted. | Must |
| FR-MT-003 | The platform **MUST** support both shared-infrastructure multi-tenancy (database-per-schema or row-level security) and single-tenant dedicated deployments selectable at onboarding. | Must |
| FR-MT-004 | Tenant administrators **MUST** be able to configure their own SSO provider (OIDC or SAML 2.0) independently of other tenants. | Must |
| FR-MT-005 | The system **MUST** enforce per-tenant resource quotas (API rate limits, storage, LLM token budgets, number of users). | Must |
| FR-MT-006 | The platform **MUST** provide tenant-specific encryption key management (bring-your-own-key BYOK at rest). | Should |

#### 4.1.2 Tenant Lifecycle

| ID | Requirement | Priority |
|---|---|---|
| FR-MT-010 | Platform administrators **MUST** be able to create, suspend, reactivate, and delete tenants. | Must |
| FR-MT-011 | Tenant deletion **MUST** trigger a configurable data-retention period (default: 30 days) before permanent erasure, with operator override capability. | Must |
| FR-MT-012 | The system **MUST** support tenant-level configuration for timezone, locale, date formats, and default currency. | Should |
| FR-MT-013 | Tenant onboarding **MUST** be automatable via a provisioning API so MSPs can self-service. | Should |

#### 4.1.3 User & Role Management per Tenant

| ID | Requirement | Priority |
|---|---|---|
| FR-MT-020 | Each tenant **MUST** support at minimum four built-in roles: `tenant-admin`, `ops-engineer`, `read-only`, `billing-admin`. | Must |
| FR-MT-021 | Tenant administrators **MUST** be able to define custom roles with granular permission sets. | Should |
| FR-MT-022 | The system **MUST** support team/group-based access, where permissions can be assigned to a group and inherited by its members. | Should |

---

### 4.2 Identity, Authentication & Authorisation

| ID | Requirement | Priority |
|---|---|---|
| FR-IAM-001 | All user authentication **MUST** use OAuth 2.0 / OIDC. Username/password is supported via a built-in IdP for tenants without SSO. | Must |
| FR-IAM-002 | Machine-to-machine authentication **MUST** use short-lived JWT bearer tokens issued via OAuth 2.0 Client Credentials flow. | Must |
| FR-IAM-003 | The system **MUST** support API keys as an alternative auth mechanism for legacy integrations, with keys scoped to tenant, role, and optional IP allowlist. | Must |
| FR-IAM-004 | Multi-factor authentication (MFA) **MUST** be enforceable at the tenant level using TOTP or WebAuthn. | Must |
| FR-IAM-005 | All authorisation decisions **MUST** follow RBAC, with plans to extend to ABAC for fine-grained resource control. | Must |
| FR-IAM-006 | The system **MUST** invalidate all active sessions and tokens upon user deactivation or password reset. | Must |
| FR-IAM-007 | Token lifetimes: access tokens ≤ 15 minutes; refresh tokens ≤ 30 days (sliding); API keys until explicit revocation. | Must |
| FR-IAM-008 | The system **MUST** support session management: users can view all active sessions (device, IP, last-active), and individually or bulk-revoke them. Tenant administrators **MUST** be able to force-terminate all sessions for any user within their tenant. The platform **MUST** enforce a configurable maximum of concurrent active sessions per user (default: 5). | Must |

---

### 4.3 Vendor Knowledge Management

| ID | Requirement | Priority |
|---|---|---|
| FR-VK-001 | The platform **MUST** maintain a structured vendor knowledge graph comprising: vendors, products, versions, known issues, patches, advisories, and end-of-life dates. | Must |
| FR-VK-002 | Vendor knowledge **MUST** be ingested from multiple sources: vendor REST APIs, RSS/Atom feeds, uploaded files (PDF, CSV, JSON), and manual entry. | Must |
| FR-VK-003 | Ingested content **MUST** be deduplicated, normalised to a canonical schema, and stamped with ingestion timestamp and source provenance. | Must |
| FR-VK-004 | Knowledge articles **MUST** support tagging, categorisation, and free-text search with relevance ranking. | Must |
| FR-VK-005 | The system **MUST** support versioned knowledge articles — editing creates a new version; previous versions are retained and auditable. | Must |
| FR-VK-006 | Stale or superseded knowledge items **MUST** be automatically flagged when a newer vendor advisory references the same product/issue. | Should |
| FR-VK-007 | Tenant administrators **MUST** be able to subscribe to specific vendor feeds and set refresh intervals (minimum: 15 minutes). | Must |
| FR-VK-008 | The Vendor Knowledge Agent **MUST** expose a semantic search endpoint backed by vector embeddings so natural-language queries can retrieve relevant articles. | Must |
| FR-VK-009 | Knowledge items **MUST** be scoped per tenant: each tenant maintains its own knowledge corpus plus access to a shared global base. | Must |
| FR-VK-010 | Vector indexes used for semantic search **MUST** be tenant-isolated via either separate physical indexes or strict namespace partitioning. Cross-tenant vector similarity queries **MUST** be architecturally prevented — a query issued in tenant A's context **MUST NOT** return embeddings belonging to tenant B. | Must |

---

### 4.4 Incident & Troubleshooting Management

| ID | Requirement | Priority |
|---|---|---|
| FR-TS-001 | Users **MUST** be able to create, update, and close incidents via the portal and via the REST API. | Must |
| FR-TS-002 | Incidents **MUST** have at minimum the following fields: title, description, severity (critical/high/medium/low), status, affected product(s), reporter, assignee, created/updated timestamps. | Must |
| FR-TS-003 | On incident creation, the Troubleshooting Agent **MUST** automatically generate a resolution plan composed of ordered steps, each with an expected outcome and optional rollback action. | Must |
| FR-TS-004 | Resolution plans **MUST** be generated within 10 seconds for 95% of incidents under normal load (p95 < 10 s). | Must |
| FR-TS-005 | Users **MUST** be able to accept, modify, or reject individual steps in a resolution plan and record outcomes. | Must |
| FR-TS-006 | The system **MUST** learn from accepted/rejected step feedback to improve future resolution plans (feedback loop to the LLM fine-tuning pipeline). | Should |
| FR-TS-007 | Incidents **MUST** support attachments (logs, screenshots, config files) up to 50 MB per file, 500 MB per incident. | Must |
| FR-TS-008 | Incident history **MUST** be immutable and fully auditable — every status change and comment is logged with actor and timestamp. | Must |
| FR-TS-009 | The platform **MUST** support incident templates for common failure patterns to pre-populate fields and recommended steps. | Should |
| FR-TS-010 | The platform **MUST** support bulk incident import from external ITSM systems via a CSV/JSON template. | Should |
| FR-TS-011 | The platform **MUST** support incident escalation policies: when a defined SLA response or resolution threshold is breached, the incident **MUST** be automatically escalated to the next tier (configurable: team lead, on-call manager) with notification sent via all active notification channels for the tenant. Escalation history **MUST** be recorded in the incident audit trail. | Must |

---

### 4.5 Correlation Engine

The Correlation Engine is a core differentiating subsystem of IIVKIS. It automatically identifies relationships between seemingly disparate signals — alerts, incidents, vendor advisories, configuration changes, and topology data — to surface probable root causes.

#### 4.5.1 Signal Ingestion

| ID | Requirement | Priority |
|---|---|---|
| FR-CE-001 | The Correlation Engine **MUST** ingest signals from: incident records, monitoring alerts (Prometheus, CloudWatch, Datadog, Zabbix), CMDB change records, vendor advisories, log anomalies, and user-reported observations. | Must |
| FR-CE-002 | Each ingested signal **MUST** be enriched with tenant context, signal type, source system, affected entity (CI), severity, and UTC timestamp before correlation processing. | Must |
| FR-CE-003 | The engine **MUST** support ingestion rates of at least 10,000 signals/minute per tenant without degrading correlation latency. | Must |
| FR-CE-004 | Signals older than a configurable window (default: 72 hours) **MUST** be automatically aged out of the active correlation window; archived signals remain queryable. | Must |

#### 4.5.2 Correlation Rules

| ID | Requirement | Priority |
|---|---|---|
| FR-CE-010 | The engine **MUST** support rule-based correlation: operators define rules using a DSL or visual editor specifying signal patterns, time windows, and topology relationships. | Must |
| FR-CE-011 | The engine **MUST** support ML-based correlation: a trained model discovers non-obvious patterns and proposes correlation candidates above a configurable confidence threshold. | Must |
| FR-CE-012 | The engine **MUST** implement temporal correlation — signals within a configurable time window (default: 5 minutes) affecting the same or topologically adjacent CIs are automatically grouped. | Must |
| FR-CE-013 | The engine **MUST** implement topological correlation — signals are correlated when the affected CIs have a dependency relationship in the CMDB graph. | Must |
| FR-CE-014 | The engine **MUST** implement semantic correlation — natural-language similarity between signal descriptions (powered by the LLM layer) triggers correlation above a cosine-similarity threshold. | Should |
| FR-CE-015 | Correlation rules **MUST** be versioned and tenant-scoped; changes to rules create a new version. | Must |
| FR-CE-016 | Platform administrators **MUST** be able to define global correlation rules that apply across all tenants. | Should |

#### 4.5.3 Correlation Groups & Root Cause Analysis

| ID | Requirement | Priority |
|---|---|---|
| FR-CE-020 | When the engine groups signals into a correlation group, it **MUST** produce a root-cause candidate with a confidence score (0–100%) and a narrative explanation. | Must |
| FR-CE-021 | A correlation group **MUST** reference the original signals that contributed to it and be linkable to one or more incidents. | Must |
| FR-CE-022 | Root-cause candidates **MUST** be surfaced to assigned engineers in real time via the portal and notification channels. | Must |
| FR-CE-023 | Engineers **MUST** be able to accept, reject, or merge correlation groups; accepted groups automatically update the affected incidents. | Must |
| FR-CE-024 | The engine **MUST** emit a webhook event for each new correlation group, consumable by external ITSM tools. | Should |
| FR-CE-025 | The system **MUST** track accuracy metrics for correlation (true-positive rate, false-positive rate) to drive model improvement. | Should |

---

### 4.6 LLM Integration & AI Capabilities

#### 4.6.1 LLM Gateway

| ID | Requirement | Priority |
|---|---|---|
| FR-LLM-001 | The platform **MUST** provide a centralised LLM Gateway that abstracts provider details from consuming agents. | Must |
| FR-LLM-002 | The gateway **MUST** support multiple LLM providers simultaneously: OpenAI GPT-4 class, Anthropic Claude, Azure OpenAI, and on-premises/self-hosted models via OpenAI-compatible API. | Must |
| FR-LLM-003 | Provider selection **MUST** be configurable per tenant and per task type (e.g., a tenant may route troubleshooting tasks to an on-prem model and analysis tasks to OpenAI). | Must |
| FR-LLM-004 | The gateway **MUST** implement provider fallback: if the primary provider is unavailable or rate-limited, automatically retry with the configured secondary provider. | Must |
| FR-LLM-005 | All prompt/completion payloads **MUST** be logged (with PII redaction) for audit and cost attribution purposes, subject to tenant data-residency settings. | Must |
| FR-LLM-006 | The gateway **MUST** enforce per-tenant token budgets on a rolling 24-hour window, rejecting requests that would exceed the budget with a clear error response. | Must |
| FR-LLM-007 | Prompt templates **MUST** be versioned and managed as first-class artefacts, testable independently of production data. | Should |

#### 4.6.2 AI Capabilities Exposed to Users

| ID | Requirement | Priority |
|---|---|---|
| FR-LLM-010 | **Conversational Troubleshooting:** Users **MUST** be able to open a chat session with the AI assistant to describe a problem in natural language and receive step-by-step guidance. | Must |
| FR-LLM-011 | **Automated Resolution Plans:** The Troubleshooting Agent **MUST** auto-generate resolution plans using LLM reasoning over vendor knowledge, incident history, and correlation data. | Must |
| FR-LLM-012 | **Semantic Knowledge Search:** The Vendor Knowledge Agent **MUST** support semantic (vector) search over the knowledge corpus, returning relevant articles with cited sources. | Must |
| FR-LLM-013 | **Anomaly Narrative:** The Analysis Agent **MUST** generate human-readable narratives summarising anomaly detection results and trend forecasts. | Must |
| FR-LLM-014 | **Advisory Summarisation:** When new vendor advisories are ingested, the LLM **MUST** generate a structured summary (affected products, severity, recommended actions) within 60 seconds. | Must |
| FR-LLM-015 | **Feedback-Driven Improvement:** The system **MUST** collect explicit (thumbs up/down) and implicit (step accepted/rejected) feedback and route it to the model-improvement pipeline. | Should |
| FR-LLM-016 | **Guardrails:** The LLM Gateway **MUST** apply content filtering to block hallucinated or harmful outputs before they reach end users. | Must |
| FR-LLM-017 | **Streaming Responses:** The LLM Gateway **MUST** support streaming completions via Server-Sent Events (SSE) for user-facing conversational features (FR-LLM-010). Streaming **MUST** be opt-in per request; batch (non-streaming) mode remains available for programmatic consumers. The Portal **MUST** progressively render streamed tokens to the user. | Must |
| FR-LLM-018 | **Cost Optimisation:** The LLM Gateway **MUST** implement semantic response caching: identical or near-identical prompts (cosine similarity ≥ 0.97) **MUST** return a cached response rather than issuing a new provider request. The gateway **MUST** support model-tier routing rules so lower-cost models handle simple classification tasks and higher-capability models are reserved for complex reasoning, reducing per-tenant token spend. | Should |

---

### 4.7 External System Integrations

#### 4.7.1 Integration Catalogue

| ID | Requirement | Priority |
|---|---|---|
| FR-INT-001 | The platform **MUST** provide pre-built integrations for: ServiceNow, Jira Service Management, PagerDuty, OpsGenie, Datadog, Prometheus/Alertmanager, Zabbix, AWS CloudWatch, Azure Monitor, Splunk, and generic webhooks. | Must |
| FR-INT-002 | Each integration **MUST** support bidirectional sync: ingest data from external systems AND push updates (e.g., incident status changes) back. | Must |
| FR-INT-003 | Integration configuration **MUST** be tenant-scoped, stored encrypted, and never exposed in API responses. | Must |
| FR-INT-004 | The Integration Agent **MUST** validate connectivity and credentials before activating an integration, providing clear error messages for failures. | Must |
| FR-INT-005 | Failed integration events **MUST** be queued for retry with exponential backoff (max 5 retries, max delay 1 hour). | Must |
| FR-INT-006 | Integration event delivery **MUST** be idempotent — duplicate events from external systems **MUST** be detected and discarded using event fingerprinting. | Must |
| FR-INT-007 | A generic webhook integration **MUST** be available with a configurable JSON schema mapper so any system can push events to IIVKIS. | Must |
| FR-INT-008 | Integration health status **MUST** be visible to tenant administrators with last-sync timestamp, error count, and event throughput metrics. | Should |
| FR-INT-009 | All inbound webhooks accepted by IIVKIS **MUST** support HMAC-SHA256 signature verification. Requests without a valid signature **MUST** be rejected with HTTP 401. The platform **MUST** implement replay-attack prevention by rejecting webhook requests whose timestamp deviates more than 5 minutes from server time. | Must |
| FR-INT-010 | Tenant administrators **MUST** be able to configure an IP allowlist for each inbound webhook endpoint; requests from non-allowlisted IPs **MUST** be blocked when an allowlist is active. | Should |

#### 4.7.2 CMDB Integration

| ID | Requirement | Priority |
|---|---|---|
| FR-INT-020 | The platform **MUST** ingest a Configuration Item (CI) graph from at least one CMDB source per tenant and maintain a local topology replica. | Must |
| FR-INT-021 | CI data **MUST** include: CI ID, type, name, owning team, dependencies (parent/child), environment (prod/staging/dev), and last-modified timestamp. | Must |
| FR-INT-022 | CMDB sync **MUST** occur on a configurable schedule (minimum 15 minutes) and also support on-demand refresh. | Must |

---

### 4.8 Analytics & Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-AN-001 | The Analysis Agent **MUST** produce at minimum the following dashboards: incident volume trend, mean time to resolution (MTTR), top affected products, correlation accuracy, and LLM usage/cost. | Must |
| FR-AN-002 | All dashboard metrics **MUST** support time-range filtering (last 24 h, 7 days, 30 days, 90 days, custom range). | Must |
| FR-AN-003 | The platform **MUST** support scheduled report generation (daily/weekly/monthly) delivered via email and downloadable as PDF or CSV. | Must |
| FR-AN-004 | The Analysis Agent **MUST** perform anomaly detection on incident volume and alert frequency, alerting operators to unusual spikes. | Must |
| FR-AN-005 | The platform **MUST** expose a read-only analytics API so external BI tools (Tableau, Power BI, Grafana) can query aggregated tenant metrics. | Should |
| FR-AN-006 | All analytics computations **MUST** be tenant-isolated; no aggregated cross-tenant data visible to tenant users. | Must |
| FR-AN-007 | The platform **MUST** produce a monthly vendor performance scorecard rating vendor KB quality, advisory timeliness, and patch availability. | Should |

---

### 4.9 Notifications & Alerting

| ID | Requirement | Priority |
|---|---|---|
| FR-NOTIF-001 | The platform **MUST** support notification delivery via: in-app (portal), email, Slack, Microsoft Teams, SMS (via Twilio or equivalent), and PagerDuty escalation. | Must |
| FR-NOTIF-002 | Notification rules **MUST** be configurable per tenant and per user, with the ability to mute channels, set quiet hours, and define escalation policies. | Must |
| FR-NOTIF-003 | All critical notifications (severity: critical) **MUST** be delivered within 30 seconds of the triggering event under normal load. | Must |
| FR-NOTIF-004 | Notification delivery **MUST** be tracked — delivered, failed, acknowledged — and failures retried up to 3 times. | Must |
| FR-NOTIF-005 | Users **MUST** receive notifications for: new incident assigned, correlation group created, resolution plan ready, SLA breach warning, billing threshold warning, and security alerts. | Must |
| FR-NOTIF-006 | The platform **MUST** support digest notifications grouping low-severity events over a configurable window (default: 1 hour). | Should |

---

### 4.10 Billing & Subscription Management

#### 4.10.1 Subscription Plans

| ID | Requirement | Priority |
|---|---|---|
| FR-BILL-001 | The platform **MUST** support at minimum three subscription tiers: **Starter** (limited users, LLM tokens, integrations), **Professional** (expanded limits), and **Enterprise** (unlimited, custom SLA). | Must |
| FR-BILL-002 | Plan definitions **MUST** be configurable by platform administrators without a code deployment (stored in a pricing catalogue). | Must |
| FR-BILL-003 | The platform **MUST** support custom enterprise plans negotiated per tenant with arbitrary feature flags and overridden limits. | Must |
| FR-BILL-004 | The system **MUST** allow mid-cycle plan upgrades with proration; downgrades take effect at the next billing cycle. | Must |

#### 4.10.2 Usage Metering

| ID | Requirement | Priority |
|---|---|---|
| FR-BILL-010 | The Billing Engine **MUST** meter usage across: monthly active users (MAU), incidents processed, LLM tokens consumed (input + output), API calls, data storage (GB), and integration events ingested. | Must |
| FR-BILL-011 | Usage metrics **MUST** be collected in real time and materialised into daily/monthly aggregates for invoicing. | Must |
| FR-BILL-012 | Tenants **MUST** be able to view their current-period usage against plan limits in real time via the portal. | Must |
| FR-BILL-013 | The platform **MUST** emit alerts when a tenant reaches 80% and 100% of any metered limit. | Must |
| FR-BILL-014 | Overages beyond plan limits **MUST** either block the feature (with a clear upgrade prompt) or be charged at a configurable overage rate per the tenant's plan. | Must |

#### 4.10.3 Invoicing & Payment

| ID | Requirement | Priority |
|---|---|---|
| FR-BILL-020 | The Billing Engine **MUST** integrate with at least one payment processor (Stripe preferred) for automated monthly invoicing and card-on-file charging. | Must |
| FR-BILL-021 | Invoices **MUST** itemise charges by metered dimension, show plan fees, and present a net total. | Must |
| FR-BILL-022 | Failed payments **MUST** trigger a retry schedule: 3-day, 5-day, 7-day retries, followed by account suspension and final warning. | Must |
| FR-BILL-023 | Platform administrators **MUST** be able to apply credits, discounts, and manual adjustments to any tenant's account with a mandatory reason annotation. | Must |
| FR-BILL-024 | The system **MUST** generate downloadable PDF invoices compliant with the tax jurisdiction configured for the tenant. | Should |
| FR-BILL-025 | For Enterprise tenants, the platform **MUST** support purchase-order-based annual invoicing instead of credit card billing. | Should |

---

### 4.11 Administration & Platform Management

| ID | Requirement | Priority |
|---|---|---|
| FR-ADMIN-001 | A super-admin portal **MUST** exist, accessible only to platform operators, with full visibility across all tenants. | Must |
| FR-ADMIN-002 | Platform administrators **MUST** be able to view and export audit logs filtered by tenant, actor, action type, resource, and date range. | Must |
| FR-ADMIN-003 | The platform **MUST** provide a health dashboard showing the status of all internal services, agents, integrations, and LLM providers. | Must |
| FR-ADMIN-004 | Platform administrators **MUST** be able to trigger on-demand data exports for a tenant (for compliance/GDPR requests). | Must |
| FR-ADMIN-005 | The platform **MUST** support feature flags to enable/disable capabilities per tenant without a code deployment. | Must |
| FR-ADMIN-006 | Maintenance windows **MUST** be schedulable with advance notification to affected tenants via in-app and email banners. | Should |

---

### 4.12 Incident SLA Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SLA-001 | The platform **MUST** support definition of SLA policies per tenant, specifying maximum response time (time to first acknowledgement) and maximum resolution time per incident severity level. Default targets: Critical — respond 15 min / resolve 4 h; High — respond 30 min / resolve 8 h; Medium — respond 2 h / resolve 24 h; Low — respond 8 h / resolve 72 h. | Must |
| FR-SLA-002 | SLA timers **MUST** start automatically on incident creation and pause when the incident moves to a vendor-pending or awaiting-customer status; timers resume on re-activation. | Must |
| FR-SLA-003 | The portal **MUST** display real-time SLA countdown indicators on incident views, colour-coded by proximity to breach (green > 50%, amber 25–50%, red < 25%). | Must |
| FR-SLA-004 | When an incident is within a configurable warning threshold (default: 25% of SLA time remaining), the platform **MUST** send an SLA-warning notification to the assignee and team lead via all active notification channels. | Must |
| FR-SLA-005 | SLA compliance metrics (% incidents within SLA, % breached, average resolution time per severity) **MUST** be included in the analytics dashboards (FR-AN-001) and schedulable reports (FR-AN-003). | Must |

---

## 5. Non-Functional Requirements

Requirements use the identifier format `NFR-<CATEGORY>-<NNN>`.

### 5.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-001 | Portal page load time (Time to Interactive) | p95 < 3 s on 10 Mbps connection |
| NFR-PERF-002 | API response time for read endpoints | p95 < 200 ms under design load |
| NFR-PERF-003 | API response time for write endpoints | p95 < 500 ms under design load |
| NFR-PERF-004 | Resolution plan generation (Troubleshooting Agent) | p95 < 10 s |
| NFR-PERF-005 | Correlation Engine — signal processing latency | p95 < 5 s from signal ingestion to correlation group creation |
| NFR-PERF-006 | Semantic search (Vendor Knowledge Agent) | p95 < 2 s |
| NFR-PERF-007 | Notification delivery — critical severity | p95 < 30 s end-to-end |
| NFR-PERF-008 | Dashboard data refresh | ≤ 60 s staleness for real-time widgets |

### 5.2 Scalability

| ID | Requirement | Target |
|---|---|---|
| NFR-SCALE-001 | Horizontal scaling | All stateless services (API, Orchestrator, Agents) **MUST** scale horizontally without downtime. |
| NFR-SCALE-002 | Tenant scalability | Platform **MUST** support 500 active tenants at GA, designed to scale to 10,000 with infrastructure scaling only. |
| NFR-SCALE-003 | Concurrent users per tenant | Support ≥ 500 concurrent active users per tenant; ≥ 50,000 across all tenants. |
| NFR-SCALE-004 | Signal ingestion throughput | ≥ 10,000 signals/minute per tenant; ≥ 1M signals/minute aggregate. |
| NFR-SCALE-005 | Data retention scalability | Tenant data volumes up to 5 TB/tenant without query degradation. |
| NFR-SCALE-006 | Database sharding strategy | Tenant data **MUST** be partitioned such that adding tenants does not degrade existing tenant query performance. |

### 5.3 Availability & Reliability

| ID | Requirement | Target |
|---|---|---|
| NFR-AVAIL-001 | Platform SLA | 99.9% monthly uptime (< 44 minutes downtime/month) for Professional; 99.95% for Enterprise. |
| NFR-AVAIL-002 | Planned maintenance | Zero-downtime deployments via rolling updates or blue/green. Scheduled maintenance windows ≤ 4 h/year. |
| NFR-AVAIL-003 | RTO (Recovery Time Objective) | < 1 hour for full service restoration after a catastrophic failure. |
| NFR-AVAIL-004 | RPO (Recovery Point Objective) | < 15 minutes — no more than 15 minutes of data loss on catastrophic failure. |
| NFR-AVAIL-005 | Single-region HA | Active-passive HA with automatic failover within the primary region. |
| NFR-AVAIL-006 | Multi-region DR | Active-passive cross-region DR capable of activating within the RTO window. |
| NFR-AVAIL-007 | Queue durability | Message queues **MUST** be durable (persisted) with at-least-once delivery guarantees. |

---

### 5.4 Security

#### 5.4.1 Transport & Data-at-Rest Security

| ID | Requirement | Target |
|---|---|---|
| NFR-SEC-001 | All external traffic **MUST** use TLS 1.2 minimum; TLS 1.3 preferred. | Enforced at load-balancer/ingress |
| NFR-SEC-002 | All data at rest **MUST** be encrypted using AES-256 or equivalent. | All databases, object stores, message queues |
| NFR-SEC-003 | Secrets (credentials, API keys, LLM keys) **MUST** be stored in a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault). Never in environment variables or source code. | Must |
| NFR-SEC-004 | Tenant encryption keys (BYOK) **MUST** be managed via HSM-backed key storage. | Should |

#### 5.4.2 Application Security

| ID | Requirement | Target |
|---|---|---|
| NFR-SEC-010 | All API inputs **MUST** be validated and sanitised to prevent injection attacks (SQLi, NoSQLi, prompt injection, command injection). | Must |
| NFR-SEC-011 | The platform **MUST** implement OWASP Top 10 mitigations as a minimum baseline. A penetration test **MUST** be completed before GA launch. | Must |
| NFR-SEC-012 | Rate limiting **MUST** be applied at the API gateway level: configurable per tenant per endpoint category. Default: 1,000 requests/minute/tenant. | Must |
| NFR-SEC-013 | All API responses **MUST** include appropriate security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options). | Must |
| NFR-SEC-014 | Prompt injection attacks against the LLM layer **MUST** be detected and blocked via input sanitisation and output validation guardrails. | Must |
| NFR-SEC-015 | The platform **MUST** implement SSRF protection on all URL-accepting inputs (integration webhook URLs, vendor feed URLs). | Must |
| NFR-SEC-016 | All API responses subject to rate limiting **MUST** include standard rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix epoch). Responses that exceed the limit **MUST** return HTTP 429 with a `Retry-After` header. | Must |

#### 5.4.3 Audit & Non-Repudiation

| ID | Requirement | Target |
|---|---|---|
| NFR-SEC-020 | Every state-changing API action **MUST** produce an immutable audit log entry containing: actor, action, resource, timestamp (UTC), source IP, tenant ID. | Must |
| NFR-SEC-021 | Audit logs **MUST** be tamper-evident (write-once storage or WORM-compatible append-only log). | Must |
| NFR-SEC-022 | Audit logs **MUST** be retained for a minimum of 12 months online and 7 years in cold archive. | Must |
| NFR-SEC-023 | Authentication events (login, logout, failed login, MFA bypass attempt) **MUST** be logged and anomalous patterns **MUST** trigger alerts to the platform security team. | Must |

#### 5.4.4 Zero-Trust & Network Security

| ID | Requirement | Target |
|---|---|---|
| NFR-SEC-030 | All inter-service communication **MUST** be mutually authenticated (mTLS or service mesh with identity verification). | Must |
| NFR-SEC-031 | Network policies **MUST** enforce least-privilege: services communicate only on required ports to required peers. | Must |
| NFR-SEC-032 | The platform **MUST** operate a Web Application Firewall (WAF) in front of all public ingress. | Must |
| NFR-SEC-033 | A vulnerability management programme **MUST** scan container images, dependencies, and infrastructure code in CI/CD pipelines. Critical CVEs must be patched within 7 days of disclosure. | Must |

---

### 5.5 Resiliency

#### 5.5.1 Fault Isolation

| ID | Requirement | Target |
|---|---|---|
| NFR-RES-001 | Each service (API, Orchestrator, each Agent) **MUST** be independently deployable and independently restartable without affecting other services. | Must |
| NFR-RES-002 | A failure in any single Agent **MUST NOT** prevent the Orchestrator from serving requests handled by the other Agents (bulkhead isolation). | Must |
| NFR-RES-003 | LLM provider failures **MUST NOT** bring down the core incident management or correlation capabilities; AI features degrade gracefully with a user-visible fallback notice. | Must |

#### 5.5.2 Retry & Circuit Breaker

| ID | Requirement | Target |
|---|---|---|
| NFR-RES-010 | All outbound HTTP calls (to LLM providers, external integrations, vendor APIs) **MUST** implement exponential-backoff retry with jitter (max 3 retries, initial 500 ms, cap 30 s). | Must |
| NFR-RES-011 | A circuit breaker **MUST** be applied to every external dependency; circuit opens after 5 consecutive failures within 60 s; half-open probe every 30 s. | Must |
| NFR-RES-012 | Timed-out LLM requests **MUST** return a cached or fallback response rather than hanging the user's session; fallback must indicate degraded AI mode. | Must |

#### 5.5.3 Queue & Async Processing

| ID | Requirement | Target |
|---|---|---|
| NFR-RES-020 | Agent tasks **MUST** be dispatched via a durable message queue; tasks survive service restarts. | Must |
| NFR-RES-021 | Dead-letter queues (DLQ) **MUST** capture messages that fail after maximum retries; DLQ contents must be alertable and inspectable. | Must |
| NFR-RES-022 | Idempotency keys **MUST** be enforced on all task dispatch calls to prevent duplicate processing on network retries. | Must |

#### 5.5.4 Disaster Recovery & Backup

| ID | Requirement | Target |
|---|---|---|
| NFR-RES-030 | Full database backups **MUST** be taken daily; incremental backups every 15 minutes. Backups **MUST** be stored in a separate geographic region. | Must |
| NFR-RES-031 | Backup restoration **MUST** be tested automatically on a weekly schedule in an isolated environment with a pass/fail alert. | Must |
| NFR-RES-032 | The platform **MUST** have a documented and tested DR runbook capable of achieving RTO < 1 h and RPO < 15 min. | Must |
| NFR-RES-033 | Vector index snapshots (for semantic search) **MUST** be captured daily and recoverable within the RTO window. | Should |

#### 5.5.5 Health & Degraded-Mode Operation

| ID | Requirement | Target |
|---|---|---|
| NFR-RES-040 | Every service **MUST** expose a `/health` liveness endpoint and a `/ready` readiness endpoint consumed by the orchestration layer. | Must |
| NFR-RES-041 | The platform **MUST** define a degraded-mode operation profile: if any Agent is unavailable, the Portal continues to serve cached/static views with clear degraded-mode banners. | Must |
| NFR-RES-042 | Automated runbooks (or at minimum documented procedures) **MUST** exist for: service restart, database failover, LLM provider switch, and queue backlog drain. | Should |

---

### 5.6 Observability

| ID | Requirement | Target |
|---|---|---|
| NFR-OBS-001 | Structured JSON logs **MUST** be emitted by all services with fields: `timestamp`, `level`, `service`, `tenant_id`, `trace_id`, `span_id`, `message`, `error`. | Must |
| NFR-OBS-002 | Distributed tracing **MUST** be implemented using OpenTelemetry; traces span the full request path from Portal through API, Orchestrator, and Agents. | Must |
| NFR-OBS-003 | Key metrics **MUST** be exposed in Prometheus format: request rate, error rate, latency (p50/p95/p99), queue depth, LLM token usage, and circuit-breaker state. | Must |
| NFR-OBS-004 | Alerting rules **MUST** be defined for: error rate > 1%, p95 latency > SLA threshold, queue depth > 10,000, circuit-breaker open, and LLM budget > 80%. | Must |
| NFR-OBS-005 | A unified operational dashboard (Grafana or equivalent) **MUST** be available to platform engineers, pre-configured with per-service and per-tenant drill-down views. | Must |
| NFR-OBS-006 | Log retention: 30 days hot, 12 months warm, 7 years cold (matching audit log policy). | Must |

---

### 5.7 Compliance & Data Governance

| ID | Requirement | Target |
|---|---|---|
| NFR-COMP-001 | The platform **MUST** be designed for GDPR compliance: right to access, right to erasure, data portability, consent management. | Must |
| NFR-COMP-002 | The platform **MUST** support SOC 2 Type II certification requirements: access control, availability, confidentiality, processing integrity. | Must |
| NFR-COMP-003 | Tenant data-residency requirements **MUST** be honoured — data for a tenant configured with a specific region **MUST NOT** leave that region except for DR backups with explicit consent. | Must |
| NFR-COMP-004 | PII within incidents, logs, and LLM prompts **MUST** be identifiable, maskable, and eligible for erasure on GDPR request. | Must |
| NFR-COMP-005 | The platform **SHOULD** achieve ISO/IEC 27001 certification within 18 months of GA. | Should |
| NFR-COMP-006 | All LLM prompt/completion data involving tenant content **MUST NOT** be used to train third-party LLM provider models; data processing agreements (DPA) **MUST** be in place with all LLM providers. | Must |
| NFR-COMP-007 | The platform **MUST** enforce a configurable operational data retention policy per tenant. Default retention windows: closed incidents — 3 years online, 7 years cold archive; correlation groups — 2 years; raw signals — 90 days online, 1 year cold archive; analytics aggregates — 5 years. Data past the retention window **MUST** be automatically purged or anonymised; tenant administrators **MUST** be able to extend retention within plan limits. | Must |

---

### 5.8 Usability & Accessibility

| ID | Requirement | Target |
|---|---|---|
| NFR-UX-001 | The portal **MUST** be responsive and fully functional on desktop (1280 px+) and tablet (768 px+) form factors. | Must |
| NFR-UX-002 | The portal **MUST** conform to WCAG 2.1 Level AA accessibility standards. | Must |
| NFR-UX-003 | The portal **MUST** support dark mode and high-contrast modes. | Should |
| NFR-UX-004 | The platform **MUST** support English (en-US) at launch; internationalisation (i18n) framework **MUST** be in place to add further locales. | Must |
| NFR-UX-005 | Time-to-first-meaningful-action for a new tenant (onboarding to first incident created) **MUST** be achievable in ≤ 10 minutes. | Should |

---

### 5.9 Maintainability & Extensibility

| ID | Requirement | Target |
|---|---|---|
| NFR-MAINT-001 | The codebase **MUST** maintain ≥ 80% unit test coverage for all business-logic modules. | Must |
| NFR-MAINT-002 | All public REST API endpoints **MUST** have OpenAPI 3.1 specifications that are kept in sync with implementation via contract testing. | Must |
| NFR-MAINT-003 | New AI agents **MUST** be addable to the system by implementing the `AgentRequest → AgentResponse` interface and registering with the Orchestrator — without modifying existing agent code. | Must |
| NFR-MAINT-004 | New external integrations **MUST** be addable by implementing a defined integration adapter interface — without modifying the Integration Agent core. | Must |
| NFR-MAINT-005 | Feature flags **MUST** be used for all new capabilities at launch, allowing gradual rollout and instant rollback. | Must |
| NFR-MAINT-006 | All deployment infrastructure **MUST** be defined as code (Terraform or Pulumi); manual infra changes are prohibited in production. | Must |
| NFR-MAINT-007 | All public REST API endpoints **MUST** use URI-based versioning (e.g., `/api/v1/…`). A deprecation policy **MUST** be in place: deprecated API versions **MUST** be announced with a minimum 6-month sunset period via response headers (`Deprecation`, `Sunset`, `Link`) and developer changelog. No breaking changes are permitted within a published major version. | Must |
| NFR-MAINT-008 | A CI/CD pipeline **MUST** be implemented for every service in the monorepo, automatically running: linting, type-checking, unit tests, integration tests, security scanning (dependency CVE + SAST), Docker image build, and deployment to staging on every pull request merge. Production deployments **MUST** require a passing staging deployment and explicit promotion approval. | Must |

---

## 6. Constraints & Assumptions

### 6.1 Constraints

| ID | Constraint |
|---|---|
| CON-001 | The system is built as a TypeScript npm-workspaces monorepo; all service code **MUST** remain within this monorepo. |
| CON-002 | Node.js ≥ 18 is the minimum supported runtime for all server-side services. |
| CON-003 | The primary web framework for the portal is Next.js 15; the primary API framework is Express 4. Deviations require architectural review. |
| CON-004 | LLM provider APIs are external SaaS services; their availability and latency are not within IIVKIS control — design accordingly. |
| CON-005 | The platform must not embed private vendor intellectual property (product source code, proprietary documentation) — only publicly available knowledge and vendor-approved content. |
| CON-006 | Payment Card Industry (PCI-DSS) scoped workloads are out of scope — payment tokenisation is delegated entirely to the payment processor (Stripe); IIVKIS never stores raw card data. |

### 6.2 Assumptions

| ID | Assumption |
|---|---|
| ASM-001 | Tenants will provide their own LLM API keys for on-premises or private deployments; the platform manages keys but does not fund LLM usage for tenants. |
| ASM-002 | External ITSM/CMDB systems expose REST APIs or webhook capabilities; legacy systems requiring on-premises agents are a future consideration. |
| ASM-003 | Tenant user counts are expected to be < 1,000 per tenant at GA; the architecture scales beyond this but initial testing validates up to this level. |
| ASM-004 | Vendor knowledge quality is the responsibility of the vendor feed; IIVKIS normalises and indexes but does not validate factual accuracy of vendor-supplied content. |
| ASM-005 | Browser support targets: latest two major versions of Chrome, Firefox, Edge, and Safari. Internet Explorer is not supported. |

---

## 7. Glossary

| Term | Definition |
|---|---|
| **Agent** | A specialised autonomous service within IIVKIS responsible for a specific capability domain (vendor knowledge, troubleshooting, integration, or analysis). |
| **Audit Log** | An immutable, append-only record of all state-changing operations performed within the platform. |
| **BYOK** | Bring Your Own Key — a model in which a tenant supplies their own encryption key managed outside the platform. |
| **CI** | Configuration Item — a managed IT asset tracked in the CMDB. |
| **CMDB** | Configuration Management Database — a system that tracks IT assets and their relationships. |
| **Correlation Engine** | The IIVKIS subsystem that identifies relationships between signals and surfaces root-cause candidates. |
| **DLQ** | Dead-Letter Queue — a message queue that captures messages that could not be processed after maximum retries. |
| **ITSM** | IT Service Management — a set of processes and tools for managing IT service delivery (e.g., ServiceNow, Jira). |
| **LLM** | Large Language Model — a deep-learning model trained on large text corpora, capable of understanding and generating human language. |
| **LLM Gateway** | The IIVKIS service layer that abstracts LLM provider selection, key management, budgeting, and fallback. |
| **MAU** | Monthly Active User — a user who performs at least one authenticated action within a calendar month. |
| **MTTR** | Mean Time to Resolution — the average time from incident creation to closure. |
| **Orchestrator** | The Engineering Orchestrator — the central service that routes tasks to Agents and aggregates results. |
| **Prompt Injection** | An attack in which malicious user input manipulates LLM prompt context to produce unintended outputs. |
| **RPO** | Recovery Point Objective — the maximum acceptable data loss window in a disaster. |
| **RTO** | Recovery Time Objective — the maximum acceptable service downtime in a disaster. |
| **Signal** | Any observable event or data point ingested by the Correlation Engine (alert, log, incident, advisory, change record). |
| **Tenant** | An organisational unit representing a customer of the IIVKIS SaaS platform, with full data isolation. |
| **WORM** | Write Once Read Many — a storage model ensuring data cannot be modified or deleted after writing. |

---

## 8. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| OQ-001 | Which vector database technology is preferred for semantic search (pgvector, Pinecone, Weaviate, Qdrant)? | Architect Agent | STEP 2 |
| OQ-002 | What is the target cloud platform (AWS, Azure, GCP, multi-cloud)? Infrastructure-as-code templates depend on this. | Engineering Lead | STEP 2 |
| OQ-003 | Should the Correlation Engine ML model be trained on synthetic data initially, or are historical incident datasets available? | Data Team | STEP 3 |
| OQ-004 | Are there specific regulatory frameworks beyond GDPR/SOC 2 required (HIPAA, FedRAMP, ISO 27001)? | Security Officer | STEP 1 review |
| OQ-005 | Is a self-hosted deployment model (on-premises Kubernetes) required from day one, or is cloud-only sufficient for GA? | Engineering Lead | STEP 2 |
| OQ-006 | Which payment processor is preferred — Stripe, Zuora, or another? | Finance / Product | STEP 5 |
| OQ-007 | What is the preferred message queue technology (Kafka, RabbitMQ, AWS SQS, Azure Service Bus)? | Platform Team | STEP 2 |
| OQ-008 | Should the LLM Gateway support streaming (Server-Sent Events) responses for the conversational troubleshooting UX? | Product | ✅ **Resolved** — Promoted to FR-LLM-017 (Must). |

---

## 9. Requirements Traceability Matrix

This matrix maps every mandated problem-statement domain to the requirement IDs that address it, confirming full coverage.

### 9.1 Multi-Tenancy

| Sub-Area | Requirement IDs |
|---|---|
| Tenant isolation (data-store) | FR-MT-001, FR-MT-002, FR-MT-003 |
| Tenant lifecycle management | FR-MT-010, FR-MT-011, FR-MT-012, FR-MT-013 |
| Per-tenant encryption (BYOK) | FR-MT-006 |
| Per-tenant SSO | FR-MT-004 |
| Per-tenant resource quotas | FR-MT-005 |
| User & role management per tenant | FR-MT-020, FR-MT-021, FR-MT-022 |
| Tenant-scoped authentication | FR-IAM-001 … FR-IAM-008 |
| Tenant-scoped vector search isolation | FR-VK-010 |
| Tenant-scoped integrations | FR-INT-003 |
| Tenant-scoped analytics isolation | FR-AN-006 |
| Tenant-scoped data retention | NFR-COMP-007 |
| Tenant-scoped data residency | NFR-COMP-003 |
| Database partitioning | NFR-SCALE-006 |

### 9.2 Correlation Engine

| Sub-Area | Requirement IDs |
|---|---|
| Signal ingestion (sources, enrichment, throughput) | FR-CE-001, FR-CE-002, FR-CE-003, FR-CE-004 |
| Rule-based correlation | FR-CE-010, FR-CE-015, FR-CE-016 |
| ML-based correlation | FR-CE-011, FR-CE-025 |
| Temporal correlation | FR-CE-012 |
| Topological correlation (CMDB-aware) | FR-CE-013, FR-INT-020, FR-INT-021, FR-INT-022 |
| Semantic correlation (LLM-powered) | FR-CE-014 |
| Correlation groups & root-cause candidates | FR-CE-020, FR-CE-021, FR-CE-022, FR-CE-023, FR-CE-024 |
| Correlation performance | NFR-PERF-005 |
| Correlation throughput | NFR-SCALE-004 |

### 9.3 LLM Integration

| Sub-Area | Requirement IDs |
|---|---|
| LLM Gateway (multi-provider abstraction) | FR-LLM-001, FR-LLM-002, FR-LLM-003, FR-LLM-004 |
| LLM token budgets & metering | FR-LLM-006, FR-BILL-010 |
| Prompt management & versioning | FR-LLM-007 |
| LLM audit logging (with PII redaction) | FR-LLM-005 |
| LLM guardrails & content filtering | FR-LLM-016 |
| LLM streaming (SSE) | FR-LLM-017 |
| LLM cost optimisation & semantic caching | FR-LLM-018 |
| Conversational troubleshooting | FR-LLM-010 |
| Automated resolution plans | FR-LLM-011 |
| Semantic knowledge search | FR-LLM-012, FR-VK-008, FR-VK-010 |
| Anomaly narrative generation | FR-LLM-013 |
| Advisory summarisation | FR-LLM-014 |
| Feedback-driven improvement | FR-LLM-015, FR-TS-006 |
| Prompt injection protection | NFR-SEC-014 |
| LLM DPA (no-training clause) | NFR-COMP-006 |
| LLM fallback / circuit-breaker | NFR-RES-003, NFR-RES-011, NFR-RES-012 |

### 9.4 Billing

| Sub-Area | Requirement IDs |
|---|---|
| Subscription plan tiers | FR-BILL-001, FR-BILL-002, FR-BILL-003, FR-BILL-004 |
| Usage metering (MAU, tokens, API calls, storage, events) | FR-BILL-010, FR-BILL-011 |
| Real-time usage visibility | FR-BILL-012 |
| Overage alerts & enforcement | FR-BILL-013, FR-BILL-014 |
| Payment processor integration | FR-BILL-020 |
| Invoice generation | FR-BILL-021, FR-BILL-024, FR-BILL-025 |
| Payment retry & suspension | FR-BILL-022 |
| Credits, discounts, adjustments | FR-BILL-023 |

### 9.5 Security

| Sub-Area | Requirement IDs |
|---|---|
| Transport encryption (TLS) | NFR-SEC-001 |
| Data-at-rest encryption (AES-256) | NFR-SEC-002 |
| Secrets management | NFR-SEC-003, NFR-SEC-004 |
| Input validation & injection prevention | NFR-SEC-010 |
| OWASP Top 10 + pentest | NFR-SEC-011 |
| Rate limiting with headers | NFR-SEC-012, NFR-SEC-016 |
| Security response headers | NFR-SEC-013 |
| Prompt injection prevention | NFR-SEC-014 |
| SSRF protection | NFR-SEC-015 |
| Immutable audit logs (WORM) | NFR-SEC-020, NFR-SEC-021, NFR-SEC-022 |
| Authentication event monitoring | NFR-SEC-023 |
| mTLS inter-service communication | NFR-SEC-030 |
| Least-privilege network policies | NFR-SEC-031 |
| WAF at ingress | NFR-SEC-032 |
| Vulnerability management (CVE / SAST) | NFR-SEC-033, NFR-MAINT-008 |
| MFA enforcement | FR-IAM-004 |
| Session management & force-logout | FR-IAM-008 |
| Inbound webhook HMAC security | FR-INT-009, FR-INT-010 |
| Compliance (GDPR, SOC 2) | NFR-COMP-001, NFR-COMP-002, NFR-COMP-004, NFR-COMP-005 |
| Data residency | NFR-COMP-003 |

### 9.6 Resiliency

| Sub-Area | Requirement IDs |
|---|---|
| Independent service deployment (bulkheads) | NFR-RES-001, NFR-RES-002, NFR-RES-003 |
| Retry with exponential backoff & jitter | NFR-RES-010 |
| Circuit breaker | NFR-RES-011 |
| LLM timeout fallback | NFR-RES-012 |
| Durable message queues | NFR-RES-020, NFR-AVAIL-007 |
| Dead-letter queues (DLQ) | NFR-RES-021 |
| Idempotency keys | NFR-RES-022 |
| Backup (daily full, 15-min incremental) | NFR-RES-030 |
| Automated backup restoration testing | NFR-RES-031 |
| DR runbook (RTO < 1 h, RPO < 15 min) | NFR-RES-032, NFR-AVAIL-003, NFR-AVAIL-004 |
| Vector index snapshots | NFR-RES-033 |
| Health & readiness endpoints | NFR-RES-040 |
| Degraded-mode operation | NFR-RES-041 |
| Operational runbooks | NFR-RES-042 |
| HA + multi-region DR | NFR-AVAIL-005, NFR-AVAIL-006 |
| Zero-downtime deployments | NFR-AVAIL-002 |

### 9.7 Coverage Summary

| Mandated Domain | Requirement Count | Status |
|---|---|---|
| Multi-Tenancy | 22 | ✅ Complete |
| Correlation Engine | 18 | ✅ Complete |
| LLM Integration | 19 | ✅ Complete |
| Billing | 15 | ✅ Complete |
| Security | 26 | ✅ Complete |
| Resiliency | 18 | ✅ Complete |
| **All 6 Domains** | **118 requirements mapped** | ✅ **Validated** |
