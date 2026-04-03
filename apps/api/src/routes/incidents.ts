/**
 * Incident management routes.
 *
 * GET    /api/v1/incidents                        — list (filter: status, severity, assignee)
 * POST   /api/v1/incidents                        — create incident
 * GET    /api/v1/incidents/:id                    — get single incident
 * PATCH  /api/v1/incidents/:id                    — update incident
 * DELETE /api/v1/incidents/:id                    — archive/close incident
 * GET    /api/v1/incidents/:id/correlation-group  — linked correlation group
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';
import { getRequestDb } from '../infra/db';

export const incidentRouter = Router();

incidentRouter.get('/', async (req: Request, res: Response) => {
  const { status, severity, assignee, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const db = getRequestDb(req);
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }
    if (assignee) { conditions.push(`assignee_id = $${idx++}`); params.push(assignee); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await db.query(
      `SELECT * FROM incidents WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

incidentRouter.post('/', async (req: Request, res: Response) => {
  const { title, description, severity, affectedProductId, assigneeId, tags } = req.body as Record<string, unknown>;
  if (!title || !severity) throw new AppError(400, 'VALIDATION_ERROR', 'title and severity are required');

  try {
    const db = getRequestDb(req);
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO incidents
         (id, tenant_id, title, description, severity, assignee_id, tags, status, external_ref, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,now(),now())
       RETURNING *`,
      [
        id,
        req.user!.tenantId,
        title,
        description,
        severity,
        assigneeId,
        Array.isArray(tags) ? tags : [],
        JSON.stringify({ affectedProductId: affectedProductId ?? null, reportedBy: req.user!.userId }),
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

incidentRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT * FROM incidents WHERE id = $1 AND tenant_id = $2`,
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
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
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

incidentRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE incidents
       SET status = 'closed', closed_at = COALESCE(closed_at, now()), updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

incidentRouter.get('/:id/correlation-group', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT cg.* FROM incidents i
       JOIN correlation_groups cg ON cg.id = i.correlation_group_id
       WHERE i.id = $1 AND i.tenant_id = $2 AND cg.tenant_id = $2`,
      [req.params['id'], req.user!.tenantId],
    );
    res.json({ data: result.rows });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
