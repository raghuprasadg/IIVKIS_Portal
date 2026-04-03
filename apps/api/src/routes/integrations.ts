/**
 * Integration management routes.
 *
 * GET    /api/v1/integrations          — list integrations
 * POST   /api/v1/integrations          — create integration
 * GET    /api/v1/integrations/:id      — get integration
 * PATCH  /api/v1/integrations/:id      — update integration
 * DELETE /api/v1/integrations/:id      — disable integration
 * POST   /api/v1/integrations/:id/sync — trigger manual sync
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';
import { getRequestDb } from '../infra/db';

export const integrationRouter = Router();

async function callOrchestrator(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const orchestratorUrl = process.env['ORCHESTRATOR_URL'];
  if (!orchestratorUrl) throw new AppError(503, 'ORCHESTRATOR_UNAVAILABLE', 'ORCHESTRATOR_URL is not configured');

  const response = await fetch(`${orchestratorUrl}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError(502, 'ORCHESTRATOR_ERROR', `Orchestrator returned ${response.status}`);
  }

  return body;
}

integrationRouter.get('/', async (req: Request, res: Response) => {
  const { type, enabled, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const db = getRequestDb(req);
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [req.user!.tenantId];
    let idx = 2;

    if (type) { conditions.push(`system_type = $${idx++}`); params.push(type); }
    if (enabled !== undefined) {
      conditions.push(enabled === 'true' ? `status = $${idx++}` : `status <> $${idx++}`);
      params.push('active');
    }

    params.push(Number(limit), Number(offset));
    const where = conditions.join(' AND ');

    const result = await db.query(
      `SELECT id, tenant_id, name, system_type AS "integrationType", (status = 'active') AS enabled,
              last_sync_at, created_at, updated_at
       FROM integrations WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

integrationRouter.post('/', async (req: Request, res: Response) => {
  const { name, integrationType, config, enabled = true } = req.body as {
    name?: string;
    integrationType?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  };
  if (!name || !integrationType) throw new AppError(400, 'VALIDATION_ERROR', 'name and integrationType are required');

  try {
    const db = getRequestDb(req);
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO integrations
         (id, tenant_id, name, system_type, status, config_ref, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now(),now())
       RETURNING id, tenant_id, name, system_type AS "integrationType", (status = 'active') AS enabled, created_at`,
      [id, req.user!.tenantId, name, integrationType, enabled ? 'active' : 'inactive', JSON.stringify(config ?? {})],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

integrationRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT id, tenant_id, name, system_type AS "integrationType", (status = 'active') AS enabled,
              last_sync_at, created_at, updated_at
       FROM integrations WHERE id = $1 AND tenant_id = $2`,
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

integrationRouter.patch('/:id', async (req: Request, res: Response) => {
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  if ('name' in updates) {
    setClauses.push(`name = $${idx++}`);
    params.push(updates['name']);
  }
  if ('config' in updates) {
    setClauses.push(`config_ref = $${idx++}`);
    params.push(JSON.stringify(updates['config']));
  }
  if ('enabled' in updates) {
    setClauses.push(`status = $${idx++}`);
    params.push(updates['enabled'] ? 'active' : 'inactive');
  }

  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');
  setClauses.push('updated_at = now()');

  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE integrations SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, system_type AS "integrationType", (status = 'active') AS enabled, updated_at`,
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

integrationRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE integrations SET status = 'inactive', updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

integrationRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const db = getRequestDb(req);
    const integResult = await db.query(
      `SELECT id, name, system_type, status, config_ref, last_sync_at
       FROM integrations WHERE id = $1 AND tenant_id = $2`,
      [req.params['id'], req.user!.tenantId],
    );
    const integration = integResult.rows[0] as {
      id: string;
      name: string;
      system_type: string;
      status: string;
      config_ref: string;
      last_sync_at?: string;
    } | undefined;
    if (!integration) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    if (integration.status !== 'active') throw new AppError(409, 'INTEGRATION_DISABLED', 'Integration is disabled');

    const parsedConfig = integration.config_ref ? JSON.parse(integration.config_ref) as Record<string, unknown> : {};
    const taskId = randomUUID();
    const orchestratorResponse = await callOrchestrator({
      taskId,
      taskType: 'int.sync',
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      traceId: req.traceId ?? taskId,
      spanId: randomUUID(),
      payload: {
        config: {
          id: integration.id,
          tenantId: req.user!.tenantId,
          connectorType: integration.system_type,
          displayName: integration.name,
          baseUrl: typeof parsedConfig['baseUrl'] === 'string' ? parsedConfig['baseUrl'] : '',
          auth: typeof parsedConfig['auth'] === 'object' && parsedConfig['auth'] !== null ? parsedConfig['auth'] : { type: 'token' },
          syncMode: parsedConfig['syncMode'] === 'full' ? 'full' : 'incremental',
          syncIntervalMinutes: typeof parsedConfig['syncIntervalMinutes'] === 'number' ? parsedConfig['syncIntervalMinutes'] : 60,
          fieldMappings: Array.isArray(parsedConfig['fieldMappings']) ? parsedConfig['fieldMappings'] : [],
          webhookSecret: typeof parsedConfig['webhookSecret'] === 'string' ? parsedConfig['webhookSecret'] : undefined,
          enabled: true,
          lastSyncAt: integration.last_sync_at,
          metadata: typeof parsedConfig['metadata'] === 'object' && parsedConfig['metadata'] !== null ? parsedConfig['metadata'] : undefined,
        },
        since: integration.last_sync_at ?? null,
      },
      timeoutMs: 30_000,
      createdAt: new Date().toISOString(),
    });

    await db.query(
      `UPDATE integrations SET last_sync_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [integration.id, req.user!.tenantId],
    );

    res.status(202).json({
      data: {
        taskId,
        status: orchestratorResponse['status'] ?? 'accepted',
        result: orchestratorResponse['result'] ?? null,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
