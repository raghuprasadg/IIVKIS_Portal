/**
 * Tenant Row-Level Security middleware.
 *
 * Acquires a request-scoped PostgreSQL session, binds the tenant context on
 * that exact connection, and releases it after the response finishes.
 * Must run after authMiddleware.
 */
import { type Request, type Response, type NextFunction } from 'express';

import { getPool, setPool } from '../infra/db';

export { setPool };

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Auth middleware must run before tenant middleware', traceId: req.traceId },
    });
    return;
  }

  const { tenantId } = req.user;
  try {
    const client = await getPool().connect();
    await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    req.dbClient = client;

    let released = false;
    const cleanup = async (): Promise<void> => {
      if (released) return;
      released = true;

      delete req.dbClient;
      try {
        await client.query('RESET app.current_tenant_id');
      } catch {
        // Ignore cleanup failures during response teardown.
      }
      client.release();
    };

    res.once('finish', () => { void cleanup(); });
    res.once('close', () => { void cleanup(); });

    next();
  } catch {
    res.status(503).json({
      error: {
        code: 'DB_SESSION_UNAVAILABLE',
        message: 'Could not establish a tenant-bound database session',
        traceId: req.traceId,
      },
    });
  }
}
