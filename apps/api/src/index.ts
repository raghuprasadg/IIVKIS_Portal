/**
 * IIVKIS API — Entry point.
 *
 * Provides:
 *  GET /health        — liveness probe (always 200 if process is running)
 *  GET /health/ready  — readiness probe (checks downstream service connectivity)
 *  GET /metrics       — Prometheus text-format metrics (basic process metrics)
 *  /api/v1/*          — versioned REST API (auth-gated)
 */
import express, { type Request, type Response } from 'express';
import { createClient } from './infra/service-client';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { errorHandler } from './middleware/error-handler';
import { wafMiddleware } from './middleware/waf';
import { mtlsMiddleware } from './middleware/mtls';
import { incidentRouter } from './routes/incidents';
import { knowledgeRouter } from './routes/knowledge';
import { correlationRouter } from './routes/correlation';
import { chatRouter } from './routes/chat';
import { integrationRouter } from './routes/integrations';
import { analyticsRouter } from './routes/analytics';
import { billingRouter } from './routes/billing';

const app = express();
const PORT = process.env['PORT'] ?? 4000;
const START_TIME = new Date().toISOString();

// ── CORS ──────────────────────────────────────────────────────────────────────
const IS_PROD = process.env['NODE_ENV'] === 'production';
const ALLOWED_ORIGINS = process.env['ALLOWED_ORIGINS']?.split(',').map((o) => o.trim()) ?? [];

app.use((req, res, next) => {
  const origin = req.headers['origin'] ?? '';
  const allowed = IS_PROD ? ALLOWED_ORIGINS.includes(origin) : true;
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', IS_PROD ? origin : '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Trace-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.status(204).send(); return; }
  next();
});

app.use(express.json());

// ── Security: WAF + mTLS (applied globally before auth) ───────────────────
app.use(wafMiddleware);
app.use(mtlsMiddleware);

// ── Liveness ─────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: '@iivkis/api',
    version: '0.0.1',
    uptime: process.uptime(),
    startedAt: START_TIME,
  });
});

// ── Readiness ─────────────────────────────────────────────────────────────────
app.get('/health/ready', async (_req: Request, res: Response) => {
  const client = createClient();
  const checks = await client.checkAll();

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks,
    checkedAt: new Date().toISOString(),
  });
});

// ── Prometheus metrics (minimal — process-level) ───────────────────────────
app.get('/metrics', (_req: Request, res: Response) => {
  const memMb = process.memoryUsage();
  const lines = [
    '# HELP process_uptime_seconds Total process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${process.uptime().toFixed(2)}`,
    '# HELP process_heap_bytes Node.js heap used bytes',
    '# TYPE process_heap_bytes gauge',
    `process_heap_bytes ${memMb.heapUsed}`,
    '# HELP process_rss_bytes Node.js RSS bytes',
    '# TYPE process_rss_bytes gauge',
    `process_rss_bytes ${memMb.rss}`,
  ];
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

// ── API v1 routes (all require auth + tenant RLS + rate limiting) ─────────────
const apiAuth = [authMiddleware, tenantMiddleware, rateLimitMiddleware] as const;

app.use('/api/v1/incidents', ...apiAuth, incidentRouter);
app.use('/api/v1/knowledge', ...apiAuth, knowledgeRouter);
app.use('/api/v1/correlation', ...apiAuth, correlationRouter);
app.use('/api/v1/chat', ...apiAuth, chatRouter);
app.use('/api/v1/integrations', ...apiAuth, integrationRouter);
app.use('/api/v1/analytics', ...apiAuth, analyticsRouter);
app.use('/api/v1/billing', ...apiAuth, billingRouter);

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] Listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[api] Health:   http://localhost:${PORT}/health`);
  // eslint-disable-next-line no-console
  console.log(`[api] Ready:    http://localhost:${PORT}/health/ready`);
  // eslint-disable-next-line no-console
  console.log(`[api] Metrics:  http://localhost:${PORT}/metrics`);
});

export default app;
