/**
 * Analytics routes.
 *
 * GET /api/v1/analytics/incidents    — incident metrics (count by status/severity, MTTR)
 * GET /api/v1/analytics/knowledge    — KA usage metrics (searches, hit rate)
 * GET /api/v1/analytics/correlation  — CE accuracy metrics
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { AppError } from '../middleware/error-handler';

export const analyticsRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 5 });
  }
  return _pool;
}

/** Parse `from` / `to` ISO query params; default to last 30 days. */
function parseDateRange(query: Record<string, string>): { from: string; to: string } {
  const to = query['to'] ?? new Date().toISOString();
  const from = query['from'] ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

// ── Incident metrics ───────────────────────────────────────────────────────────
analyticsRouter.get('/incidents', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const pool = getPool();
    const tenantId = req.user!.tenantId;

    const [byStatus, bySeverity, mttr] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) AS count FROM incidents
         WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3
         GROUP BY status`,
        [tenantId, from, to],
      ),
      pool.query(
        `SELECT severity, COUNT(*) AS count FROM incidents
         WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3
         GROUP BY severity`,
        [tenantId, from, to],
      ),
      pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 60)::numeric(10,2) AS mttr_minutes
         FROM incidents
         WHERE tenant_id = $1 AND deleted_at IS NULL AND resolved_at IS NOT NULL
           AND created_at BETWEEN $2 AND $3`,
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

// ── Knowledge metrics ──────────────────────────────────────────────────────────
analyticsRouter.get('/knowledge', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const pool = getPool();
    const tenantId = req.user!.tenantId;

    const [searches, hitRate] = await Promise.all([
      pool.query(
        `SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS searches
         FROM knowledge_search_log
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY day ORDER BY day`,
        [tenantId, from, to],
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE results_returned > 0)::numeric /
           NULLIF(COUNT(*),0) * 100 AS hit_rate_pct
         FROM knowledge_search_log
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
        [tenantId, from, to],
      ),
    ]);

    res.json({
      data: {
        period: { from, to },
        dailySearches: searches.rows,
        hitRatePct: hitRate.rows[0]?.['hit_rate_pct'] ?? null,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Correlation metrics ────────────────────────────────────────────────────────
analyticsRouter.get('/correlation', async (req: Request, res: Response) => {
  const { from, to } = parseDateRange(req.query as Record<string, string>);

  try {
    const pool = getPool();
    const tenantId = req.user!.tenantId;

    const [byStatus, avgConfidence] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) AS count FROM correlation_groups
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY status`,
        [tenantId, from, to],
      ),
      pool.query(
        `SELECT AVG(confidence)::numeric(5,2) AS avg_confidence FROM correlation_groups
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
        [tenantId, from, to],
      ),
    ]);

    // Precision = confirmed / (confirmed + rejected)
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
