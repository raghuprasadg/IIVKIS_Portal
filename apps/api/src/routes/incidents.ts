/**
 * Incident management routes.
 *
 * GET    /api/v1/incidents                        — list (filter: status, severity, assignee)
 * POST   /api/v1/incidents                        — create incident
 * GET    /api/v1/incidents/:id                    — get single incident
 * PATCH  /api/v1/incidents/:id                    — update incident
 * DELETE /api/v1/incidents/:id                    — soft-delete
 * GET    /api/v1/incidents/:id/correlation-group  — linked correlation group
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';

export const incidentRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

// ── List incidents ─────────────────────────────────────────────────────────────
incidentRouter.get('/', async (req: Request, res: Response) => {
  const { status, severity, assignee, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    const conditions: string[] = ['deleted_at IS NULL', 'tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }
    if (assignee) { conditions.push(`assignee_id = $${idx++}`); params.push(assignee); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT * FROM incidents WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Create incident ────────────────────────────────────────────────────────────
incidentRouter.post('/', async (req: Request, res: Response) => {
  const { title, description, severity, affectedProductId, assigneeId, tags } = req.body as Record<string, unknown>;
  if (!title || !severity) throw new AppError(400, 'VALIDATION_ERROR', 'title and severity are required');

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO incidents
         (id, tenant_id, title, description, severity, affected_product_id, assignee_id, tags, status, reported_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,now(),now())
       RETURNING *`,
      [id, req.user!.tenantId, title, description, severity, affectedProductId, assigneeId, JSON.stringify(tags ?? []), req.user!.userId],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Get incident ───────────────────────────────────────────────────────────────
incidentRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM incidents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Update incident ────────────────────────────────────────────────────────────
incidentRouter.patch('/:id', async (req: Request, res: Response) => {
  const allowed = ['status', 'assignee_id', 'tags', 'severity', 'description'];
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  for (const key of allowed) {
    if (key in updates) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(updates[key]);
    }
  }
  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');

  setClauses.push(`updated_at = now()`);

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Soft-delete incident ───────────────────────────────────────────────────────
incidentRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE incidents SET deleted_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Correlation group for incident ─────────────────────────────────────────────
incidentRouter.get('/:id/correlation-group', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT cg.* FROM correlation_groups cg
       JOIN incident_correlation_groups icg ON icg.correlation_group_id = cg.id
       WHERE icg.incident_id = $1 AND cg.tenant_id = $2`,
      [req.params['id'], req.user!.tenantId],
    );
    res.json({ data: result.rows });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
