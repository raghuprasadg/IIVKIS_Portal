'use strict';
/**
 * Unit tests — OPA inline policy engine
 * Source: apps/api/src/security/opa.ts
 * Compiled: apps/api/dist/security/opa.js
 */

const path = require('path');
const { evaluate, assertAllowed } = require(
  path.resolve(__dirname, '../../apps/api/dist/security/opa'),
);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env['OPA_URL'];
});

/* ── helpers ──────────────────────────────────────────────────────────────── */

function makeInput(overrides = {}) {
  return {
    subject: {
      userId: 'user-test',
      tenantId: 'tenant-A',
      roles: ['operator'],
      attributes: {},
    },
    resource: {
      type: 'incident',
      id: 'inc-1',
      tenantId: 'tenant-A',
      attributes: {},
    },
    action: 'incident:read',
    now: new Date().toISOString(),
    ...overrides,
  };
}

/* ── tenant isolation ─────────────────────────────────────────────────────── */

describe('OPA — tenant isolation', () => {
  it('denies access when subject.tenantId !== resource.tenantId', async () => {
    const input = makeInput({
      resource: { type: 'incident', id: 'inc-x', tenantId: 'tenant-B', attributes: {} },
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
    expect(decision.ruleId).toBe('tenant-isolation');
  });

  it('allows access when subject.tenantId === resource.tenantId', async () => {
    const input = makeInput(); // both use tenant-A
    const decision = await evaluate(input);
    expect(decision.allow).toBe(true);
  });

  it('denies even admin for cross-tenant access', async () => {
    const input = makeInput({
      subject: { userId: 'admin-user', tenantId: 'tenant-A', roles: ['admin'], attributes: {} },
      resource: { type: 'incident', id: 'inc-z', tenantId: 'tenant-B', attributes: {} },
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
    expect(decision.ruleId).toBe('tenant-isolation');
  });
});

/* ── RBAC ─────────────────────────────────────────────────────────────────── */

describe('OPA — RBAC rule', () => {
  it('allows operator to read incidents', async () => {
    const decision = await evaluate(makeInput({ action: 'incident:read' }));
    expect(decision.allow).toBe(true);
  });

  it('denies viewer from writing incidents', async () => {
    const input = makeInput({
      subject: { userId: 'viewer-1', tenantId: 'tenant-A', roles: ['viewer'], attributes: {} },
      action: 'incident:write',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
    expect(decision.ruleId).toBe('rbac');
  });

  it('allows admin to delete incidents', async () => {
    const input = makeInput({
      subject: { userId: 'admin-1', tenantId: 'tenant-A', roles: ['admin'], attributes: {} },
      action: 'incident:delete',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(true);
  });

  it('denies analyst from ingesting knowledge', async () => {
    const input = makeInput({
      subject: { userId: 'analyst-1', tenantId: 'tenant-A', roles: ['analyst'], attributes: {} },
      resource: { type: 'knowledge', id: 'kb-1', tenantId: 'tenant-A', attributes: {} },
      action: 'knowledge:ingest',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
    expect(decision.ruleId).toBe('rbac');
  });

  it('returns ruleId=chain-pass for fully allowed requests', async () => {
    const decision = await evaluate(makeInput({ action: 'incident:read' }));
    expect(decision.ruleId).toBe('chain-pass');
  });
});

/* ── sensitive-action guard ───────────────────────────────────────────────── */

describe('OPA — sensitive-action guard', () => {
  it('denies operator from deleting incidents (sensitive action)', async () => {
    const input = makeInput({
      subject: { userId: 'op-1', tenantId: 'tenant-A', roles: ['operator'], attributes: {} },
      action: 'incident:delete',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
    expect(decision.ruleId).toBe('sensitive-action');
  });

  it('denies operator from tenant:admin (sensitive action)', async () => {
    const input = makeInput({
      subject: { userId: 'op-2', tenantId: 'tenant-A', roles: ['operator'], attributes: {} },
      action: 'tenant:admin',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
  });

  it('allows admin to perform sensitive actions', async () => {
    const input = makeInput({
      subject: { userId: 'admin-2', tenantId: 'tenant-A', roles: ['admin'], attributes: {} },
      action: 'incident:delete',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(true);
  });
});

/* ── time-based access ────────────────────────────────────────────────────── */

describe('OPA — time-based access rule', () => {
  it('denies viewer writing during off-hours (viewer has no write anyway — RBAC fires first)', async () => {
    // viewer can only read, so RBAC will fire before time-based — just verify deny
    const input = makeInput({
      subject: { userId: 'v1', tenantId: 'tenant-A', roles: ['viewer'], attributes: {} },
      action: 'incident:write',
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(false);
  });

  it('allows viewer to read incidents at any hour', async () => {
    const morningISO = new Date('2024-01-15T08:00:00Z').toISOString();
    const input = makeInput({
      subject: { userId: 'v2', tenantId: 'tenant-A', roles: ['viewer'], attributes: {} },
      action: 'incident:read',
      now: morningISO,
    });
    const decision = await evaluate(input);
    expect(decision.allow).toBe(true);
  });
});

/* ── assertAllowed() ──────────────────────────────────────────────────────── */

describe('OPA — assertAllowed()', () => {
  it('resolves (does not throw) when access is allowed', async () => {
    await expect(assertAllowed(makeInput({ action: 'incident:read' }))).resolves.toBeUndefined();
  });

  it('throws with POLICY_DENY code when access is denied', async () => {
    const input = makeInput({
      resource: { type: 'incident', id: 'inc-x', tenantId: 'tenant-B', attributes: {} },
    });
    await expect(assertAllowed(input)).rejects.toMatchObject({ code: 'POLICY_DENY' });
  });

  it('thrown error message contains the deny reason', async () => {
    const input = makeInput({
      resource: { type: 'incident', id: 'inc-x', tenantId: 'tenant-B', attributes: {} },
    });
    let err = null;
    try {
      await assertAllowed(input);
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(err.message).toContain('tenant-isolation');
  });
});

/* ── decision structure ───────────────────────────────────────────────────── */

describe('OPA — decision object structure', () => {
  it('always returns { allow, reason, ruleId }', async () => {
    const decision = await evaluate(makeInput());
    expect(typeof decision.allow).toBe('boolean');
    expect(typeof decision.reason).toBe('string');
    expect(typeof decision.ruleId).toBe('string');
  });

  it('reason contains action and subject on allowed request', async () => {
    const decision = await evaluate(makeInput({ action: 'incident:read' }));
    expect(decision.reason).toContain('incident:read');
    expect(decision.reason).toContain('user-test');
  });
});
