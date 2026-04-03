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
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/error-handler';
import { getRequestDb } from '../infra/db';

export const chatRouter = Router();

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
    const db = getRequestDb(req);
    const result = await db.query(
      `SELECT * FROM chat_sessions WHERE tenant_id = $1 AND user_id = $2
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
  const incidentId = contextType === 'incident' && typeof contextId === 'string'
    ? contextId
    : null;

  try {
    const db = getRequestDb(req);
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO chat_sessions
         (id, tenant_id, user_id, incident_id, title, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'active',now(),now()) RETURNING *`,
      [id, req.user!.tenantId, req.user!.userId, incidentId, title ?? 'New Session'],
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
    const db = getRequestDb(req);
    // Verify session ownership.
    const sessionResult = await db.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [req.params['id'], req.user!.tenantId, req.user!.userId],
    );
    if (!sessionResult.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Session not found');

    const msgResult = await db.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC LIMIT $3 OFFSET $4`,
      [req.params['id'], req.user!.tenantId, Number(limit), Number(offset)],
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
    const db = getRequestDb(req);
    const sessionResult = await db.query(
      `SELECT * FROM chat_sessions WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [req.params['id'], req.user!.tenantId, req.user!.userId],
    );
    if (!sessionResult.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Session not found');

    // Persist user message.
    const userMsgId = randomUUID();
    await db.query(
      `INSERT INTO chat_messages (id, session_id, tenant_id, role, content, created_at)
       VALUES ($1,$2,$3,'user',$4,now())`,
      [userMsgId, req.params['id'], req.user!.tenantId, content],
    );

    // Fetch recent context for LLM (last 20 messages).
    const historyResult = await db.query(
      `SELECT role, content FROM chat_messages
       WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20`,
      [req.params['id'], req.user!.tenantId],
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
    const assistantMsg = await db.query(
      `INSERT INTO chat_messages (id, session_id, tenant_id, role, content, model_used, tokens_used, created_at)
       VALUES ($1,$2,$3,'assistant',$4,$5,$6,now()) RETURNING *`,
      [
        assistantMsgId, req.params['id'], req.user!.tenantId, assistantContent,
        agentResponse['modelUsed'] ?? null,
        agentResponse['tokensUsed'] ?? null,
      ],
    );

    // Touch session updated_at.
    await db.query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1 AND tenant_id = $2`, [req.params['id'], req.user!.tenantId]);

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
    const db = getRequestDb(req);
    const normalizedRating = rating === 'up' ? 'positive' : 'negative';
    const result = await db.query(
      `UPDATE chat_messages SET feedback = $1
       WHERE id = $2 AND session_id = $3 AND tenant_id = $4 RETURNING id`,
      [normalizedRating, messageId, req.params['id'], req.user!.tenantId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Message not found');
    res.status(201).json({ data: { messageId, rating: normalizedRating, comment: comment ?? null } });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'DB_ERROR', 'Database unavailable');
  }
});
