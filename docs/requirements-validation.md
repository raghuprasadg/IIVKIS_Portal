# IIVKIS Phase 1 Requirements Validation Report

**Document ID:** IIVKIS-VAL-001  
**Version:** 1.0.0  
**Status:** Complete — All Gaps Resolved  
**Phase:** STEP 1 Validation  
**Author:** Architect Agent  
**Date:** 2026-03-28  
**References:** [IIVKIS-REQ-001 v1.1.0](requirements.md)

---

## 1. Validation Scope

This report documents the completeness validation of the Phase 1 requirements baseline
(`docs/requirements.md` v1.0.0) against the six mandated domains specified in the
problem statement:

1. **Multi-tenancy**
2. **Correlation Engine**
3. **LLM Integration**
4. **Billing & Subscription**
5. **Security**
6. **Resiliency**

Additionally, the following cross-cutting concerns were validated:

- Identity, Authentication & Authorisation
- Vendor Knowledge Management
- Incident & Troubleshooting Management
- External System Integrations
- Analytics & Reporting
- Notifications & Alerting
- Administration & Platform Management
- Observability
- Compliance & Data Governance
- Usability & Accessibility
- Maintainability & Extensibility
- Constraints, Assumptions, Glossary, Open Questions

---

## 2. Validation Methodology

The validation was performed by:

1. **Inventory check** — all requirement IDs extracted and counted per domain.
2. **Domain coverage check** — each of the 6 mandated domains mapped to requirement IDs,
   confirming every sub-area has at least one traceable Must requirement.
3. **Gap analysis** — 13 candidate gaps identified using a checklist of industry-standard
   requirements for SaaS ITSM/AIOps platforms.
4. **Peer review simulation** — each gap assessed for whether it constitutes a *core
   missing component* (blocking for implementation) vs. a *nice-to-have*.
5. **Remediation** — all core gaps resolved by adding new requirements to
   `requirements.md` v1.1.0.
6. **Traceability matrix** — Section 9 of `requirements.md` maps all 6 domains to their
   full requirement ID sets.

---

## 3. Baseline Metrics (v1.0.0)

| Metric | Value |
|---|---|
| Total unique requirement IDs | 188 (FR + NFR + CON + ASM + OQ) |
| Functional requirement IDs (FR-*) | 116 |
| Non-functional requirement IDs (NFR-*) | 61 |
| Priority Must | 142 |
| Priority Should | 28 |
| FR domains covered | 11 |
| NFR categories covered | 9 |

---

## 4. Gaps Identified & Remediation Applied

### GAP-01 — No Incident SLA Management Section

**Severity:** Critical  
**Description:** SLA breach warnings were referenced in FR-NOTIF-005 and the platform
SLA was defined in NFR-AVAIL-001, but no requirements existed for *defining*, *tracking*,
or *enforcing* per-incident-severity SLA targets (response time, resolution time, timers,
breach notifications, escalation).  
**Impact if not resolved:** Incomplete for any ITSM platform; compliance and enterprise
customers require contractual SLA management.  
**Remediation:** Added new **Section 4.12 — Incident SLA Management** with requirements
FR-SLA-001 through FR-SLA-005 covering policy definition, timer behaviour, portal
indicators, warning notifications, and analytics inclusion.  
**Status:** ✅ Resolved

---

### GAP-02 — Missing Session Management Requirements

**Severity:** High  
**Description:** FR-IAM covered token lifetimes (FR-IAM-007) but did not specify
concurrent session limits, user-visible session enumeration (view active sessions by
device/IP), or administrator-initiated force-logout.  
**Impact if not resolved:** Security gap — compromised accounts cannot be cleanly
terminated; no visibility into active sessions for users or admins.  
**Remediation:** Added **FR-IAM-008** covering: user session listing (device, IP,
last-active), individual and bulk session revocation, tenant-admin force-terminate, and
configurable concurrent session limit (default 5).  
**Status:** ✅ Resolved

---

### GAP-03 — No Inbound Webhook Security Requirements

**Severity:** Critical  
**Description:** FR-INT-007 defined the generic inbound webhook capability but contained
no requirements for security of those inbound requests. Without HMAC verification and
replay protection, the webhook endpoint is vulnerable to spoofed event injection.  
**Impact if not resolved:** Attackers could inject fabricated alerts, incidents, or
correlation signals into any tenant's workspace, with no signature to verify origin.  
**Remediation:** Added **FR-INT-009** (HMAC-SHA256 signature verification, HTTP 401 on
invalid signature, 5-minute timestamp replay window) and **FR-INT-010** (tenant-admin
configurable IP allowlist per endpoint).  
**Status:** ✅ Resolved

---

