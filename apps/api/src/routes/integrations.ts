/**
 * Integration management routes.
 *
 * GET    /api/v1/integrations          — list integrations
 * POST   /api/v1/integrations          — create integration
 * GET    /api/v1/integrations/:id      — get integration
 * PATCH  /api/v1/integrations/:id      — update integration
 * DELETE /api/v1/integrations/:id      — delete integration
 * POST   /api/v1/integrations/:id/sync — trigger manual sync
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler.js';

export const integrationRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

// ── List integrations ──────────────────────────────────────────────────────────
integrationRouter.get('/', async (req: Request, res: Response) => {
  const { type, enabled, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (type) { conditions.push(`integration_type = $${idx++}`); params.push(type); }
    if (enabled !== undefined) { conditions.push(`enabled = $${idx++}`); params.push(enabled === 'true'); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT id, tenant_id, name, integration_type, enabled, last_sync_at, created_at, updated_at
       FROM integrations WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Create integration ─────────────────────────────────────────────────────────
integrationRouter.post('/', async (req: Request, res: Response) => {
  const { name, integrationType, config, enabled = true } = req.body as {
    name?: string;
    integrationType?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  };
  if (!name || !integrationType) throw new AppError(400, 'VALIDATION_ERROR', 'name and integrationType are required');

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO integrations
         (id, tenant_id, name, integration_type, config, enabled, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now()) RETURNING id, tenant_id, name, integration_type, enabled, created_at`,
      [id, req.user!.tenantId, name, integrationType, JSON.stringify(config ?? {}), enabled, req.user!.userId],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Get integration ────────────────────────────────────────────────────────────
integrationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, tenant_id, name, integration_type, enabled, last_sync_at, created_at, updated_at
       FROM integrations WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Update integration ─────────────────────────────────────────────────────────
integrationRouter.patch('/:id', async (req: Request, res: Response) => {
  const allowed = ['name', 'config', 'enabled'];
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  for (const key of allowed) {
    if (key in updates) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(key === 'config' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');
  setClauses.push('updated_at = now()');

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE integrations SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id, tenant_id, name, integration_type, enabled, updated_at`,
      params,
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Delete integration ─────────────────────────────────────────────────────────
integrationRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE integrations SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Trigger manual sync ────────────────────────────────────────────────────────
integrationRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const integResult = await pool.query(
      `SELECT id, integration_type, enabled FROM integrations
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId],
    );
    const integration = integResult.rows[0] as { id: string; integration_type: string; enabled: boolean } | undefined;
    if (!integration) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    if (!integration.enabled) throw new AppError(409, 'INTEGRATION_DISABLED', 'Integration is disabled');

    // Record a sync job and let the integration worker pick it up.
    const syncId = randomUUID();
    await pool.query(
      `INSERT INTO integration_sync_jobs (id, integration_id, tenant_id, triggered_by, status, created_at)
       VALUES ($1,$2,$3,$4,'pending',now())`,
      [syncId, integration.id, req.user!.tenantId, req.user!.userId],
    );

    res.status(202).json({ data: { syncId, status: 'pending' } });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
