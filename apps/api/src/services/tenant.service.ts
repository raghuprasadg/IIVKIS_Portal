/**
 * Tenant service — tenant metadata and configuration retrieval.
 */
import { Pool } from 'pg';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface TenantConfig {
  tenantId: string;
  /** Maps task type to the preferred model tier: 'fast' | 'capable' | model name. */
  modelTierMap: Record<string, string>;
  rateLimits: {
    globalPerMinute: number;
    endpointPerMinute: number;
  };
  features: Record<string, boolean>;
}

let _pool: Pool | undefined;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set');
    _pool = new Pool({ connectionString: url, max: 5 });
  }
  return _pool;
}

export async function getTenant(tenantId: string): Promise<Tenant> {
  const pool = getPool();
  const result = await pool.query<{ id: string; name: string; slug: string; created_at: string }>(
    `SELECT id, name, slug, created_at FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );

  const row = result.rows[0];
  if (!row) throw new Error(`Tenant not found: ${tenantId}`);

  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const pool = getPool();
  const result = await pool.query<{
    model_tier_map: Record<string, string>;
    rate_limits: { global_per_minute: number; endpoint_per_minute: number };
    features: Record<string, boolean>;
  }>(
    `SELECT model_tier_map, rate_limits, features FROM tenant_configs WHERE tenant_id = $1`,
    [tenantId],
  );

  const row = result.rows[0];
  if (!row) {
    // Return sensible defaults when no config row exists yet.
    return {
      tenantId,
      modelTierMap: {},
      rateLimits: { globalPerMinute: 1000, endpointPerMinute: 100 },
      features: {},
    };
  }

  return {
    tenantId,
    modelTierMap: row.model_tier_map ?? {},
    rateLimits: {
      globalPerMinute: row.rate_limits?.global_per_minute ?? 1000,
      endpointPerMinute: row.rate_limits?.endpoint_per_minute ?? 100,
    },
    features: row.features ?? {},
  };
}
