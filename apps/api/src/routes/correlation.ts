/**
 * Correlation Engine routes.
 *
 * GET    /api/v1/correlation/groups        — list groups
 * GET    /api/v1/correlation/groups/:id    — group detail + signals
 * PATCH  /api/v1/correlation/groups/:id    — accept | reject | merge
 * GET    /api/v1/correlation/signals       — list signals
 * POST   /api/v1/correlation/signals       — inject signal
 * GET    /api/v1/correlation/rules         — list rules
 * POST   /api/v1/correlation/rules         — create rule
 * PATCH  /api/v1/correlation/rules/:id     — update rule
 * DELETE /api/v1/correlation/rules/:id     — delete rule
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';
import type { Signal, CorrelationRuleDsl } from '@iivkis/shared';

export const correlationRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

// ── Correlation Groups ─────────────────────────────────────────────────────────

correlationRouter.get('/groups', async (req: Request, res: Response) => {
  const { status, confidence_min, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (confidence_min) { conditions.push(`confidence >= $${idx++}`); params.push(Number(confidence_min)); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT * FROM correlation_groups WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.get('/groups/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const [groupResult, signalResult] = await Promise.all([
      pool.query(
        `SELECT * FROM correlation_groups WHERE id = $1 AND tenant_id = $2`,
        [req.params['id'], req.user!.tenantId],
      ),
      pool.query(
        `SELECT s.* FROM signals s
         JOIN correlation_group_signals cgs ON cgs.signal_id = s.id
         WHERE cgs.correlation_group_id = $1 AND s.tenant_id = $2`,
        [req.params['id'], req.user!.tenantId],
      ),
    ]);

    const group = groupResult.rows[0];
    if (!group) throw new AppError(404, 'NOT_FOUND', 'Correlation group not found');

    res.json({ data: { ...group, signals: signalResult.rows } });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.patch('/groups/:id', async (req: Request, res: Response) => {
  const { action, mergeIntoId } = req.body as { action?: string; mergeIntoId?: string };
  const validActions = ['accept', 'reject', 'merge'];
  if (!action || !validActions.includes(action)) {
    throw new AppError(400, 'VALIDATION_ERROR', `action must be one of: ${validActions.join(', ')}`);
  }

  const statusMap: Record<string, string> = { accept: 'confirmed', reject: 'rejected', merge: 'merged' };
  const newStatus = statusMap[action]!;

  try {
    const pool = getPool();

    if (action === 'merge') {
      if (!mergeIntoId) throw new AppError(400, 'VALIDATION_ERROR', 'mergeIntoId is required for merge action');
      await pool.query(
        `UPDATE correlation_group_signals SET correlation_group_id = $1
         WHERE correlation_group_id = $2`,
        [mergeIntoId, req.params['id']],
      );
    }

    const result = await pool.query(
      `UPDATE correlation_groups SET status = $1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [newStatus, req.params['id'], req.user!.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Correlation group not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Signals ────────────────────────────────────────────────────────────────────

correlationRouter.get('/signals', async (req: Request, res: Response) => {
  const { signal_type, severity, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (signal_type) { conditions.push(`signal_type = $${idx++}`); params.push(signal_type); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT * FROM signals WHERE ${where} ORDER BY occurred_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.post('/signals', async (req: Request, res: Response) => {
  const signal = req.body as Partial<Signal>;
  if (!signal.signalType || !signal.sourceSystem || !signal.severity || !signal.title || !signal.occurredAt) {
    throw new AppError(400, 'VALIDATION_ERROR', 'signalType, sourceSystem, severity, title, occurredAt are required');
  }

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO signals
         (id, tenant_id, external_id, signal_type, source_system, affected_ci_id,
          severity, title, description, raw_payload, occurred_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       RETURNING *`,
      [
        id, req.user!.tenantId, signal.externalId ?? null, signal.signalType, signal.sourceSystem,
        signal.affectedCiId ?? null, signal.severity, signal.title, signal.description ?? null,
        JSON.stringify(signal.rawPayload ?? {}), signal.occurredAt,
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Correlation Rules ──────────────────────────────────────────────────────────

correlationRouter.get('/rules', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM correlation_rules WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [req.user!.tenantId],
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.post('/rules', async (req: Request, res: Response) => {
  const { name, dslBody, enabled = true } = req.body as {
    name?: string;
    dslBody?: CorrelationRuleDsl;
    enabled?: boolean;
  };
  if (!name || !dslBody) throw new AppError(400, 'VALIDATION_ERROR', 'name and dslBody are required');

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO correlation_rules (id, tenant_id, name, dsl_body, enabled, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now(),now()) RETURNING *`,
      [id, req.user!.tenantId, name, JSON.stringify(dslBody), enabled, req.user!.userId],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.patch('/rules/:id', async (req: Request, res: Response) => {
  const allowed = ['name', 'dsl_body', 'enabled'];
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  for (const key of allowed) {
    if (key in updates) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(key === 'dsl_body' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');
  setClauses.push('updated_at = now()');

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE correlation_rules SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE correlation_rules SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
