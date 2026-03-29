/**
 * Knowledge article routes.
 *
 * GET    /api/v1/knowledge/articles          — list/search (q param for FTS)
 * POST   /api/v1/knowledge/articles          — create article
 * GET    /api/v1/knowledge/articles/:id      — get article
 * PATCH  /api/v1/knowledge/articles/:id      — update article
 * POST   /api/v1/knowledge/search            — semantic search
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler.js';

export const knowledgeRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

// ── List / full-text search articles ──────────────────────────────────────────
knowledgeRouter.get('/articles', async (req: Request, res: Response) => {
  const { q, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    let query: string;
    let params: unknown[];

    if (q) {
      query = `SELECT * FROM knowledge_articles
               WHERE tenant_id = $1 AND deleted_at IS NULL
                 AND to_tsvector('english', title || ' ' || coalesce(body,''))
                     @@ plainto_tsquery('english', $2)
               ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
      params = [req.user!.tenantId, q, Number(limit), Number(offset)];
    } else {
      query = `SELECT * FROM knowledge_articles
               WHERE tenant_id = $1 AND deleted_at IS NULL
               ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params = [req.user!.tenantId, Number(limit), Number(offset)];
    }

    const result = await pool.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Create article ─────────────────────────────────────────────────────────────
knowledgeRouter.post('/articles', async (req: Request, res: Response) => {
  const { title, body, tags, productIds } = req.body as Record<string, unknown>;
  if (!title) throw new AppError(400, 'VALIDATION_ERROR', 'title is required');

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO knowledge_articles
         (id, tenant_id, title, body, tags, product_ids, author_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
       RETURNING *`,
      [id, req.user!.tenantId, title, body, JSON.stringify(tags ?? []), JSON.stringify(productIds ?? []), req.user!.userId],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Get article ────────────────────────────────────────────────────────────────
knowledgeRouter.get('/articles/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM knowledge_articles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Article not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Update article ─────────────────────────────────────────────────────────────
knowledgeRouter.patch('/articles/:id', async (req: Request, res: Response) => {
  const allowed = ['title', 'body', 'tags', 'product_ids'];
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
      `UPDATE knowledge_articles SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Article not found');
    res.json({ data: row });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Semantic search ────────────────────────────────────────────────────────────
knowledgeRouter.post('/search', async (req: Request, res: Response) => {
  const { query, topK = 10, filters } = req.body as {
    query?: string;
    topK?: number;
    filters?: Record<string, unknown>;
  };

  if (!query) throw new AppError(400, 'VALIDATION_ERROR', 'query is required');

  // Semantic search delegates to the VK agent via orchestrator when available.
  // For now we fall back to FTS so the endpoint is functional without the agent.
  try {
    const pool = getPool();
    let sql = `SELECT id, title, body, tags, created_at,
                ts_rank(to_tsvector('english', title || ' ' || coalesce(body,'')),
                        plainto_tsquery('english', $2)) AS rank
               FROM knowledge_articles
               WHERE tenant_id = $1 AND deleted_at IS NULL
                 AND to_tsvector('english', title || ' ' || coalesce(body,''))
                     @@ plainto_tsquery('english', $2)`;
    const params: unknown[] = [req.user!.tenantId, query];
    let idx = 3;

    if (filters && typeof filters === 'object') {
      for (const [col, val] of Object.entries(filters)) {
        // Only allow safe column names.
        if (/^[a-z_]+$/.test(col)) {
          sql += ` AND ${col} = $${idx++}`;
          params.push(val);
        }
      }
    }

    sql += ` ORDER BY rank DESC LIMIT $${idx}`;
    params.push(topK);

    const result = await pool.query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
