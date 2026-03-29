# IIVKIS Phase 7 — Security + Resiliency Validation

**Date:** 2026-03-29  
**Validator:** `scripts/validate-phase7.mjs`  
**Status:** ✅ PASS (30/30 tests)

---

## Security Track

### OPA Policy Engine (`apps/api/src/security/opa.ts`)
Inline Rego-inspired policy engine with 4-rule chain:

| Rule | Behaviour |
|------|-----------|
| `tenant-isolation` | Subject and resource must share same `tenantId` |
| `rbac` | Role must carry the required permission |
| `time-based` | Viewer writes blocked outside 06:00–22:00 UTC |
| `sensitive-action` | `incident:delete`, `integration:delete`, `tenant:admin` require `admin` role |

Remote OPA sidecar delegation: set `OPA_URL` to `http://localhost:8181/v1/data/iivkis/authz/allow`.

**Validated:**
- ✅ admin can `incident:read`, `incident:delete`
- ✅ viewer cannot `incident:delete` (sensitive-action guard fires)
- ✅ cross-tenant access denied (isolation rule fires first)
- ✅ analyst can `knowledge:read` but NOT `knowledge:ingest`
- ✅ `assertAllowed()` throws `POLICY_DENY` error on deny

### RBAC Role Permission Matrix (`packages/shared/src/types/security.ts`)

| Role | Key Permissions |
|------|----------------|
| `admin` | All permissions including `tenant:admin`, `incident:delete` |
| `operator` | Read+write for incidents, correlation, integrations; invoke orchestrator |
| `analyst` | Read-only for incidents, correlation, knowledge; chat write |
| `viewer` | Read-only for incidents, correlation, analytics |
| `service` | Machine-to-machine: read+write incidents, correlation, knowledge ingest |

**Validated:**
- ✅ All roles have ≥1 permission
- ✅ Viewer is strictly read-only
- ✅ Admin has all permissions including sensitive ones

### Vault Secrets Provider (`apps/api/src/security/vault.ts`)
- Resolves secrets from HashiCorp Vault KV-v2 (when `VAULT_ADDR` set)
- Falls back to environment variables transparently (dev/CI mode)
- 5-minute in-process cache to reduce Vault calls
- Kubernetes service-account token auto-detection

**Validated:**
- ✅ Resolves JWT secret from `JWT_SECRET` env var
- ✅ Returns empty string (graceful) for unconfigured secret
- ✅ `secretFingerprint()` returns 16-char hex (SHA-256 head)
- ✅ Cache prevents re-reading env on second call

### WAF Middleware (`apps/api/src/middleware/waf.ts`)
Applied globally on all inbound requests before auth:

| Category | Pattern |
|----------|---------|
| `sql_injection` | SELECT/UNION/DROP/xp_ with FROM keyword, OR 1=1 patterns |
| `xss` | `<script>`, `javascript:`, `onerror=`, `<iframe>` |
| `path_traversal` | `../../` sequences |
| `command_injection` | Shell meta-chars + known commands |
| `llm_prompt_injection` | "Ignore previous instructions" phrases |
| `oversized_payload` | `Content-Length` > 1 MB |
| `suspicious_header` | CRLF in header values, oversized headers |

### mTLS Middleware (`apps/api/src/middleware/mtls.ts`)
- Checks `X-Client-Cert-Verified: SUCCESS` header (set by Istio/Nginx TLS terminator)
- Parses X.509 DN from `X-Client-Cert-Subject`
- CN allowlist enforcement via `MTLS_ALLOWED_CNS` env var
- Certificate expiry validation via `X-Client-Cert-NotAfter`
- No-op in dev mode (`MTLS_REQUIRED` not set)

### RBAC/ABAC Middleware (`apps/api/src/middleware/rbac.ts`)
Factory middleware `rbac('permission')` applied per route:
- Builds `ABACSubject` from `req.user` (JWT claims)
- Builds `ABACResource` with resource `tenantId` = subject `tenantId` (structural isolation)
- Calls OPA engine; returns HTTP 403 with `PolicyDecision` detail on deny

---

## Resiliency Track

### Retry Utility (`packages/shared/src/resiliency/retry.ts`)
- Full jitter exponential backoff (random in `[0, delay]`)
- Configurable `maxAttempts`, `initialDelayMs`, `maxDelayMs`, `backoffMultiplier`
- Per-attempt `isRetryable` predicate — hard errors fail immediately
- `AbortSignal` support for graceful cancellation
- `isHttpRetryable()` helper: retries 429/502/503/504

**Validated:**
- ✅ First-attempt success (0 retries)
- ✅ Retries transient failures (3 attempts to succeed)
- ✅ Gives up after `maxAttempts`
- ✅ Non-retryable error fails immediately (1 call)
- ✅ HTTP status classification correct

### Generalized Circuit Breaker (`packages/shared/src/resiliency/circuit-breaker.ts`)
- CLOSED → OPEN (after `failureThreshold` consecutive failures)
- OPEN → HALF_OPEN (after `cooldownMs`)
- HALF_OPEN → CLOSED (probe success) or OPEN (probe failure)
- `CircuitBreakerRegistry` — named singleton instances
- `execute()` helper — auto records success/failure, throws `CircuitOpenError` when OPEN

**Validated:**
- ✅ CLOSED → OPEN at threshold
- ✅ `execute()` throws `CircuitOpenError` on OPEN
- ✅ HALF_OPEN probe success closes circuit
- ✅ Registry returns same instance for same name

### Agent Dispatch with Resilience (`apps/orchestrator/src/resiliency/agent-retry.ts`)
Wraps ALL agent `handle()` calls in the orchestrator with:
1. Per-agent circuit breaker (`agent:<agentId>`)
2. 3-attempt exponential-backoff retry
3. Tenant isolation enforcement (response `tenantId` must match request)
4. Non-retryable failure → immediate `DISPATCH_FAILED` response

**Validated:**
- ✅ Success response passes through
- ✅ Tenant isolation mismatch → `DISPATCH_FAILED` (not retried)
- ✅ Non-retryable failure → 1 call only

### Failover Chain (`apps/orchestrator/src/resiliency/failover.ts`)
Four service categories with ordered provider chains:

| Category | Primary | Fallback | Emergency stub |
|----------|---------|---------|----------------|
| `llm` | `openai` | `azure-openai` | `llm-stub` |
| `vector-store` | `pgvector` | — | `vector-stub` |
| `knowledge-graph` | `neo4j` | — | `kg-stub` |
| `message-queue` | `kafka` | — | `queue-stub` |

`GET /health/failover` returns all chain states including circuit-breaker status.

**Validated:**
- ✅ Resolves `llm-stub` when no `LLM_API_KEY`
- ✅ Resolves `kg-stub` when no `NEO4J_URI`
- ✅ `status()` covers all four chains
- ✅ Skips provider whose circuit breaker is OPEN

---

## Phase 6 Regression

- ✅ `IntegrationPipeline.run()` still produces correlated groups with evidence (3 raw events → ≥1 group, confidence ≥ 30, evidence narratives present)

---

## Validation Script Output (summary)

```
Phase 7 validation: 30 passed, 0 failed
✅ PASS — all Phase 7 security + resiliency components validated
```

**Phase 7 validation: COMPLETE ✅**
