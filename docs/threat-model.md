# IIVKIS Threat Model

**Document ID:** IIVKIS-SEC-001  
**Version:** 1.0.1  
**Status:** Validated — Phase 2 Baseline Confirmed  
**Phase:** STEP 2 — Threat Modeling  
**Author:** Security Agent  
**Date:** 2026-03-28  

### Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0.0 | 2026-03-28 | Security Agent | Initial STRIDE threat model — all trust boundaries, 50 threats catalogued, mitigation controls (RBAC, mTLS, Vault, WAF, OPA), risk register, and control traceability matrix |
| 1.0.1 | 2026-03-28 | Security Agent | Validation pass — GAP-V-01 resolved: TH-S-004 (vendor feed spoofing, Medium residual) added to §9.1 residual risk summary; Medium count corrected 9→10; status updated to Validated |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Scope & Assumptions](#2-scope--assumptions)
3. [System Context & Trust Boundaries](#3-system-context--trust-boundaries)
4. [Data Flow Diagram](#4-data-flow-diagram)
5. [STRIDE Threat Catalogue](#5-stride-threat-catalogue)
   - 5.1 [Spoofing](#51-spoofing)
   - 5.2 [Tampering](#52-tampering)
   - 5.3 [Repudiation](#53-repudiation)
   - 5.4 [Information Disclosure](#54-information-disclosure)
   - 5.5 [Denial of Service](#55-denial-of-service)
   - 5.6 [Elevation of Privilege](#56-elevation-of-privilege)
6. [Mitigation Controls](#6-mitigation-controls)
   - 6.1 [RBAC — Role-Based Access Control](#61-rbac--role-based-access-control)
   - 6.2 [mTLS — Mutual TLS](#62-mtls--mutual-tls)
   - 6.3 [Vault — Secrets Management](#63-vault--secrets-management)
   - 6.4 [WAF — Web Application Firewall](#64-waf--web-application-firewall)
   - 6.5 [OPA — Open Policy Agent](#65-opa--open-policy-agent)
7. [Risk Register](#7-risk-register)
8. [Control Traceability Matrix](#8-control-traceability-matrix)
9. [Residual Risk & Acceptance Criteria](#9-residual-risk--acceptance-criteria)
10. [Appendix A — Trust Boundary Diagram](#appendix-a--trust-boundary-diagram)
11. [Appendix B — Attack Surface Summary](#appendix-b--attack-surface-summary)
12. [Appendix C — STRIDE Quick-Reference](#appendix-c--stride-quick-reference)

---

## 1. Introduction

### 1.1 Purpose

This document is the formal STRIDE threat model for the **Intelligent IT Vendor Knowledge Integration System (IIVKIS)**. It identifies security threats across all system components and trust boundaries, assigns risk ratings, and defines the mitigation controls that must be implemented to reduce risks to an acceptable residual level.

The threat model is a living artefact. It **MUST** be reviewed and updated at:
- Every new major feature or architectural change.
- Before every penetration test engagement.
- After any confirmed security incident involving the platform.

### 1.2 Methodology

The analysis uses the **STRIDE** framework (Microsoft, 1999):

| Letter | Threat Category | Violated Property |
|---|---|---|
| **S** | Spoofing | Authentication |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Elevation of Privilege | Authorisation |

Risk ratings use a 5×5 **Likelihood × Impact** matrix producing four tiers: **Critical**, **High**, **Medium**, **Low**.

### 1.3 Relationship to Requirements

All threat IDs map to requirement IDs in `requirements.md` v1.1.0 (IIVKIS-REQ-001). Where a threat has no existing requirement coverage, a gap is raised (see §9).

---

## 2. Scope & Assumptions

### 2.1 In Scope

| Component | Threat Surface |
|---|---|
| Portal (Next.js) | Browser ↔ CDN ↔ Portal trust boundary |
| API (Express) | Internet-facing REST API |
| Engineering Orchestrator | Internal service-to-service |
| AI Agents (×4) | Internal + outbound to LLM providers |
| LLM Gateway | Outbound to external LLM SaaS |
| Correlation Engine | Internal data processing |
| Billing Engine | Outbound to payment processors |
| Integration Agent | Bidirectional to external IT systems |
| Vendor Knowledge Agent | Inbound from vendor feeds |
| Multi-Tenant Data Plane | Database, vector store, message queue, object store |
| Secrets store (Vault) | Key and credential management |
| CI/CD pipeline | Build and deployment infrastructure |
| Administrative super-admin portal | Platform-operator access surface |

### 2.2 Out of Scope

- Physical data-centre infrastructure.
- End-user device management and endpoint security.
- Third-party LLM provider internal security (covered by DPA; see NFR-COMP-006).
- Raw PCI-DSS card-data flows (tokenisation delegated to Stripe; see CON-006).

### 2.3 Assumptions

| ID | Assumption |
|---|---|
| ASM-T-001 | All services run in containers orchestrated by Kubernetes (cloud-hosted). |
| ASM-T-002 | A service mesh (e.g., Istio or Linkerd) enforces mTLS between all internal services. |
| ASM-T-003 | HashiCorp Vault (or cloud-native equivalent) is deployed as the authoritative secrets store. |
| ASM-T-004 | OPA is deployed as an admission controller and policy-decision point for all authorisation checks. |
| ASM-T-005 | A cloud-provider WAF (AWS WAF, Azure Front Door WAF, or Cloudflare) is deployed at the ingress layer. |
| ASM-T-006 | Tenant data isolation is enforced at both the application layer (JWT tenant claim) and the database layer (row-level security or schema-per-tenant). |
| ASM-T-007 | All persistent storage (databases, object stores, queues) is encrypted at rest with AES-256. |

---

## 3. System Context & Trust Boundaries

### 3.1 Actors

| Actor ID | Actor | Trust Level |
|---|---|---|
| A-01 | Authenticated Tenant User (portal) | Low — untrusted external |
| A-02 | Tenant Administrator | Low — untrusted external |
| A-03 | Platform Super-Admin | Medium — verified operator |
| A-04 | External IT System (ServiceNow, Datadog, etc.) | Low — untrusted external |
| A-05 | Vendor Knowledge Feed | Low — untrusted external |
| A-06 | LLM Provider (OpenAI, Anthropic, Azure AI) | Medium — contractual SaaS |
| A-07 | Payment Processor (Stripe) | Medium — contractual SaaS |
| A-08 | Internal Service / Agent | High — within cluster mTLS perimeter |
| A-09 | CI/CD Pipeline | Medium — controlled automation |
| A-10 | Security Scanner / Pen Tester | Adversarial (test only) |

### 3.2 Trust Boundaries

| Boundary ID | Description | Crossing Controls |
|---|---|---|
| TB-01 | Internet → WAF/CDN | WAF, TLS 1.3, DDoS scrubbing |
| TB-02 | WAF/CDN → Portal (Next.js) | TLS termination, CSP, HSTS |
| TB-03 | Portal → API Gateway | HTTPS, JWT bearer token |
| TB-04 | API Gateway → Orchestrator | mTLS, service account JWT |
| TB-05 | Orchestrator → Agents | mTLS, service account JWT, message queue auth |
| TB-06 | Agents → LLM Providers | TLS 1.3, API key (Vault-managed), DPA in place |
| TB-07 | Integration Agent → External IT Systems | TLS 1.3, OAuth 2.0 / API key (Vault-managed), HMAC validation |
| TB-08 | External IT Systems → API (inbound webhook) | TLS 1.3, HMAC-SHA256, replay-window check, IP allowlist |
| TB-09 | Vendor Feed → Vendor Knowledge Agent | TLS 1.3, feed signature verification |
| TB-10 | Billing Engine → Payment Processor | TLS 1.3, Stripe webhook signature, API key (Vault-managed) |
| TB-11 | All Services → Data Plane (DB, queue, object store) | mTLS, service credentials (Vault dynamic secrets), RLS |
| TB-12 | Kubernetes cluster → Vault | mTLS, Kubernetes service-account token, Vault policies |
| TB-13 | CI/CD Pipeline → Container Registry / K8s | OIDC workload identity, least-privilege RBAC |
| TB-14 | Super-Admin Portal → API | MFA + OIDC, IP restrict, OPA admin policy |

---

## 4. Data Flow Diagram

```
                    ┌──────────────────────────────────────────────────────────────────────┐
                    │  TB-01: INTERNET BOUNDARY  (WAF + DDoS + TLS 1.3 termination)         │
                    └──────────────────────────────────────────────────────────────────────┘
                         │                        │                        │
                    [Browser/           [External IT System         [Vendor Feed
                     Mobile]             Inbound Webhook]            Inbound]
                         │  TB-02              │  TB-08                │  TB-09
                         ▼                    ▼                        ▼
                   ┌──────────┐      ┌─────────────────┐      ┌──────────────────┐
                   │  Portal  │      │  API Gateway    │      │  Vendor Knowledge│
                   │ (Next.js)│─────▶│  (Express)      │      │  Agent (ingest)  │
                   └──────────┘TB-03 └────────┬────────┘      └────────┬─────────┘
                                              │  TB-04                  │
                                              ▼                         │
                                   ┌─────────────────────┐              │
                                   │  Engineering        │              │
                                   │  Orchestrator       │◀─────────────┘
                                   └──────┬──────────────┘
                                          │  TB-05 (mTLS + message queue)
                         ┌────────────────┼────────────────┬────────────────┐
                         ▼                ▼                ▼                ▼
                  ┌──────────┐   ┌──────────────┐  ┌──────────┐   ┌────────────┐
                  │ Vendor   │   │Troubleshoot- │  │Integrat- │   │ Analysis   │
                  │Knowledge │   │  ing Agent   │  │ion Agent │   │  Agent     │
                  │  Agent   │   └──────┬───────┘  └────┬─────┘   └─────┬──────┘
                  └────┬─────┘         │  TB-06         │  TB-07        │
                       │               ▼                ▼               │
                       │      ┌─────────────┐  ┌──────────────────┐    │
                       │      │ LLM Gateway │  │ External IT      │    │
                       │      │ (provider   │  │ Systems          │    │
                       │      │  abstraction│  │ (ServiceNow,     │    │
                       │      │  + caching) │  │  PagerDuty, etc.)│    │
                       │      └──────┬──────┘  └──────────────────┘    │
                       │             │  TB-06                           │
                       │             ▼                                  │
                       │      ┌─────────────┐                          │
                       │      │ LLM Providers│                         │
                       │      │ (OpenAI,    │                          │
                       │      │  Anthropic, │                          │
                       │      │  Azure AI)  │                          │
                       │      └─────────────┘                          │
                       │                                                │
                       └───────────────────┬────────────────────────────┘
                                           │  TB-11 (mTLS + dynamic credentials)
                              ┌────────────▼──────────────────────────────┐
                              │  MULTI-TENANT DATA PLANE                   │
                              │  ┌──────────┐ ┌──────────┐ ┌───────────┐ │
                              │  │ PostgreSQL│ │  Vector  │ │  Message  │ │
                              │  │ (RLS/     │ │   DB     │ │   Queue   │ │
                              │  │  schema)  │ │(tenant-  │ │ (Kafka /  │ │
                              │  │           │ │ isolated)│ │  SQS)     │ │
                              │  └──────────┘ └──────────┘ └───────────┘ │
                              │  ┌──────────┐ ┌──────────────────────┐   │
                              │  │ Object   │ │  Audit Log (WORM)    │   │
                              │  │  Store   │ │                      │   │
                              │  └──────────┘ └──────────────────────┘   │
                              └───────────────────────────────────────────┘
                                           │  TB-12
                              ┌────────────▼──────────┐
                              │  HashiCorp Vault       │
                              │  (Secrets + BYOK keys) │
                              └───────────────────────┘
```

---

## 5. STRIDE Threat Catalogue

Threat ID format: `TH-<CATEGORY>-<NNN>`

### 5.1 Spoofing

Spoofing threats involve an adversary impersonating a legitimate actor to gain unauthorised access.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-S-001 | Portal / API | **Identity spoofing via credential stuffing.** Attacker automates login attempts using leaked credential lists to compromise tenant user accounts lacking MFA. | S | High | High | **Critical** |
| TH-S-002 | API | **JWT forgery.** Attacker crafts or modifies a JWT (e.g., `alg:none` attack, key confusion between RS256/HS256) to authenticate as an arbitrary user or tenant. | S | Medium | Critical | **Critical** |
| TH-S-003 | API / Orchestrator | **Service impersonation.** A compromised pod presents a forged service identity to another internal service by replaying a stolen service-account token. | S | Low | Critical | **High** |
| TH-S-004 | Integration Agent | **Vendor feed spoofing.** Attacker publishes a malicious vendor knowledge feed that IIVKIS trusts, injecting false advisories or malware-linked "patches". | S | Medium | High | **High** |
| TH-S-005 | API (inbound webhooks) | **Webhook replay attack.** Attacker captures a legitimate webhook request from an external system and replays it to inject duplicate or malicious events. | S | Medium | Medium | **Medium** |
| TH-S-006 | LLM Gateway | **LLM provider impersonation.** Attacker performs a MITM or DNS hijack to intercept LLM API calls, serving crafted completions to manipulate AI outputs. | S | Low | High | **Medium** |
| TH-S-007 | CI/CD Pipeline | **Pipeline credential theft.** Attacker steals a CI/CD service account token or secret and authenticates as the pipeline to deploy malicious container images. | S | Low | Critical | **High** |
| TH-S-008 | Super-Admin Portal | **Operator account takeover.** Attacker phishes or brute-forces a platform super-admin account to gain cross-tenant control. | S | Low | Critical | **High** |

---

### 5.2 Tampering

Tampering threats involve unauthorised modification of data or code.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-T-001 | Data Plane (DB) | **SQL/NoSQL injection.** Attacker injects malicious query payloads through the API to read, modify, or delete tenant data. | T | Medium | Critical | **Critical** |
| TH-T-002 | LLM Gateway | **Prompt injection.** Attacker embeds adversarial instructions in user-controlled input (incident description, chat message) that manipulate the LLM to produce harmful outputs, exfiltrate tenant data, or bypass guardrails. | T | High | High | **Critical** |
| TH-T-003 | Vendor Knowledge Agent | **Knowledge base poisoning.** A malicious or compromised vendor feed inserts false or misleading knowledge articles that propagate to AI-generated resolution plans, causing incorrect remediation actions. | T | Medium | High | **High** |
| TH-T-004 | Correlation Engine | **Signal injection.** Attacker with access to a monitored external IT system sends crafted alerts to manipulate correlation results and suppress or forge root-cause candidates. | T | Medium | High | **High** |
| TH-T-005 | Audit Log | **Audit log tampering.** Attacker with DB-level or object-store-level access modifies or deletes audit log entries to cover tracks. | T | Low | Critical | **High** |
| TH-T-006 | CI/CD Pipeline | **Supply-chain tampering.** Attacker compromises a third-party npm package (dependency confusion, typosquatting) introducing malicious code into the build artefact. | T | Medium | Critical | **Critical** |
| TH-T-007 | Message Queue | **Message queue tampering.** Attacker with queue access injects, replays, or modifies agent task messages to alter Orchestrator behaviour. | T | Low | High | **Medium** |
| TH-T-008 | API | **CSRF attack on portal actions.** Attacker tricks an authenticated user into executing unintended state-changing API requests via a malicious page. | T | Medium | Medium | **Medium** |
| TH-T-009 | Configuration store | **Feature flag tampering.** Attacker modifies feature flags to enable restricted capabilities for unauthorised tenants. | T | Low | High | **Medium** |

---

### 5.3 Repudiation

Repudiation threats involve denial of actions — inability to prove who did what.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-R-001 | API / Data Plane | **Action repudiation by tenant user.** A user performs a destructive action (delete incident, modify SLA policy) and later claims the action was not performed — audit record absent or incomplete. | R | Medium | High | **High** |
| TH-R-002 | LLM Gateway | **LLM interaction repudiation.** A user claims they never issued an AI query that produced a harmful or erroneous output — no immutable record of the prompt/completion exchange exists. | R | Medium | Medium | **Medium** |
| TH-R-003 | Integration Agent | **Integration event repudiation.** External system disputes that it sent an event; IIVKIS cannot prove receipt because webhook request bodies are not durably logged. | R | Low | Medium | **Low** |
| TH-R-004 | Billing Engine | **Usage metering repudiation.** Tenant disputes a billing charge citing incorrect usage meters — no tamper-evident metering record available for audit. | R | Medium | High | **High** |
| TH-R-005 | Super-Admin Portal | **Administrative action repudiation.** Platform operator makes a cross-tenant configuration change (e.g., suspending a tenant) without a durable, attributable audit record. | R | Low | Critical | **High** |

---

### 5.4 Information Disclosure

Information disclosure threats involve exposure of data to unauthorised parties.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-I-001 | API / Data Plane | **Tenant data leakage via broken tenant isolation.** Bug in row-level security or missing tenant-scoping predicate allows Tenant A to query Tenant B's incidents, knowledge, or configuration. | I | Medium | Critical | **Critical** |
| TH-I-002 | LLM Gateway | **PII exfiltration via LLM prompt/completion logs.** Incident descriptions or chat messages containing PII are logged without redaction and accessible to unauthorised operators or exported. | I | High | High | **Critical** |
| TH-I-003 | API | **Error message information leakage.** Verbose stack traces, database error messages, or internal path details returned in API error responses reveal system internals to attackers. | I | High | Medium | **High** |
| TH-I-004 | Vector Store | **Cross-tenant vector search leakage.** A query in Tenant A's context returns vector embeddings belonging to Tenant B due to shared index with missing namespace filters. | I | Medium | Critical | **Critical** |
| TH-I-005 | Secrets / Config | **Secrets exposed in container environment variables or source code.** Developer accidentally commits API keys, DB passwords, or LLM provider keys. | I | Medium | Critical | **Critical** |
| TH-I-006 | Integration Agent | **Credential leakage via API response.** Integration configuration (API keys for ServiceNow, Datadog) returned in REST API responses (GET /integrations) instead of redacted. | I | Medium | High | **High** |
| TH-I-007 | Analytics API | **Cross-tenant analytics leakage.** Read-only analytics API exposes aggregate metrics that allow inference of other tenants' activity or usage. | I | Low | High | **Medium** |
| TH-I-008 | Notification Service | **Notification content exposure.** Notification messages containing incident details sent to incorrect recipients due to misconfigured escalation policies. | I | Low | High | **Medium** |
| TH-I-009 | Audit Logs | **Audit log exfiltration.** Attacker with read access to cold-archive storage (e.g., S3 bucket) exfiltrates years of audit logs containing actor/resource/IP data. | I | Low | High | **Medium** |
| TH-I-010 | Portal (SSR) | **Server-side rendering data exposure.** Next.js server-side props inadvertently embed secrets or cross-tenant data into the initial HTML payload. | I | Low | High | **Medium** |

---

### 5.5 Denial of Service

Denial-of-service threats impact availability of the platform.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-D-001 | API | **HTTP flood / volumetric DDoS.** High-volume request flood targeting the public API overwhelms ingress capacity and degrades service for all tenants. | D | High | High | **Critical** |
| TH-D-002 | LLM Gateway | **LLM token budget exhaustion.** Attacker or runaway process exhausts a tenant's token budget (or platform-wide budget) causing all AI features to fail for that tenant. | D | High | Medium | **High** |
| TH-D-003 | Correlation Engine | **Signal flood.** Attacker sends tens of thousands of synthetic alerts through a compromised integration endpoint, overwhelming the Correlation Engine and causing legitimate signal processing delay. | D | Medium | High | **High** |
| TH-D-004 | Message Queue | **Queue depth bomb.** Attacker injects millions of messages into the task queue, exhausting storage and consumer processing capacity. | D | Low | High | **Medium** |
| TH-D-005 | Database | **Resource exhaustion via complex queries.** Attacker crafts API requests that trigger expensive database queries (unindexed sort, large joins) consuming CPU/memory and causing latency spikes for all tenants. | D | Medium | High | **High** |
| TH-D-006 | Billing Engine | **Billing event flood.** Attacker or misconfigured client generates an extreme volume of usage events, causing metering pipeline backlog and delayed invoicing. | D | Low | Medium | **Low** |
| TH-D-007 | Vendor Knowledge Agent | **Feed ingestion bomb.** Attacker compromises a vendor feed URL to return an enormous payload (GB-scale XML) that exhausts ingestion worker memory. | D | Low | Medium | **Low** |
| TH-D-008 | Portal | **Slow-loris / connection exhaustion.** Attacker opens thousands of slow connections to the portal, consuming Node.js connection slots without completing requests. | D | Medium | Medium | **Medium** |

---

### 5.6 Elevation of Privilege

Elevation-of-privilege threats involve gaining capabilities beyond what is authorised.

| Threat ID | Component | Threat Description | STRIDE | Likelihood | Impact | Risk |
|---|---|---|---|---|---|---|
| TH-E-001 | API | **Horizontal privilege escalation (IDOR).** Attacker uses a valid JWT to access or modify resources belonging to a different tenant or user by manipulating resource IDs in the URL. | E | High | Critical | **Critical** |
| TH-E-002 | API | **Vertical privilege escalation.** Attacker exploits a broken access control check to perform admin-only operations (e.g., suspend tenant, access audit logs) using a non-admin token. | E | Medium | Critical | **Critical** |
| TH-E-003 | LLM Gateway | **Prompt injection privilege escalation.** Attacker embeds instructions in user input that convince the LLM to output commands the Orchestrator or a downstream agent executes with elevated privileges. | E | Medium | Critical | **Critical** |
| TH-E-004 | Kubernetes | **Container breakout.** Attacker exploits a vulnerability in a container runtime or misconfigured `securityContext` to escape the container and access the host node. | E | Low | Critical | **High** |
| TH-E-005 | Vault | **Vault policy misconfiguration.** A service account is granted an overly broad Vault policy, allowing it to read secrets belonging to other services or tenants. | E | Low | Critical | **High** |
| TH-E-006 | OPA / RBAC | **OPA policy bypass.** A bug in an OPA Rego policy allows an `ops-engineer` role user to access admin endpoints or cross-tenant resources. | E | Low | Critical | **High** |
| TH-E-007 | Tenant Administration | **Tenant admin acting across tenant boundary.** A tenant admin discovers an API endpoint that accepts a `tenantId` parameter without server-side validation, allowing them to manage another tenant's resources. | E | Medium | Critical | **Critical** |
| TH-E-008 | Super-Admin Portal | **Super-admin role abuse.** Malicious insider or compromised super-admin account performs destructive actions (deletes tenants, exfiltrates all data) with no automated guard or dual-approval. | E | Low | Critical | **High** |
| TH-E-009 | CI/CD | **Pipeline → production escalation.** Attacker with write access to a CI pipeline script injects commands that push a backdoored image to production bypassing staging gates. | E | Low | Critical | **High** |
| TH-E-010 | Billing Engine | **Billing manipulation.** Attacker or compromised billing-admin account applies fraudulent credits or discount codes to arbitrarily reduce charges for a tenant. | E | Low | High | **Medium** |

---

## 6. Mitigation Controls

### 6.1 RBAC — Role-Based Access Control

RBAC is the primary authorisation mechanism across all tenant-scoped operations.

#### 6.1.1 Role Hierarchy

```
Platform Level
└── super-admin                (all tenants, all resources — dual-approval required)
    └── platform-operator      (read-only across tenants; infra operations)

Tenant Level
├── tenant-admin               (all resources within own tenant)
│   ├── billing-admin          (billing + subscription only)
│   ├── ops-engineer           (incidents, knowledge, analytics — no admin/billing)
│   └── read-only              (read all; no write, no admin)
└── [custom roles]             (tenant-defined via FR-MT-021)
```

#### 6.1.2 RBAC Enforcement Points

| Enforcement Point | Mechanism | Threats Mitigated |
|---|---|---|
| API Gateway | JWT claim verification (`role`, `tenant_id`) | TH-S-002, TH-E-001, TH-E-002 |
| OPA Sidecar | Rego policy evaluation per request | TH-E-001, TH-E-002, TH-E-006, TH-E-007 |
| Database (RLS) | Row-level security enforces `tenant_id` predicate | TH-I-001, TH-E-001, TH-E-007 |
| Kubernetes RBAC | Namespace-scoped service account permissions | TH-E-004, TH-S-003 |
| Vault Policies | Service-scoped secret access | TH-E-005, TH-I-005 |

#### 6.1.3 Key Policies

- All API endpoints require a valid JWT with `tenant_id` and `role` claims; no endpoint may be invoked without a verified tenant context (NFR-SEC-012, FR-MT-002).
- The `tenant_id` claim is **never** sourced from the request body or URL parameter — only from the verified JWT (mitigates TH-E-007).
- Super-admin operations that affect tenant data require **dual approval** via a privileged access workflow and are rate-limited and alerted in real time (mitigates TH-E-008).
- Custom roles created by `tenant-admin` cannot exceed the permissions of the `tenant-admin` role itself (no role escalation by definition).

---

### 6.2 mTLS — Mutual TLS

All internal service-to-service communication operates within a service mesh enforcing mTLS.

#### 6.2.1 Certificate Management

| Aspect | Implementation |
|---|---|
| Certificate authority | Dedicated intermediate CA per cluster (issued by root CA in Vault PKI) |
| Certificate issuance | Automatic via service mesh SPIFFE/SPIRE identity |
| SVID format | X.509 SVID with `spiffe://cluster/ns/service-name` URI SAN |
| Rotation | Automatic; short-lived certs (24-hour TTL) rotated before expiry |
| Revocation | CRL + OCSP stapling; Vault PKI tidy job runs every 6 hours |

#### 6.2.2 mTLS Scope

```
Portal ──(TLS 1.3, one-way)──▶ API Gateway
API Gateway ──(mTLS)──▶ Orchestrator
Orchestrator ──(mTLS)──▶ Agents (all four)
Agents ──(mTLS)──▶ Data Plane (DB, queue, object store)
All Services ──(mTLS)──▶ Vault
All Services ──(mTLS)──▶ OPA decision endpoint
```

External services (LLM providers, external IT systems, vendor feeds, payment processors) receive one-way TLS 1.3 with server certificate pinning where supported.

#### 6.2.3 Threats Mitigated

| Threat ID | How mTLS Mitigates |
|---|---|
| TH-S-003 | Services must present a valid X.509 identity certificate — forged identities are rejected |
| TH-T-007 | Queue consumers validate mTLS identity before accepting messages |
| TH-I-001 | All internal data flows encrypted; passive eavesdropping impossible |
| TH-E-004 | Container escape alone is insufficient — attacker also needs valid SPIFFE certificate |

---

### 6.3 Vault — Secrets Management

HashiCorp Vault (or cloud-native equivalent) is the authoritative secrets store for all credentials, encryption keys, and API tokens.

#### 6.3.1 Secret Categories

| Secret Type | Vault Path | Rotation Policy |
|---|---|---|
| Database credentials | `db/<env>/<service>/creds` | Dynamic — 1-hour TTL, auto-renewed |
| LLM provider API keys | `secret/llm/<tenant_id>/<provider>` | Manual — quarterly review |
| Integration credentials (ServiceNow, Datadog…) | `secret/integration/<tenant_id>/<system>` | Manual — on change |
| Message queue credentials | `secret/queue/<env>/<service>` | Dynamic — 1-hour TTL |
| JWT signing keys (RS256) | `transit/iivkis-jwt` | Rotation every 30 days; old key retained for verification during transition |
| mTLS intermediate CA | `pki/intermediate` | CA cert renewed 30 days before expiry |
| Tenant BYOK encryption keys | `keymgmt/tenant/<tenant_id>` | Tenant-managed; Vault wraps/seals |
| Stripe API keys | `secret/billing/stripe/<env>` | Manual — quarterly review |

#### 6.3.2 Access Control

- **Kubernetes auth method:** pods authenticate using projected service account tokens; Vault validates the token against the K8s API.
- **Vault policies:** principle of least privilege — each service has a policy granting access to only the paths it requires.
- **Audit logging:** every Vault operation (read, write, renew, revoke) is written to an immutable audit log shipped to SIEM.
- **Break-glass access:** emergency access procedure requires dual approval, produces an alert, and is time-limited to 1 hour.

#### 6.3.3 Threats Mitigated

| Threat ID | How Vault Mitigates |
|---|---|
| TH-I-005 | No secrets in source code, environment vars, or config maps |
| TH-E-005 | Vault policies scoped per service; misconfiguration surfaces in audit log |
| TH-S-007 | CI/CD uses OIDC workload identity; short-lived tokens issued by Vault |
| TH-T-006 | Dynamic credentials mean stolen credentials expire quickly |

---

### 6.4 WAF — Web Application Firewall

A cloud-native WAF is deployed at the ingress layer in front of all public endpoints (Portal, API, Inbound Webhooks).

#### 6.4.1 Rule Sets

| Rule Category | Coverage | Threats Mitigated |
|---|---|---|
| **OWASP Core Rule Set (CRS) 3.3+** | SQLi, XSS, CSRF, command injection, path traversal | TH-T-001, TH-T-008 |
| **DDoS / rate limiting** | IP-based + tenant-based request rate limits; volumetric flood blocking | TH-D-001, TH-D-008 |
| **Geo / IP reputation** | Block known malicious ASNs and Tor exit nodes | TH-S-001 |
| **Payload size limits** | Max request body 10 MB; protects queue-flood and feed-bomb vectors | TH-D-007, TH-D-004 |
| **HTTP anomaly detection** | Malformed headers, HTTP verb abuse, protocol violations | TH-S-001 |
| **Bot mitigation** | CAPTCHA challenge for suspicious user-agents, credential-stuffing patterns | TH-S-001 |
| **Custom IIVKIS rules** | Block prompt injection patterns in request bodies; block known SSRF destinations | TH-T-002, TH-I-003 |

#### 6.4.2 WAF Modes

| Traffic Type | WAF Mode |
|---|---|
| Portal HTTP | Prevention mode (block + log) |
| API REST | Prevention mode (block + log) |
| Inbound webhooks | Prevention mode — additionally validates `X-Hub-Signature-256` header present |
| Admin portal | Prevention mode + geo-restriction to operator IP ranges |

#### 6.4.3 Logging & Alerting

- All WAF blocked events are shipped to the SIEM within 60 seconds.
- Burst detection: > 100 blocks from a single IP in 60 seconds triggers a **High** alert.
- All allowed requests are logged with source IP, user-agent, tenant (from JWT), and latency for anomaly detection.

---

### 6.5 OPA — Open Policy Agent

OPA is deployed as a sidecar or remote decision point providing centralised, auditable policy enforcement beyond simple RBAC.

#### 6.5.1 Policy Domains

| Policy Domain | Description | Threats Mitigated |
|---|---|---|
| **Tenant isolation** | Every API request that touches a data resource must carry a `tenant_id` matching the resource's `tenant_id`; cross-tenant reads/writes are denied | TH-I-001, TH-E-001, TH-E-007 |
| **Role-action mapping** | Maps `role` claim to allowed HTTP method + path combinations; anything not explicitly allowed is denied | TH-E-002, TH-E-006 |
| **Admin dual-approval** | Super-admin destructive operations (tenant delete, mass data export) require a second approver claim in the request context | TH-E-008 |
| **Data residency** | Blocks writes to a data store region that does not match the tenant's configured `data_region` | TH-I-001 (residency) |
| **Integration secret visibility** | Denies read of integration credentials (API keys) from the API response layer; only write (create/update) is permitted for the stored value | TH-I-006 |
| **LLM input gate** | Evaluates incoming prompt payload for prompt-injection patterns using a rule set before forwarding to the LLM provider | TH-T-002, TH-E-003 |
| **Rate limit policy** | Per-tenant per-endpoint rate limits with OPA evaluating current counter from Redis | TH-D-001, TH-D-003 |
| **K8s admission** | OPA Gatekeeper constraints: no privileged containers, no `hostPath` mounts, all images from approved registry, all pods have resource limits | TH-E-004, TH-T-006 |

#### 6.5.2 Policy Lifecycle

```
Policy authored in Rego
        │
        ▼
Linted + unit tested (OPA test runner, coverage ≥ 90%)
        │
        ▼
Merged via PR (peer review required)
        │
        ▼
OPA bundle built in CI → published to bundle server
        │
        ▼
OPA agent polls bundle server (every 30 s)
        │
        ▼
Policy active in < 60 s from merge
```

#### 6.5.3 Decision Logging

- Every OPA `allow` and `deny` decision is structured-logged with: `input.method`, `input.path`, `input.tenant_id`, `input.role`, `decision`, `rule`, `timestamp`.
- OPA decision logs feed into the SIEM for anomaly detection (e.g., repeated deny from the same principal signals an exploitation attempt).

---

## 7. Risk Register

Risk ratings are derived from the 5×5 Likelihood × Impact matrix below.

### 7.1 Rating Matrix

| | **Impact 1 — Negligible** | **Impact 2 — Minor** | **Impact 3 — Moderate** | **Impact 4 — High** | **Impact 5 — Critical** |
|---|---|---|---|---|---|
| **Likelihood 5 — Almost Certain** | Low | Medium | High | Critical | Critical |
| **Likelihood 4 — Likely** | Low | Medium | High | Critical | Critical |
| **Likelihood 3 — Possible** | Low | Medium | Medium | High | Critical |
| **Likelihood 2 — Unlikely** | Low | Low | Medium | High | High |
| **Likelihood 1 — Rare** | Low | Low | Low | Medium | High |

### 7.2 Risk Register Table

| Threat ID | Description (short) | Likelihood | Impact | Inherent Risk | Primary Controls | Residual Risk |
|---|---|---|---|---|---|---|
| TH-S-001 | Credential stuffing | 4 | 4 | Critical | MFA enforcement (FR-IAM-004), WAF bot mitigation, account lockout | Medium |
| TH-S-002 | JWT forgery | 3 | 5 | Critical | RS256 only, `alg` claim enforcement, JWKS rotation via Vault | Low |
| TH-S-003 | Service impersonation | 2 | 5 | High | mTLS SPIFFE identity, short-lived certs | Low |
| TH-S-004 | Vendor feed spoofing | 3 | 4 | High | Feed signature verification, content validation pipeline | Medium |
| TH-S-005 | Webhook replay attack | 3 | 3 | Medium | HMAC-SHA256 + 5-min replay window (FR-INT-009) | Low |
| TH-S-006 | LLM provider MITM | 2 | 4 | High | TLS 1.3, certificate pinning, HSTS | Low |
| TH-S-007 | CI/CD credential theft | 2 | 5 | High | OIDC workload identity, Vault short-lived tokens, no long-lived CI secrets | Low |
| TH-S-008 | Super-admin account takeover | 2 | 5 | High | MFA (hardware key required), IP restriction, session monitoring | Low |
| TH-T-001 | SQL/NoSQL injection | 3 | 5 | Critical | Parameterised queries, ORM, WAF CRS, input validation (NFR-SEC-010) | Low |
| TH-T-002 | Prompt injection | 4 | 4 | Critical | OPA LLM input gate, WAF custom rules, output guardrails (NFR-SEC-014) | Medium |
| TH-T-003 | Knowledge base poisoning | 3 | 4 | High | Feed provenance tracking, human-review queue for unverified sources | Medium |
| TH-T-004 | Signal injection | 3 | 4 | High | HMAC webhook auth, integration IP allowlist (FR-INT-009/010), confidence thresholds | Medium |
| TH-T-005 | Audit log tampering | 2 | 5 | High | WORM storage (NFR-SEC-021), append-only log, Vault seal | Low |
| TH-T-006 | Supply chain tampering | 3 | 5 | Critical | Dependency CVE scanning (NFR-SEC-033), SBOM, image signing (Sigstore/Cosign), OPA admission | Medium |
| TH-T-007 | Message queue tampering | 2 | 4 | High | mTLS on queue connections, queue auth, message signing | Low |
| TH-T-008 | CSRF | 3 | 3 | Medium | SameSite=Strict cookies, CSRF tokens, CORS policy | Low |
| TH-T-009 | Feature flag tampering | 2 | 4 | High | OPA policy on config mutations, Vault-backed feature store | Low |
| TH-R-001 | Action repudiation | 3 | 4 | High | Immutable audit log per action (NFR-SEC-020), structured log fields | Low |
| TH-R-002 | LLM interaction repudiation | 3 | 3 | Medium | Prompt/completion logging with PII redaction (FR-LLM-005) | Low |
| TH-R-003 | Integration event repudiation | 2 | 3 | Medium | Durable webhook receipt log, event fingerprinting (FR-INT-006) | Low |
| TH-R-004 | Usage metering repudiation | 3 | 4 | High | Tamper-evident usage ledger, real-time aggregation with audit trail | Low |
| TH-R-005 | Admin action repudiation | 2 | 5 | High | Super-admin audit log (NFR-SEC-020), dual-approval workflow, OPA decision log | Low |
| TH-I-001 | Tenant data leakage | 3 | 5 | Critical | RLS (per-tenant predicate), OPA tenant-isolation policy, JWT tenant claim enforcement | Low |
| TH-I-002 | PII in LLM logs | 4 | 4 | Critical | PII detection + redaction before logging (NFR-COMP-004, FR-LLM-005) | Medium |
| TH-I-003 | Error message leakage | 4 | 3 | High | Generic error responses (no stack traces externally), structured internal error logging | Low |
| TH-I-004 | Cross-tenant vector leakage | 3 | 5 | Critical | Tenant-isolated vector indexes / strict namespace (FR-VK-010), OPA guard on search | Low |
| TH-I-005 | Secrets in source/env | 3 | 5 | Critical | Vault for all secrets, pre-commit secret-detection hook, CI secret scan | Low |
| TH-I-006 | Integration credential exposure | 3 | 4 | High | OPA policy blocks credential read in API responses (FR-INT-003) | Low |
| TH-I-007 | Cross-tenant analytics leakage | 2 | 4 | High | Analytics queries scoped to `tenant_id`, OPA read policy | Low |
| TH-I-008 | Notification misdirection | 2 | 4 | High | Notification policy validation, recipient list audit logging | Low |
| TH-I-009 | Audit log exfiltration | 2 | 4 | High | Object store bucket policies (private), Vault-managed access keys, access monitoring | Low |
| TH-I-010 | SSR data exposure | 2 | 4 | High | No secrets in `getServerSideProps`; server-side Vault-only secret retrieval | Low |
| TH-D-001 | HTTP flood / DDoS | 4 | 4 | Critical | WAF + DDoS scrubbing (cloud provider), rate limiting (NFR-SEC-012), auto-scaling | Medium |
| TH-D-002 | LLM token budget exhaustion | 4 | 3 | High | Per-tenant token budget enforcement (FR-LLM-006), real-time budget check at gateway | Low |
| TH-D-003 | Correlation engine signal flood | 3 | 4 | High | Inbound rate limit per integration endpoint, WAF payload size limit | Medium |
| TH-D-004 | Queue depth bomb | 2 | 4 | High | Queue depth alerting (NFR-OBS-004), per-publisher quota, DLQ | Low |
| TH-D-005 | Expensive DB queries | 3 | 4 | High | Query timeout enforcement, resource-governor, parameterised queries only | Low |
| TH-D-006 | Billing event flood | 2 | 3 | Medium | Event deduplication (FR-INT-006), metering pipeline backpressure | Low |
| TH-D-007 | Feed ingestion bomb | 2 | 3 | Medium | Streaming parser, max feed size limit (100 MB), WAF payload limit | Low |
| TH-D-008 | Slow-loris | 3 | 3 | Medium | Connection timeout (30 s), max connections per IP, WAF HTTP anomaly rules | Low |
| TH-E-001 | IDOR / horizontal escalation | 4 | 5 | Critical | OPA tenant-isolation policy, server-side `tenant_id` from JWT only | Low |
| TH-E-002 | Vertical privilege escalation | 3 | 5 | Critical | OPA role-action mapping, deny-by-default policy | Low |
| TH-E-003 | Prompt injection privilege escalation | 3 | 5 | Critical | OPA LLM input gate, guardrails, sandboxed agent execution | Medium |
| TH-E-004 | Container breakout | 2 | 5 | High | OPA Gatekeeper (no privileged containers), read-only root FS, seccomp profiles | Low |
| TH-E-005 | Vault policy misconfiguration | 2 | 5 | High | Vault policy linting, periodic Vault audit review, least-privilege by default | Low |
| TH-E-006 | OPA policy bypass | 2 | 5 | High | OPA unit tests (≥ 90% coverage), policy peer review, OPA decision log monitoring | Low |
| TH-E-007 | Cross-tenant admin abuse | 3 | 5 | Critical | `tenant_id` from JWT only (never request body), OPA tenant-isolation policy | Low |
| TH-E-008 | Super-admin abuse | 2 | 5 | High | Dual-approval workflow, hardware-MFA, session recording, real-time alert | Low |
| TH-E-009 | CI/CD pipeline escalation | 2 | 5 | High | Staging gate + explicit promotion approval (NFR-MAINT-008), image signing, OPA admission | Low |
| TH-E-010 | Billing manipulation | 2 | 4 | High | OPA billing policy, mandatory reason annotation (FR-BILL-023), audit log | Low |

---

## 8. Control Traceability Matrix

Maps each threat ID to its primary mitigation controls and the requirement IDs that mandate those controls.

| Threat ID | Risk | Primary Control(s) | Requirement IDs |
|---|---|---|---|
| TH-S-001 | Medium | MFA; WAF bot mitigation; account lockout | FR-IAM-004, NFR-SEC-012 |
| TH-S-002 | Low | RS256 JWT; `alg` enforcement; JWKS rotation via Vault | FR-IAM-001, FR-IAM-002, FR-IAM-007, NFR-SEC-003 |
| TH-S-003 | Low | mTLS SPIFFE; short-lived service certs | NFR-SEC-030 |
| TH-S-004 | Medium | Feed signature verification; provenance tagging | FR-VK-003, FR-INT-009 |
| TH-S-005 | Low | HMAC-SHA256; 5-min replay window | FR-INT-009 |
| TH-S-006 | Low | TLS 1.3; cert pinning; HSTS | NFR-SEC-001, NFR-SEC-013 |
| TH-S-007 | Low | OIDC workload identity; Vault short-lived tokens | NFR-SEC-003, NFR-MAINT-008 |
| TH-S-008 | Low | Hardware MFA; IP restriction; session monitoring | FR-IAM-004, FR-IAM-008, NFR-SEC-023 |
| TH-T-001 | Low | Parameterised queries; ORM; WAF CRS; input validation | NFR-SEC-010, NFR-SEC-011 |
| TH-T-002 | Medium | OPA LLM input gate; WAF custom rules; output guardrails | NFR-SEC-014, FR-LLM-016 |
| TH-T-003 | Medium | Provenance tracking; review queue for new sources | FR-VK-003, FR-VK-006 |
| TH-T-004 | Medium | HMAC webhook auth; IP allowlist; confidence thresholds | FR-INT-009, FR-INT-010, FR-CE-011 |
| TH-T-005 | Low | WORM storage; append-only log; Vault seal | NFR-SEC-021, NFR-SEC-022 |
| TH-T-006 | Medium | Dependency CVE scan; SBOM; Cosign image signing; OPA admission | NFR-SEC-033, NFR-MAINT-008 |
| TH-T-007 | Low | mTLS on queue; queue auth; message signing | NFR-SEC-030 |
| TH-T-008 | Low | SameSite=Strict; CSRF tokens; CORS | NFR-SEC-010, NFR-SEC-013 |
| TH-T-009 | Low | OPA config mutation policy; Vault-backed feature store | FR-ADMIN-005, NFR-SEC-020 |
| TH-R-001 | Low | Immutable audit log per action | NFR-SEC-020, NFR-SEC-021 |
| TH-R-002 | Low | Prompt/completion logging with PII redaction | FR-LLM-005, NFR-COMP-004 |
| TH-R-003 | Low | Durable webhook receipt log; event fingerprinting | FR-INT-006, NFR-SEC-020 |
| TH-R-004 | Low | Tamper-evident usage ledger; real-time aggregation | FR-BILL-010, FR-BILL-011, NFR-SEC-021 |
| TH-R-005 | Low | Super-admin audit log; dual-approval; OPA decision log | NFR-SEC-020, FR-ADMIN-002 |
| TH-I-001 | Low | RLS; OPA tenant-isolation policy; JWT `tenant_id` | FR-MT-001, FR-MT-002, NFR-SEC-020 |
| TH-I-002 | Medium | PII detection + redaction before log write | NFR-COMP-004, FR-LLM-005 |
| TH-I-003 | Low | Generic error responses; internal structured logging | NFR-SEC-010, NFR-SEC-013 |
| TH-I-004 | Low | Tenant-isolated vector indexes / namespacing | FR-VK-010 |
| TH-I-005 | Low | Vault for all secrets; secret-detection hooks; CI scan | NFR-SEC-003, NFR-MAINT-008 |
| TH-I-006 | Low | OPA integration-secret visibility policy | FR-INT-003 |
| TH-I-007 | Low | Analytics `tenant_id` scoping; OPA read policy | FR-AN-006 |
| TH-I-008 | Low | Notification policy validation; recipient audit log | FR-NOTIF-002, NFR-SEC-020 |
| TH-I-009 | Low | Bucket private ACL; Vault-managed keys; access monitoring | NFR-SEC-002, NFR-SEC-022 |
| TH-I-010 | Low | No secrets in SSR props; Vault-only server retrieval | NFR-SEC-003 |
| TH-D-001 | Medium | WAF + DDoS scrubbing; rate limiting; auto-scaling | NFR-SEC-012, NFR-SEC-032, NFR-SCALE-001 |
| TH-D-002 | Low | Per-tenant token budget; real-time enforcement | FR-LLM-006, FR-MT-005 |
| TH-D-003 | Medium | Inbound rate limit per integration; WAF payload limit | NFR-SEC-012, FR-CE-003 |
| TH-D-004 | Low | Queue depth alerting; per-publisher quota; DLQ | NFR-RES-021, NFR-OBS-004 |
| TH-D-005 | Low | Query timeout; resource governor; ORM | NFR-SEC-010, NFR-PERF-002 |
| TH-D-006 | Low | Event deduplication; metering pipeline backpressure | FR-INT-006 |
| TH-D-007 | Low | Streaming parser; max feed size; WAF payload limit | NFR-SEC-015 |
| TH-D-008 | Low | Connection timeout; max connections per IP; WAF | NFR-SEC-012, NFR-SEC-032 |
| TH-E-001 | Low | OPA tenant-isolation; server-side JWT `tenant_id` only | FR-MT-002, NFR-SEC-010 |
| TH-E-002 | Low | OPA role-action mapping; deny-by-default | FR-IAM-005, FR-MT-020 |
| TH-E-003 | Medium | OPA LLM input gate; guardrails; sandboxed agent execution | NFR-SEC-014, FR-LLM-016 |
| TH-E-004 | Low | OPA Gatekeeper; no privileged containers; seccomp | NFR-SEC-031, NFR-MAINT-006 |
| TH-E-005 | Low | Vault policy linting; least-privilege; audit review | NFR-SEC-003 |
| TH-E-006 | Low | OPA unit tests; policy peer review; decision log monitoring | NFR-SEC-031 |
| TH-E-007 | Low | `tenant_id` from JWT only; OPA tenant-isolation | FR-MT-002, FR-IAM-005 |
| TH-E-008 | Low | Dual-approval; hardware MFA; session recording; alert | FR-ADMIN-002, FR-IAM-004, NFR-SEC-023 |
| TH-E-009 | Low | Staging gate + promotion approval; image signing; OPA admission | NFR-MAINT-008, NFR-SEC-033 |
| TH-E-010 | Low | OPA billing policy; mandatory reason annotation; audit log | FR-BILL-023, NFR-SEC-020 |

---

## 9. Residual Risk & Acceptance Criteria

### 9.1 Residual Risk Summary

After applying all mitigation controls, the following threats carry **non-Low** residual risk. These are formally accepted, owned, and subject to ongoing review.

| Threat ID | Residual Risk | Rationale | Owner | Review Cadence |
|---|---|---|---|---|
| TH-S-001 | **Medium** | Credential stuffing risk persists for tenants that have not enforced MFA (MFA is enforceable but not mandatory for all plans). Mitigation: make MFA mandatory for Starter+ plans in v1.2. | Security Officer | Quarterly |
| TH-S-004 | **Medium** | Vendor feed spoofing risk persists: feed signature verification is implemented but cannot cover unsigned or newly onboarded feeds pending manual vetting. Mitigation: enforce mandatory feed signature policy for all new vendor onboarding in v1.2; human approval gate before first ingestion. | Security Officer + Knowledge Agent Team | Per new vendor onboarding |
| TH-T-002 | **Medium** | Prompt injection is an evolving attack vector with no complete defence. Defence-in-depth approach (WAF + OPA + guardrails) reduces but does not eliminate risk. Mitigation: continuous rule improvement; LLM output sandboxing in STEP 7. | Security Officer + AI Lead | Every release |
| TH-T-003 | **Medium** | Knowledge base poisoning via a compromised vendor feed cannot be fully automated away; human review is required for unverified sources. Mitigation: human-review queue implemented in STEP 3. | Knowledge Agent Team | Per ingestion pipeline change |
| TH-T-004 | **Medium** | Signal injection risk remains if a tenant fails to configure IP allowlist or HMAC on integrations. Mitigation: make HMAC mandatory (not optional) in v1.2. | Integration Team | Quarterly |
| TH-T-006 | **Medium** | Supply chain risk is systemic across the npm ecosystem. SBOM + Cosign + CVE scanning reduce but cannot eliminate zero-day risk. Mitigation: dependency update automation (Renovate) + STEP 10 pentest. | Platform Team | Weekly (automated) |
| TH-I-002 | **Medium** | PII redaction in LLM logs relies on pattern-matching; novel PII formats may escape detection. Mitigation: periodic red-team exercises against the redaction pipeline. | Privacy / Compliance | Quarterly |
| TH-D-001 | **Medium** | Sophisticated volumetric DDoS can exceed cloud WAF capacity. Mitigation: scrubbing service SLA with cloud provider; failover to secondary region. | Platform Team | Per major incident |
| TH-D-003 | **Medium** | A compromised integration endpoint can still flood signals up to the per-endpoint rate limit. Mitigation: anomaly-based inbound rate limiting in STEP 5. | Integration Team | Quarterly |
| TH-E-003 | **Medium** | LLM privilege escalation via prompt injection is partially mitigated but remains a residual risk pending full sandboxed agent execution in STEP 7. | Security Officer + AI Lead | Every release |

### 9.2 Acceptance Criteria for GA Launch

Before the platform can be released for General Availability:

1. **All Critical inherent-risk threats** must have residual risk rated **Low** or **Medium**. ✅ Achieved per §7.2.
2. **No more than 10 Medium residual risks** in the risk register. ✅ 10 Medium residual risks recorded.
3. **A third-party penetration test** must be completed and all Critical / High findings remediated (NFR-SEC-011).
4. **OPA policy test coverage ≥ 90%** for all tenant-isolation, role-action-mapping, and LLM-gate policies.
5. **Vault audit logging** must be active and shipping to SIEM before any production traffic.
6. **mTLS enforced** across all internal service-to-service communication with zero plain-text internal traffic.
7. **Secrets audit** confirms no secrets in source code, environment variables, or Kubernetes ConfigMaps.

---

## Appendix A — Trust Boundary Diagram

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  UNTRUSTED ZONE (Internet)                                                    ║
║  ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐  ║
║  │ Browser  │  │ External IT Sys  │  │ Vendor Feed  │  │ Payment Process  │  ║
║  └────┬─────┘  └────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘  ║
╚═══════╪═════════════════╪═══════════════════╪══════════════════╪═════════════╝
        │ TB-01: WAF+TLS  │ TB-08: HMAC+TLS   │ TB-09: TLS+Sig   │ TB-10: TLS
╔═══════╪═════════════════╪═══════════════════╪══════════════════╪═════════════╗
║  DMZ / INGRESS LAYER    │                   │                  │             ║
║  ┌────▼─────┐  ┌────────▼─────────┐         │                  │             ║
║  │ Portal   │  │  API Gateway     │◀────────┘                  │             ║
║  │(Next.js) │  │  (Express)       │                            │             ║
║  └────┬─────┘  └────────┬─────────┘                            │             ║
╚═══════╪════════════════╪══════════════════════════════════════╪═════════════╝
        │ TB-03: HTTPS+JWT│ TB-04: mTLS                          │ TB-10
╔═══════╪════════════════╪═══════════════════════════════════════╪═════════════╗
║  TRUSTED INTERNAL CLUSTER (mTLS mesh — all traffic mutually authenticated)   ║
║  ┌────▼─────────────────▼─────┐                ┌──────────────▼────────────┐ ║
║  │  Engineering Orchestrator  │                │  Billing Engine           │ ║
║  └──────────────┬─────────────┘                └───────────────────────────┘ ║
║                 │ TB-05: mTLS + queue auth                                   ║
║   ┌─────────────┼───────────────┬─────────────────┐                         ║
║   ▼             ▼               ▼                  ▼                         ║
║ ┌──────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐                      ║
║ │Vendor│  │Trouble-  │  │Integrat- │  │ Analysis     │                      ║
║ │Know- │  │shooting  │  │ion Agent │  │ Agent        │                      ║
║ │ledge │  │  Agent   │  └────┬─────┘  └──────────────┘                      ║
║ │Agent │  └────┬─────┘       │ TB-07: TLS+OAuth                             ║
║ └──┬───┘       │ TB-06: TLS  └─────────────────────────────────▶ Ext. IT    ║
║    │           ▼                                                              ║
║    │   ┌─────────────────┐                                                   ║
║    │   │   LLM Gateway   │──TB-06: TLS+APIkey──▶ LLM Providers               ║
║    │   └─────────────────┘                                                   ║
║    │                                                                          ║
║    └───────────┬────────────────────────────────────────────────┐            ║
║                │ TB-11: mTLS + dynamic credentials              │            ║
║   ┌────────────▼───────────────────────────────────────────┐    │            ║
║   │  MULTI-TENANT DATA PLANE                               │    │            ║
║   │  PostgreSQL(RLS) │ Vector DB │ Message Queue │ Objects  │    │            ║
║   │  Audit Log(WORM) │                                     │    │            ║
║   └─────────────────────────────────────────────────────────┘    │            ║
║                                                              TB-12: mTLS      ║
║   ┌──────────────────────────────────────────────────────────────▼──────────┐║
║   │  HashiCorp Vault (Secrets + PKI + Transit Encryption + BYOK)            │║
║   └──────────────────────────────────────────────────────────────────────────┘║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## Appendix B — Attack Surface Summary

| Surface | Entry Points | Auth Mechanisms | Notes |
|---|---|---|---|
| **Portal** | Browser HTTPS | JWT (session cookie, SameSite=Strict) | CDN + WAF in front |
| **REST API** | External HTTPS | JWT bearer; API key | Rate limited; CORS restricted |
| **Inbound Webhooks** | External HTTPS POST | HMAC-SHA256; IP allowlist | Replay-window check |
| **Admin Portal** | External HTTPS (IP-restricted) | Hardware MFA + OIDC; OPA admin policy | Dual-approval for destructive ops |
| **Vendor Feed Ingestion** | HTTPS pull (scheduled) | Feed URL + TLS; optional signature | Size limit; content validation |
| **Inter-Service** | Internal cluster only | mTLS (SPIFFE/SPIRE) | No plain-text internal traffic |
| **Data Plane** | Internal cluster only | mTLS + dynamic DB credentials (Vault) | RLS enforced |
| **Vault** | Internal cluster only | K8s service account token | Audit log on all access |
| **LLM Providers** | Outbound HTTPS | API key (Vault-managed) | TLS 1.3; DPA in place |
| **Payment Processor** | Outbound HTTPS | API key (Vault-managed); webhook signature | PCI-DSS delegated |
| **CI/CD** | GitHub Actions / equivalent | OIDC workload identity | Staging gate + promotion approval |

---

## Appendix C — STRIDE Quick-Reference

| Category | Key Question | Example Attack |
|---|---|---|
| **Spoofing** | Can an attacker pretend to be someone they are not? | JWT forgery, credential stuffing |
| **Tampering** | Can an attacker modify data or code? | SQL injection, prompt injection, supply chain |
| **Repudiation** | Can an actor deny having performed an action? | Missing audit log, log tampering |
| **Information Disclosure** | Can an attacker access data they should not? | IDOR, cross-tenant leakage, secrets in env vars |
| **Denial of Service** | Can an attacker make the system unavailable? | DDoS flood, token budget exhaustion |
| **Elevation of Privilege** | Can an attacker gain permissions they do not have? | IDOR, broken RBAC, prompt injection escalation |
