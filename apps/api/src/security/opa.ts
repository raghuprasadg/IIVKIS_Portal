/**
 * OPA (Open Policy Agent) inline policy engine (Phase 7 — Security).
 *
 * Evaluates access-control policies without an external OPA daemon.
 * The policy rules are expressed as TypeScript-native Rego-inspired logic
 * so they can be audited alongside the code and tested without a sidecar.
 *
 * In production with an external OPA sidecar, set OPA_URL to the sidecar's
 * query endpoint (e.g. http://localhost:8181/v1/data/iivkis/authz/allow).
 * The engine will delegate to the remote endpoint instead of evaluating locally.
 *
 * Policy file structure maps: resource type → action → evaluation function.
 * Each evaluation function receives an OPAInput and returns PolicyDecision.
 */

import type { OPAInput, PolicyDecision, Permission } from '@iivkis/shared';
import { DEFAULT_ROLE_PERMISSIONS } from '@iivkis/shared';
import type { RoleName } from '@iivkis/shared';

const OPA_URL = process.env['OPA_URL'];

/* ── remote OPA delegation ───────────────────────────────────────────────── */

async function evaluateRemote(input: OPAInput): Promise<PolicyDecision | null> {
  if (!OPA_URL) return null;
  try {
    const resp = await fetch(OPA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!resp.ok) {
      console.warn(`[opa] Remote evaluation failed: HTTP ${resp.status}`);
      return null;
    }
    const body = (await resp.json()) as { result?: boolean };
    return {
      allow: body.result === true,
      reason: body.result === true ? 'opa:remote:allow' : 'opa:remote:deny',
      ruleId: 'remote',
    };
  } catch (err) {
    console.warn(`[opa] Remote evaluation error: ${String(err)}`);
    return null;
  }
}

/* ── local policy rules ──────────────────────────────────────────────────── */

/**
 * Core RBAC check — does any role in the subject carry the required permission?
 */
function rbacAllow(input: OPAInput): boolean {
  for (const role of input.subject.roles) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role as RoleName];
    if (perms && perms.includes(input.action)) return true;
  }
  return false;
}

/**
 * Tenant isolation check — subject and resource MUST share the same tenantId.
 */
function tenantIsolationAllow(input: OPAInput): boolean {
  return input.subject.tenantId === input.resource.tenantId;
}

/**
 * Time-based access policy — deny reads/writes outside business hours for
 * viewer-only users as an example ABAC rule.
 */
function timeBasedAllow(input: OPAInput): boolean {
  const hasOnlyViewerRole =
    input.subject.roles.length === 1 && input.subject.roles[0] === 'viewer';

  if (!hasOnlyViewerRole) return true; // non-viewers are not time-restricted

  const hour = new Date(input.now).getUTCHours();
  const isOffHours = hour < 6 || hour >= 22; // 06:00–22:00 UTC allowed

  if (isOffHours && input.action !== 'incident:read' && input.action !== 'analytics:read') {
    return false;
  }
  return true;
}

/**
 * Sensitive-action guard — certain destructive permissions require admin.
 */
function sensitiveActionAllow(input: OPAInput): boolean {
  const sensitivePerms: Permission[] = [
    'incident:delete',
    'integration:delete',
    'tenant:admin',
  ];

  if (!sensitivePerms.includes(input.action)) return true;

  return input.subject.roles.includes('admin');
}

/* ── policy evaluation chain ─────────────────────────────────────────────── */

type PolicyRule = (input: OPAInput) => boolean;

const POLICY_CHAIN: Array<{ id: string; rule: PolicyRule }> = [
  { id: 'tenant-isolation', rule: tenantIsolationAllow },
  { id: 'rbac',             rule: rbacAllow },
  { id: 'time-based',       rule: timeBasedAllow },
  { id: 'sensitive-action', rule: sensitiveActionAllow },
];

/* ── public API ──────────────────────────────────────────────────────────── */

/**
 * Evaluate whether the access described in `input` is allowed.
 *
 * Evaluation order:
 *  1. If OPA_URL is set, delegate to remote OPA.
 *  2. Run local policy chain (all rules must pass — AND semantics).
 */
export async function evaluate(input: OPAInput): Promise<PolicyDecision> {
  // 1. Attempt remote delegation
  const remote = await evaluateRemote(input);
  if (remote !== null) return remote;

  // 2. Local chain evaluation
  for (const { id, rule } of POLICY_CHAIN) {
    if (!rule(input)) {
      return {
        allow: false,
        reason: `policy:${id}:deny — action=${input.action} subject=${input.subject.userId} resource=${input.resource.type}:${input.resource.id ?? '*'}`,
        ruleId: id,
      };
    }
  }

  return {
    allow: true,
    reason: `policy:allow — action=${input.action} subject=${input.subject.userId}`,
    ruleId: 'chain-pass',
  };
}

/**
 * Convenience: evaluate and throw if denied.
 * Use in route handlers that want a simple assert-style check.
 */
export async function assertAllowed(input: OPAInput): Promise<void> {
  const decision = await evaluate(input);
  if (!decision.allow) {
    const err = new Error(decision.reason);
    (err as NodeJS.ErrnoException).code = 'POLICY_DENY';
    throw err;
  }
}
