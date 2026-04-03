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
import { randomUUID, createHash } from 'crypto';
import { AppError } from '../middleware/error-handler';
import { getRequestDb } from '../infra/db';

export const knowledgeRouter = Router();

// ── List / full-text search articles ──────────────────────────────────────────
knowledgeRouter.get('/articles', async (req: Request, res: Response) => {
  const { q, limit = '50', offset = '0' } = req.query as Record<string, string>;

  try {
    const db = getRequestDb(req);
    let query: string;
    let params: unknown[];

    if (q) {
      query = `SELECT * FROM knowledge_articles
               WHERE (tenant_id = $1 OR tenant_id IS NULL)
                 AND to_tsvector('english', title || ' ' || coalesce(content,''))
                     @@ plainto_tsquery('english', $2)
               ORDER BY ingested_at DESC LIMIT $3 OFFSET $4`;
      params = [req.user!.tenantId, q, Number(limit), Number(offset)];
    } else {
      query = `SELECT * FROM knowledge_articles
               WHERE tenant_id = $1 OR tenant_id IS NULL
               ORDER BY ingested_at DESC LIMIT $2 OFFSET $3`;
      params = [req.user!.tenantId, Number(limit), Number(offset)];
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Create article ─────────────────────────────────────────────────────────────
knowledgeRouter.post('/articles', async (req: Request, res: Response) => {
  const { title, body, content: rawContent, tags, productId, vendorId, versionId, sourceUrl } = req.body as Record<string, unknown>;
  const content = String(rawContent ?? body ?? '').trim();
  if (!title || !content) throw new AppError(400, 'VALIDATION_ERROR', 'title and content are required');

  try {
    const db = getRequestDb(req);
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO knowledge_articles
         (id, tenant_id, title, content, content_hash, source_type, source_url, vendor_id, product_id, version_id, tags, provenance)
       VALUES ($1,$2,$3,$4,$5,'manual',$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        id,
        req.user!.tenantId,
        title,
        content,
        createHash('sha256').update(content).digest('hex'),
        typeof sourceUrl === 'string' ? sourceUrl : null,
        typeof vendorId === 'string' ? vendorId : null,
        typeof productId === 'string' ? productId : null,
        typeof versionId === 'string' ? versionId : null,
        Array.isArray(tags) ? tags : [],
        JSON.stringify({ createdBy: req.user!.userId }),
      ],
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
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT * FROM knowledge_articles WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
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
  const updates = req.body as Record<string, unknown>;
  const setClauses: string[] = [];
  const params: unknown[] = [req.params['id'], req.user!.tenantId];
  let idx = 3;

  if ('title' in updates) {
    setClauses.push(`title = $${idx++}`);
    params.push(updates['title']);
  }
  if ('content' in updates || 'body' in updates) {
    const content = String(updates['content'] ?? updates['body'] ?? '').trim();
    setClauses.push(`content = $${idx++}`);
    params.push(content);
    setClauses.push(`content_hash = $${idx++}`);
    params.push(createHash('sha256').update(content).digest('hex'));
  }
  if ('tags' in updates) {
    setClauses.push(`tags = $${idx++}`);
    params.push(updates['tags']);
  }
  if ('vendorId' in updates) {
    setClauses.push(`vendor_id = $${idx++}`);
    params.push(updates['vendorId']);
  }
  if ('productId' in updates) {
    setClauses.push(`product_id = $${idx++}`);
    params.push(updates['productId']);
  }
  if ('versionId' in updates) {
    setClauses.push(`version_id = $${idx++}`);
    params.push(updates['versionId']);
  }
  if ('status' in updates) {
    setClauses.push(`status = $${idx++}`);
    params.push(updates['status']);
  }
  if (setClauses.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No updatable fields provided');

  try {
    const db = getRequestDb(req);
    const result = await db.query(
      `UPDATE knowledge_articles SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
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
    const db = getRequestDb(req);
    let sql = `SELECT id, title, content, tags, ingested_at AS created_at,
                ts_rank(to_tsvector('english', title || ' ' || coalesce(content,'')),
                        plainto_tsquery('english', $2)) AS rank
               FROM knowledge_articles
               WHERE (tenant_id = $1 OR tenant_id IS NULL)
                 AND to_tsvector('english', title || ' ' || coalesce(content,''))
                     @@ plainto_tsquery('english', $2)`;
    const params: unknown[] = [req.user!.tenantId, query];
    let idx = 3;

    if (filters && typeof filters === 'object') {
      for (const [col, val] of Object.entries(filters)) {
        // Only allow safe column names.
        if (['vendor_id', 'product_id', 'version_id', 'status', 'language'].includes(col)) {
          sql += ` AND ${col} = $${idx++}`;
          params.push(val);
        }
      }
    }

    sql += ` ORDER BY rank DESC LIMIT $${idx}`;
    params.push(topK);

    const result = await db.query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
