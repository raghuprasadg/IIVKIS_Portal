/**
 * Chat session routes.
 *
 * GET    /api/v1/chat/sessions                    — list sessions
 * POST   /api/v1/chat/sessions                    — create session
 * GET    /api/v1/chat/sessions/:id/messages        — get messages
 * POST   /api/v1/chat/sessions/:id/messages        — send message (calls LLM)
 * POST   /api/v1/chat/sessions/:id/feedback        — thumbs up/down feedback
 */
import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';

export const chatRouter = Router();

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

/** Fire an LLM completion request via the orchestrator endpoint. */
async function callOrchestrator(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const orchestratorUrl = process.env['ORCHESTRATOR_URL'];
  if (!orchestratorUrl) throw new AppError(503, 'ORCHESTRATOR_UNAVAILABLE', 'ORCHESTRATOR_URL is not configured');

  for (const path of ['/tasks', '/orchestrate']) {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 30_000);
    try {
      const resp = await fetch(`${orchestratorUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.status === 404) continue;
      if (!resp.ok) {
        throw new AppError(502, 'ORCHESTRATOR_ERROR', `Orchestrator returned ${resp.status}`);
      }
      return (await resp.json()) as Record<string, unknown>;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof AppError) throw err;
    }
  }

  throw new AppError(503, 'ORCHESTRATOR_UNAVAILABLE', 'Could not reach orchestrator');
}

// ── Direct reply (no DB persistence) ─────────────────────────────────────────
chatRouter.post('/reply', async (req: Request, res: Response) => {
  const { content, messages } = req.body as {
    content?: string;
    messages?: Array<{ role?: string; content?: string }>;
  };

  if (!content) throw new AppError(400, 'VALIDATION_ERROR', 'content is required');

  const normalizedMessages = Array.isArray(messages) && messages.length > 0
    ? messages
      .filter((m): m is { role: string; content: string } => !!m?.role && !!m?.content)
      .map((m) => ({ role: m.role, content: m.content }))
    : [{ role: 'user', content }];

  const taskId = randomUUID();
  const agentResponse = await callOrchestrator({
    taskId,
    taskType: 'ts.chat.turn',
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    traceId: req.traceId ?? taskId,
    spanId: randomUUID(),
    payload: { sessionId: 'adhoc', messages: normalizedMessages },
    timeoutMs: 25_000,
    createdAt: new Date().toISOString(),
  });

  const assistantContent =
    (agentResponse['result'] as Record<string, unknown> | undefined)?.['content'] as string
    ?? (agentResponse['error'] as Record<string, unknown> | undefined)?.['message'] as string
    ?? 'I could not generate a response.';

  res.status(200).json({
    data: {
      role: 'assistant',
      content: assistantContent,
      modelUsed: agentResponse['modelUsed'] ?? null,
      tokensUsed: agentResponse['tokensUsed'] ?? null,
      status: agentResponse['status'] ?? 'failed',
    },
  });
});

// ── List sessions ──────────────────────────────────────────────────────────────
chatRouter.get('/sessions', async (req: Request, res: Response) => {
  const { limit = '20', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM chat_sessions WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
      [req.user!.tenantId, req.user!.userId, Number(limit), Number(offset)],
    );
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Create session ─────────────────────────────────────────────────────────────
chatRouter.post('/sessions', async (req: Request, res: Response) => {
  const { title, contextType, contextId } = req.body as Record<string, unknown>;

  try {
    const pool = getPool();
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO chat_sessions
         (id, tenant_id, user_id, title, context_type, context_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now(),now()) RETURNING *`,
      [id, req.user!.tenantId, req.user!.userId, title ?? 'New Session', contextType ?? null, contextId ?? null],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Get messages ───────────────────────────────────────────────────────────────
chatRouter.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  const { limit = '100', offset = '0' } = req.query as Record<string, string>;

  try {
    const pool = getPool();
    // Verify session ownership.
    const sessionResult = await pool.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId, req.user!.userId],
    );
    if (!sessionResult.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Session not found');

    const msgResult = await pool.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [req.params['id'], Number(limit), Number(offset)],
    );
    res.json({ data: msgResult.rows, count: msgResult.rowCount });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Send message (calls LLM) ───────────────────────────────────────────────────
chatRouter.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  const { content } = req.body as { content?: string };
  if (!content) throw new AppError(400, 'VALIDATION_ERROR', 'content is required');

  try {
    const pool = getPool();
    const sessionResult = await pool.query(
      `SELECT * FROM chat_sessions WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [req.params['id'], req.user!.tenantId, req.user!.userId],
    );
    if (!sessionResult.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Session not found');

    // Persist user message.
    const userMsgId = randomUUID();
    await pool.query(
      `INSERT INTO chat_messages (id, session_id, role, content, created_at)
       VALUES ($1,$2,'user',$3,now())`,
      [userMsgId, req.params['id'], content],
    );

    // Fetch recent context for LLM (last 20 messages).
    const historyResult = await pool.query(
      `SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params['id']],
    );
    const messages = historyResult.rows.reverse() as { role: string; content: string }[];

    // Call orchestrator.
    const taskId = randomUUID();
    const agentResponse = await callOrchestrator({
      taskId,
      taskType: 'ts.chat.turn',
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      traceId: req.traceId ?? taskId,
      spanId: randomUUID(),
      payload: { sessionId: req.params['id'], messages },
      timeoutMs: 25_000,
      createdAt: new Date().toISOString(),
    });

    const assistantContent =
      (agentResponse['result'] as Record<string, unknown> | undefined)?.['content'] as string
      ?? 'I was unable to generate a response at this time.';

    // Persist assistant message.
    const assistantMsgId = randomUUID();
    const assistantMsg = await pool.query(
      `INSERT INTO chat_messages (id, session_id, role, content, model_used, tokens_used, created_at)
       VALUES ($1,$2,'assistant',$3,$4,$5,now()) RETURNING *`,
      [
        assistantMsgId, req.params['id'], assistantContent,
        agentResponse['modelUsed'] ?? null,
        agentResponse['tokensUsed'] ?? null,
      ],
    );

    // Touch session updated_at.
    await pool.query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [req.params['id']]);

    res.status(201).json({ data: assistantMsg.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});

// ── Feedback ───────────────────────────────────────────────────────────────────
chatRouter.post('/sessions/:id/feedback', async (req: Request, res: Response) => {
  const { messageId, rating, comment } = req.body as {
    messageId?: string;
    rating?: 'up' | 'down';
    comment?: string;
  };
  if (!messageId || !rating) throw new AppError(400, 'VALIDATION_ERROR', 'messageId and rating are required');
  if (rating !== 'up' && rating !== 'down') throw new AppError(400, 'VALIDATION_ERROR', 'rating must be up or down');

  try {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO chat_feedback (id, session_id, message_id, tenant_id, user_id, rating, comment, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (message_id, user_id) DO UPDATE SET rating = $6, comment = $7`,
      [id, req.params['id'], messageId, req.user!.tenantId, req.user!.userId, rating, comment ?? null],
    );
    res.status(201).json({ data: { id, rating } });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
