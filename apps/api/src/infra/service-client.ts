/**
 * service-client.ts
 *
 * Lightweight connectivity probes for all downstream services.
 * Used exclusively by GET /health/ready.
 *
 * All probes are non-throwing: a failed connection is captured and
 * returned as a structured check result.
 */

export interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

export interface ServiceChecks {
  postgres: CheckResult;
  redis: CheckResult;
  neo4j: CheckResult;
  vault: CheckResult;
  keycloak: CheckResult;
}

// ── PostgreSQL probe ──────────────────────────────────────────────────────────
async function checkPostgres(): Promise<CheckResult> {
  const url = process.env['DATABASE_URL'];
  if (!url) return { status: 'error', error: 'DATABASE_URL not set' };

  const t0 = Date.now();
  try {
    // Dynamic import so the startup doesn't fail if `pg` isn't installed yet
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { status: 'error', latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── Redis probe ───────────────────────────────────────────────────────────────
async function checkRedis(): Promise<CheckResult> {
  const url = process.env['REDIS_URL'];
  if (!url) return { status: 'error', error: 'REDIS_URL not set' };

  const t0 = Date.now();
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    if (pong !== 'PONG') return { status: 'error', error: `Unexpected PING response: ${pong}` };
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { status: 'error', latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── Neo4j probe ───────────────────────────────────────────────────────────────
async function checkNeo4j(): Promise<CheckResult> {
  const uri = process.env['NEO4J_URI'];
  const user = process.env['NEO4J_USER'] ?? 'neo4j';
  const password = process.env['NEO4J_PASSWORD'];
  if (!uri || !password) return { status: 'error', error: 'NEO4J_URI or NEO4J_PASSWORD not set' };

  const t0 = Date.now();
  try {
    const { default: neo4j } = await import('neo4j-driver');
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      connectionTimeout: 3000,
      maxConnectionLifetime: 5000,
    });
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { status: 'error', latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── Vault probe ───────────────────────────────────────────────────────────────
async function checkVault(): Promise<CheckResult> {
  const addr = process.env['VAULT_ADDR'];
  const token = process.env['VAULT_TOKEN'];
  if (!addr || !token) return { status: 'error', error: 'VAULT_ADDR or VAULT_TOKEN not set' };

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 3000);
    const resp = await fetch(`${addr}/v1/sys/health`, {
      headers: { 'X-Vault-Token': token },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok && resp.status !== 429 /* standby */ && resp.status !== 472 /* DR */) {
      return { status: 'error', latencyMs: Date.now() - t0, error: `Vault status ${resp.status}` };
    }
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { status: 'error', latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── Keycloak probe ─────────────────────────────────────────────────────────────
async function checkKeycloak(): Promise<CheckResult> {
  const url = process.env['KEYCLOAK_URL'];
  if (!url) return { status: 'error', error: 'KEYCLOAK_URL not set' };

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 3000);
    // Keycloak management port (9000) not accessible from the API container.
    // Use the main port's realm discovery endpoint instead.
    const realm = process.env['KEYCLOAK_REALM'] ?? 'iivkis';
    const resp = await fetch(`${url}/realms/${realm}/.well-known/openid-configuration`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return { status: 'error', latencyMs: Date.now() - t0, error: `Keycloak status ${resp.status}` };
    }
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { status: 'error', latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── Public factory ────────────────────────────────────────────────────────────
export function createClient() {
  return {
    async checkAll(): Promise<ServiceChecks> {
      const [postgres, redis, neo4j, vault, keycloak] = await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkNeo4j(),
        checkVault(),
        checkKeycloak(),
      ]);
      return { postgres, redis, neo4j, vault, keycloak };
    },
  };
}
