/**
 * Correlation Engine routes.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { AppError } from '../middleware/error-handler';
import type { Signal, CorrelationRuleDsl } from '@iivkis/shared';
import { getRequestDb } from '../infra/db';

export const correlationRouter = Router();

correlationRouter.get('/groups', async (req: Request, res: Response) => {
  const { status, confidence_min, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const db = getRequestDb(req);
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (confidence_min) { conditions.push(`confidence >= $${idx++}`); params.push(Number(confidence_min)); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await db.query(
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
    const db = getRequestDb(req);
    const [groupResult, signalResult] = await Promise.all([
      db.query(
        `SELECT * FROM correlation_groups WHERE id = $1 AND tenant_id = $2`,
        [req.params['id'], req.user!.tenantId],
      ),
      db.query(
        `SELECT s.* FROM signals s
         JOIN signal_group_memberships sgm ON sgm.signal_id = s.id
         WHERE sgm.correlation_group_id = $1 AND s.tenant_id = $2`,
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
    const db = getRequestDb(req);

    if (action === 'merge') {
      if (!mergeIntoId) throw new AppError(400, 'VALIDATION_ERROR', 'mergeIntoId is required for merge action');
      await db.query(
        `UPDATE signal_group_memberships SET correlation_group_id = $1
         WHERE correlation_group_id = $2`,
        [mergeIntoId, req.params['id']],
      );
    }

    const result = await db.query(
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

correlationRouter.get('/signals', async (req: Request, res: Response) => {
  const { signal_type, severity, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const db = getRequestDb(req);
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (signal_type) { conditions.push(`signal_type = $${idx++}`); params.push(signal_type); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await db.query(
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
    const db = getRequestDb(req);
    const id = randomUUID();
    const fingerprint = createHash('sha256')
      .update(`${signal.sourceSystem}|${signal.affectedCiId ?? ''}|${signal.title}|${signal.occurredAt}`)
      .digest('hex');

    const result = await db.query(
      `INSERT INTO signals
         (id, tenant_id, external_id, signal_type, source_system, affected_ci_id,
          fingerprint, severity, title, description, raw_payload, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id,
        req.user!.tenantId,
        signal.externalId ?? null,
        signal.signalType,
        signal.sourceSystem,
        signal.affectedCiId ?? null,
        fingerprint,
        signal.severity,
        signal.title,
        signal.description ?? null,
        JSON.stringify(signal.rawPayload ?? {}),
        signal.occurredAt,
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.get('/rules', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT * FROM correlation_rules
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true
       ORDER BY created_at DESC`,
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
    const db = getRequestDb(req);
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO correlation_rules (id, tenant_id, name, dsl_body, is_active, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
      [id, req.user!.tenantId, name, JSON.stringify(dslBody), enabled, req.user!.userId],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

correlationRouter.patch('/rules/:id', async (req: Request, res: Response) => {
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  if ('name' in updates) {
    setClauses.push(`name = $${idx++}`);
    params.push(updates['name']);
  }
  if ('dsl_body' in updates || 'dslBody' in updates) {
    setClauses.push(`dsl_body = $${idx++}`);
    params.push(JSON.stringify(updates['dsl_body'] ?? updates['dslBody']));
  }
  if ('enabled' in updates || 'is_active' in updates || 'isActive' in updates) {
    setClauses.push(`is_active = $${idx++}`);
    params.push(Boolean(updates['enabled'] ?? updates['is_active'] ?? updates['isActive']));
  }
  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');

  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE correlation_rules SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
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
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE correlation_rules SET is_active = false
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
