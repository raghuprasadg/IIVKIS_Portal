/**
 * IIVKIS API — Entry point.
 *
 * Provides:
 *  GET /health        — liveness probe (always 200 if process is running)
 *  GET /health/ready  — readiness probe (checks downstream service connectivity)
 *  GET /metrics       — Prometheus text-format metrics (basic process metrics)
 */
import express, { type Request, type Response } from 'express';
import { createClient } from './infra/service-client';

const app = express();
const PORT = process.env['PORT'] ?? 4000;
const START_TIME = new Date().toISOString();

app.use(express.json());

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
