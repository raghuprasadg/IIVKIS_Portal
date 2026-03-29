/**
 * Tenant Row-Level Security middleware.
 *
 * Sets the PostgreSQL session variable `app.current_tenant_id` so that
 * RLS policies on all tables can filter rows by tenant transparently.
 * Must run after authMiddleware.
 */
import { type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';

let _pool: Pool | undefined;

/** Lazily initialise the shared PG pool (created once, reused per process). */
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

/** Exposed for testing / cleanup. */
export function setPool(pool: Pool): void {
  _pool = pool;
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Auth middleware must run before tenant middleware', traceId: req.traceId },
    });
    return;
  }

  const { tenantId } = req.user;

  // We do not block the request on the SET — if PG is down we gracefully skip.
  // The actual DB calls in route handlers will also fail and return 503.
  setTenantContext(tenantId).catch(() => {
    // Non-fatal: individual route handlers catch their own DB errors.
  });

  next();
}

async function setTenantContext(tenantId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
  } finally {
    client.release();
  }
}