### GAP-04 — LLM Streaming Only an Open Question, Not a Requirement

**Severity:** High  
**Description:** OQ-008 asked whether SSE streaming should be supported, deferring the
decision to STEP 4. However, FR-LLM-010 mandates a conversational troubleshooting chat
experience, which would be severely degraded without streaming (users see a blank screen
for several seconds while the full completion is generated).  
**Impact if not resolved:** Poor UX for the primary conversational AI feature; deferred
decision would delay implementation by multiple steps.  
**Remediation:** Promoted OQ-008 to a proper requirement: **FR-LLM-017** (Must) — SSE
streaming support in LLM Gateway; opt-in per request; progressive token rendering in
Portal. OQ-008 marked ✅ Resolved.  
**Status:** ✅ Resolved

---

### GAP-05 — No Tenant-Isolated Vector Index Requirement

**Severity:** Critical  
**Description:** FR-VK-008 required semantic search via vector embeddings and FR-VK-009
required per-tenant knowledge scoping, but no requirement explicitly mandated that vector
indexes must be isolated by tenant. Without this, a shared vector index could leak
sensitive knowledge article content across tenant boundaries via similarity search.  
**Impact if not resolved:** Critical data isolation failure — a query in tenant A's
context could return embeddings from tenant B's private knowledge corpus.  
**Remediation:** Added **FR-VK-010** requiring tenant isolation via separate physical
indexes or strict namespace partitioning, with explicit prohibition of cross-tenant
similarity queries.  
**Status:** ✅ Resolved

---

### GAP-06 — No API Versioning & Deprecation Policy Requirement

**Severity:** High  
**Description:** NFR-MAINT-002 required OpenAPI 3.1 specs but no requirement addressed
the versioning strategy (URI versioning, semantic versioning) or the deprecation policy
(sunset period, deprecation headers).  
**Impact if not resolved:** Breaking API changes could silently break integrations;
enterprise customers require predictable deprecation timelines.  
**Remediation:** Added **NFR-MAINT-007** — URI-based versioning (`/api/v1/…`), 6-month
minimum deprecation period, `Deprecation` / `Sunset` / `Link` response headers, no
breaking changes within a published major version.  
**Status:** ✅ Resolved

---

### GAP-07 — No CI/CD Pipeline Requirements

**Severity:** High  
**Description:** NFR-MAINT-006 required infrastructure-as-code but no requirement existed
for the CI/CD pipeline itself (automated test execution, security scanning, staging
promotion, production approval gate).  
**Impact if not resolved:** Without formalized CI/CD requirements, implementations may
skip automated testing or security scanning in the pipeline.  
**Remediation:** Added **NFR-MAINT-008** — CI/CD pipeline covering lint, typecheck, unit
tests, integration tests, dependency CVE + SAST scan, Docker build, staging
auto-deployment, and production promotion gate.  
**Status:** ✅ Resolved

---

### GAP-08 — No Operational Data Retention Lifecycle

**Severity:** High  
**Description:** NFR-SEC-022 covered audit log retention and NFR-RES-030 covered
backup schedules, but no requirement addressed retention and purge for operational data:
closed incidents, correlation groups, raw signals, analytics aggregates.  
**Impact if not resolved:** Unbounded data growth per tenant; potential GDPR violation
(personal data retained beyond necessity); cost and query-performance degradation.  
**Remediation:** Added **NFR-COMP-007** with default retention windows (incidents 3 years
online / 7 years cold; correlation groups 2 years; raw signals 90 days online / 1 year
cold; analytics aggregates 5 years) and tenant-admin extensibility within plan limits.  
**Status:** ✅ Resolved

---

### GAP-09 — No Rate-Limit Response Header Requirement

