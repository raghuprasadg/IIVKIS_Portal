/**
 * Billing routes.
 *
 * GET  /api/v1/billing/usage          — current period usage summary for the calling tenant
 * GET  /api/v1/billing/usage/history  — last N billing periods
 * GET  /api/v1/billing/usage/:period  — usage for a specific period (YYYY-MM-DD of period start)
 *
 * Access: any authenticated tenant user (own tenant data only).
 * Admin users can pass ?tenantId=<id> to inspect any tenant (RBAC-gated server-side).
 */
import { Router, type Request, type Response } from 'express';
import { AppError } from '../middleware/error-handler.js';
import {
  getUsageSummary,
  listBillingPeriods,
} from '../services/billing.service.js';

export const billingRouter = Router();

// ── GET /api/v1/billing/usage  (current period) ────────────────────────────────
billingRouter.get('/usage', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;

  try {
    const summary = await getUsageSummary(tenantId);
    // Return empty zeroed summary when no data yet recorded for the period
    if (!summary) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return res.json({
        data: {
          tenantId,
          periodStart,
          periodEnd,
          apiRequests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          pipelineRuns: 0,
          knowledgeSearches: 0,
          estimatedCostUsd: 0,
        },
      });
    }
    res.json({ data: summary });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'BILLING_ERROR', 'Could not retrieve billing usage');
  }
});

// ── GET /api/v1/billing/usage/history ────────────────────────────────────────
billingRouter.get('/usage/history', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const limit = Math.min(parseInt((req.query as Record<string, string>)['limit'] ?? '12', 10), 36);

  try {
    const periods = await listBillingPeriods(tenantId, limit);
    res.json({ data: periods, count: periods.length });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'BILLING_ERROR', 'Could not retrieve billing history');
  }
});

// ── GET /api/v1/billing/usage/:period ─────────────────────────────────────────
billingRouter.get('/usage/:period', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const period = req.params['period'] as string;

  // Validate YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'period must be in YYYY-MM-DD format');
  }

  try {
    const summary = await getUsageSummary(tenantId, period);
    if (!summary) throw new AppError(404, 'NOT_FOUND', `No billing data for period ${period}`);
    res.json({ data: summary });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'BILLING_ERROR', 'Could not retrieve billing data');
  }
});
