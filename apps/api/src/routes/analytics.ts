/**
 * Analytics routes.
 */
import { Router, type Request, type Response } from 'express';
import { AppError } from '../middleware/error-handler';
import { getRequestDb } from '../infra/db';

export const analyticsRouter = Router();

function parseDateRange(query: Record<string, string>): { from: string; to: string } {
  const to = query['to'] ?? new Date().toISOString();
  const from = query['from'] ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

analyticsRouter.get('/incidents', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const db = getRequestDb(req);
    const tenantId = req.user!.tenantId;

    const [byStatus, bySeverity, mttr] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS count FROM incidents
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY status`,
        [tenantId, from, to],
      ),
      db.query(
        `SELECT severity, COUNT(*) AS count FROM incidents
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY severity`,
        [tenantId, from, to],
      ),
      db.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::numeric(10,2) AS mttr_minutes
         FROM incidents
         WHERE tenant_id = $1 AND resolved_at IS NOT NULL AND created_at BETWEEN $2 AND $3`,
        [tenantId, from, to],
      ),
    ]);

    res.json({
      data: {
        period: { from, to },
        byStatus: byStatus.rows,
        bySeverity: bySeverity.rows,
        mttrMinutes: mttr.rows[0]?.['mttr_minutes'] ?? null,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

analyticsRouter.get('/knowledge', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const db = getRequestDb(req);
    const tenantId = req.user!.tenantId;

    const [articles, embeddings] = await Promise.all([
      db.query(
        `SELECT DATE_TRUNC('day', ingested_at) AS day, COUNT(*) AS articles
         FROM knowledge_articles
         WHERE tenant_id = $1 AND ingested_at BETWEEN $2 AND $3
         GROUP BY day ORDER BY day`,
        [tenantId, from, to],
      ),
      db.query(
        `SELECT COUNT(*)::int AS embedded_chunks
         FROM knowledge_embeddings
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
        [tenantId, from, to],
      ),
    ]);

    res.json({
      data: {
        period: { from, to },
        dailySearches: [],
        hitRatePct: null,
        articleIngests: articles.rows,
        embeddedChunks: embeddings.rows[0]?.['embedded_chunks'] ?? 0,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

analyticsRouter.get('/correlation', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const db = getRequestDb(req);
    const tenantId = req.user!.tenantId;

    const [byStatus, avgConfidence] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS count FROM correlation_groups
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY status`,
        [tenantId, from, to],
      ),
      db.query(
        `SELECT AVG(confidence)::numeric(5,2) AS avg_confidence FROM correlation_groups
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
        [tenantId, from, to],
      ),
    ]);

    const statusCounts = (byStatus.rows as { status: string; count: string }[]).reduce<Record<string, number>>(
      (acc, r) => { acc[r.status] = parseInt(r.count, 10); return acc; },
      {},
    );
    const confirmed = statusCounts['confirmed'] ?? 0;
    const rejected = statusCounts['rejected'] ?? 0;
    const precision = confirmed + rejected > 0
      ? Math.round((confirmed / (confirmed + rejected)) * 10000) / 100
      : null;

    res.json({
      data: {
        period: { from, to },
        byStatus: byStatus.rows,
        avgConfidence: avgConfidence.rows[0]?.['avg_confidence'] ?? null,
        precisionPct: precision,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