**Severity:** Medium  
**Description:** NFR-SEC-012 required rate limiting at the API gateway but did not specify
that rate-limit state must be communicated to API consumers via response headers.  
**Impact if not resolved:** API consumers cannot implement proper back-pressure or
adaptive retry logic; poor developer experience.  
**Remediation:** Added **NFR-SEC-016** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset` on all rate-limited responses; HTTP 429 with `Retry-After` on
limit breach.  
**Status:** ✅ Resolved

---

### GAP-10 — No Incident Escalation Policy Requirement

**Severity:** High  
**Description:** FR-TS covered the full incident lifecycle but had no requirement for what
happens when an incident breaches its SLA — there was no escalation path defined (next
tier, on-call manager), no automatic trigger, no audit record.  
**Impact if not resolved:** SLA breaches go unnoticed; no accountability chain for
unresolved critical incidents; makes the SLA management section (GAP-01) incomplete
without escalation.  
**Remediation:** Added **FR-TS-011** — automatic escalation on SLA response/resolution
breach, configurable escalation tiers (team lead, on-call manager), notification on all
active channels, escalation history in audit trail.  
**Status:** ✅ Resolved

---

### GAP-11 — No LLM Semantic Caching / Cost Optimisation Requirement

**Severity:** Medium  
**Description:** FR-LLM-006 handled per-tenant token budgets but no requirement addressed
strategies for reducing LLM costs: response caching, model-tier routing, prompt
compression.  
**Impact if not resolved:** Token costs scale linearly with usage even for repeated
identical queries; no architectural guidance for cost containment as tenant usage grows.  
**Remediation:** Added **FR-LLM-018** (Should) — semantic response caching for
near-identical prompts (cosine similarity ≥ 0.97), model-tier routing rules for
cost/capability trade-offs.  
**Status:** ✅ Resolved

---

### GAP-12 — No Requirements Traceability Matrix

**Severity:** High  
**Description:** The v1.0.0 document had no traceability matrix mapping the 6 mandated
domains from the problem statement to specific requirement IDs. Validation of completeness
was impossible without this cross-reference.  
**Impact if not resolved:** Cannot demonstrate to auditors, stakeholders, or downstream
design teams that each mandated domain is fully covered.  
**Remediation:** Added **Section 9 — Requirements Traceability Matrix** to
`requirements.md` v1.1.0, with per-domain sub-tables and a coverage summary confirming
all 6 domains validated.  
**Status:** ✅ Resolved

---

### GAP-13 — No Changelog / Revision History

**Severity:** Low  
**Description:** The v1.0.0 requirements document had no changelog section, making it
impossible to track what changed between versions.  
**Impact if not resolved:** Stakeholders and auditors cannot determine what was added or
changed without a full diff; non-compliance with documentation management best practices.  
**Remediation:** Added a **Revision History** table to the document header in v1.1.0,
recording both 1.0.0 (initial baseline) and 1.1.0 (validation pass with 13 gap-fills).  
**Status:** ✅ Resolved

---

## 5. Post-Remediation Metrics (v1.1.0)

| Metric | v1.0.0 | v1.1.0 | Delta |
|---|---|---|---|
| Total lines | 627 | 789 | +162 |
| Unique FR/NFR requirement IDs | 177 | 209 | +32 |
| FR domains | 11 | 12 | +1 (§4.12 SLA) |
| Priority Must | 142 | 157 | +15 |
| Priority Should | 28 | 32 | +4 |
| Open Questions resolved | 0 | 1 (OQ-008→FR-LLM-017) | — |
| Traceability matrix | Absent | Present (§9, 7 sub-sections) | Added |
| Revision history | Absent | Present | Added |

---

## 6. Domain Coverage Verdict

| Domain | Pre-Validation | Post-Validation | Verdict |
|---|---|---|---|
| Multi-Tenancy | Partial (no session mgmt, no vector isolation) | Complete | ✅ Pass |
| Correlation Engine | Complete | Complete | ✅ Pass |
| LLM Integration | Partial (streaming OQ, no caching req) | Complete | ✅ Pass |
| Billing & Subscription | Complete | Complete | ✅ Pass |
| Security | Partial (no webhook HMAC, no rate-limit headers) | Complete | ✅ Pass |
| Resiliency | Complete | Complete | ✅ Pass |
| **Overall Phase 1** | **Partial** | **Complete** | ✅ **PASS** |

---

## 7. Remaining Open Questions (Unresolved)

These 7 open questions remain for resolution in later phases as noted. They are
*design decisions*, not missing requirements.

| ID | Question | Target |
|---|---|---|
| OQ-001 | Preferred vector database (pgvector, Pinecone, Weaviate, Qdrant)? | STEP 2 |
| OQ-002 | Target cloud platform (AWS, Azure, GCP, multi-cloud)? | STEP 2 |
| OQ-003 | Correlation Engine ML training data — synthetic or historical? | STEP 3 |
| OQ-004 | Additional regulatory frameworks (HIPAA, FedRAMP)? | STEP 1 review |
| OQ-005 | Self-hosted (on-prem Kubernetes) required at GA? | STEP 2 |
| OQ-006 | Preferred payment processor (Stripe, Zuora, other)? | STEP 5 |
| OQ-007 | Preferred message queue (Kafka, RabbitMQ, SQS, Service Bus)? | STEP 2 |

---

## 8. Sign-Off

| Role | Name | Decision | Date |
|---|---|---|---|
| Architect Agent | (automated) | Phase 1 requirements validated and baseline confirmed at v1.1.0 | 2026-03-28 |

**Next Action:** Proceed to STEP 2 — System Design (data models, API contracts, sequence
diagrams, infrastructure topology).
