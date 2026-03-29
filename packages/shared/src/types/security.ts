/**
 * IIVKIS Security types — RBAC, ABAC, OPA, mTLS (Phase 7).
 *
 * These types are shared between the API middleware layer and any other service
 * that needs to reason about permissions, policies, or certificate identities.
 */

/* ── RBAC ───────────────────────────────────────────────────────────────── */

/**
 * Canonical role names that map directly to DB role strings and JWT claims.
 * Keep in sync with docs/threat-model.md control pillar 1 (RBAC).
 */
export type RoleName =
  | 'admin'
  | 'operator'
  | 'analyst'
  | 'viewer'
  | 'service'; // machine-to-machine / internal service identity

/**
 * Fine-grained permission strings.
 * Convention: `<resource>:<action>` — matches OPA policy structure.
 */
export type Permission =
  // Incident management
  | 'incident:read'
  | 'incident:write'
  | 'incident:delete'
  // Correlation groups
  | 'correlation:read'
  | 'correlation:write'
  // Knowledge base
  | 'knowledge:read'
  | 'knowledge:write'
  | 'knowledge:ingest'
  // Chat / troubleshooting
  | 'chat:read'
  | 'chat:write'
  // Integrations (connector config)
  | 'integration:read'
  | 'integration:write'
  | 'integration:delete'
  // Analytics
  | 'analytics:read'
  // Tenant admin
  | 'tenant:admin'
  // Orchestrator internal
  | 'orchestrator:invoke';

/** Mapping of role → set of granted permissions (Role → Permission[]).  */
export type RolePermissionMap = Record<RoleName, Permission[]>;

/** Default RBAC permission matrix (principle of least privilege). */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  admin: [
    'incident:read', 'incident:write', 'incident:delete',
    'correlation:read', 'correlation:write',
    'knowledge:read', 'knowledge:write', 'knowledge:ingest',
    'chat:read', 'chat:write',
    'integration:read', 'integration:write', 'integration:delete',
    'analytics:read',
    'tenant:admin',
    'orchestrator:invoke',
  ],
  operator: [
    'incident:read', 'incident:write', 'incident:delete',
    'correlation:read', 'correlation:write',
    'knowledge:read',
    'chat:read', 'chat:write',
    'integration:read', 'integration:write', 'integration:delete',
    'analytics:read',
    'orchestrator:invoke',
  ],
  analyst: [
    'incident:read',
    'correlation:read',
    'knowledge:read',
    'chat:read', 'chat:write',
    'analytics:read',
  ],
  viewer: [
    'incident:read',
    'correlation:read',
    'knowledge:read',
    'analytics:read',
  ],
  service: [
    'incident:read', 'incident:write',
    'correlation:read', 'correlation:write',
    'knowledge:read', 'knowledge:ingest',
    'orchestrator:invoke',
  ],
};

/* ── ABAC ───────────────────────────────────────────────────────────────── */

/**
 * ABAC subject — the requesting entity with its attributes.
 * Populated by authMiddleware + rbacMiddleware.
 */
export interface ABACSubject {
  userId: string;
  tenantId: string;
  roles: RoleName[];
  /** Arbitrary extra claims from the JWT or identity provider. */
  attributes: Record<string, unknown>;
}

/**
 * ABAC resource — the object being accessed.
 * Provided by the route handler or middleware.
 */
export interface ABACResource {
  type: string;         // e.g. 'incident', 'correlation_group'
  id?: string;          // specific resource ID (undefined for collection access)
  tenantId: string;     // owning tenant — must match subject.tenantId
  attributes: Record<string, unknown>;
}

/** Result from an ABAC / OPA policy evaluation. */
export interface PolicyDecision {
  allow: boolean;
  /** Human-readable reason (shown in audit log, not to end-user). */
  reason: string;
  /** Policy rule ID that produced this decision. */
  ruleId?: string;
}

/* ── OPA ────────────────────────────────────────────────────────────────── */

/** OPA evaluation input document (subset of full Rego input object). */
export interface OPAInput {
  subject: ABACSubject;
  resource: ABACResource;
  action: Permission;
  /** Current UTC ISO timestamp injected at evaluation time. */
  now: string;
}

/* ── mTLS ───────────────────────────────────────────────────────────────── */

/** Parsed fields from a TLS client certificate (X.509 DN). */
export interface ClientCertIdentity {
  /** CN field from subject DN. */
  commonName: string;
  /** O field — organisation. */
  organization?: string;
  /** OU field — organizational unit. */
  organizationalUnit?: string;
  /** Certificate serial number. */
  serialNumber: string;
  /** RFC 3339 — notBefore of the cert. */
  validFrom: string;
  /** RFC 3339 — notAfter of the cert. */
  validTo: string;
  /** SHA-256 fingerprint of the DER-encoded cert (hex, no colons). */
  fingerprint: string;
}

/* ── WAF ────────────────────────────────────────────────────────────────── */

export type WAFThreatCategory =
  | 'sql_injection'
  | 'xss'
  | 'path_traversal'
  | 'command_injection'
  | 'llm_prompt_injection'
  | 'oversized_payload'
  | 'suspicious_header';

export interface WAFViolation {
  category: WAFThreatCategory;
  field: string;
  /** Sanitised snippet (no actual malicious content in logs). */
  snippet: string;
}
