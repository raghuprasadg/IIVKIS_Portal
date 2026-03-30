/**
 * IIVKIS Billing Service — per-tenant usage tracking & billing periods.
 *
 * Tracks:
 *  - API request counts per tenant per day
 *  - LLM token consumption (prompt + completion)
 *  - Pipeline run counts
 *  - Knowledge-search queries
 *
 * Billing periods are calendar-month aligned; each record accumulates
 * usage and is "closed" at period end to produce an immutable invoice row.
 */
import { Pool } from 'pg';

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set');
    _pool = new Pool({ connectionString: url, max: 5 });
  }
  return _pool;
}

export interface UsageDelta {
  apiRequests?: number;
  promptTokens?: number;
  completionTokens?: number;
  pipelineRuns?: number;
  knowledgeSearches?: number;
}

export interface BillingUsageSummary {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  apiRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  pipelineRuns: number;
  knowledgeSearches: number;
  estimatedCostUsd: number;
}

/** Pricing constants — can be overridden via env. */
const PRICE_PER_1K_PROMPT = parseFloat(process.env['BILLING_PROMPT_PER_1K'] ?? '0.002');
const PRICE_PER_1K_COMPLETION = parseFloat(process.env['BILLING_COMPLETION_PER_1K'] ?? '0.006');
const PRICE_PER_PIPELINE_RUN = parseFloat(process.env['BILLING_PER_PIPELINE_RUN'] ?? '0.01');

/** Increment usage counters for a tenant in the current billing period. */
export async function recordUsage(tenantId: string, delta: UsageDelta): Promise<void> {
  const pool = getPool();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  await pool.query(
    `INSERT INTO billing_usage
       (tenant_id, period_start, period_end,
        api_requests, prompt_tokens, completion_tokens, pipeline_runs, knowledge_searches,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
     ON CONFLICT (tenant_id, period_start) DO UPDATE SET
       api_requests        = billing_usage.api_requests        + EXCLUDED.api_requests,
       prompt_tokens       = billing_usage.prompt_tokens       + EXCLUDED.prompt_tokens,
       completion_tokens   = billing_usage.completion_tokens   + EXCLUDED.completion_tokens,
       pipeline_runs       = billing_usage.pipeline_runs       + EXCLUDED.pipeline_runs,
       knowledge_searches  = billing_usage.knowledge_searches  + EXCLUDED.knowledge_searches,
       updated_at          = now()`,
    [
      tenantId,
      periodStart,
      periodEnd,
      delta.apiRequests ?? 0,
      delta.promptTokens ?? 0,
      delta.completionTokens ?? 0,
      delta.pipelineRuns ?? 0,
      delta.knowledgeSearches ?? 0,
    ],
  );
}

/** Retrieve usage summary for a tenant for a given billing period. */
export async function getUsageSummary(
  tenantId: string,
  periodStart?: string,
): Promise<BillingUsageSummary | null> {
  const pool = getPool();
  const now = new Date();
  const defaultPeriod = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const period = periodStart ?? defaultPeriod;

  const result = await pool.query(
    `SELECT * FROM billing_usage WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, period],
  );
  const row = result.rows[0] as {
    tenant_id: string;
    period_start: string;
    period_end: string;
    api_requests: string;
    prompt_tokens: string;
    completion_tokens: string;
    pipeline_runs: string;
    knowledge_searches: string;
  } | undefined;

  if (!row) return null;

  const promptTokens = parseInt(row.prompt_tokens, 10);
  const completionTokens = parseInt(row.completion_tokens, 10);
  const pipelineRuns = parseInt(row.pipeline_runs, 10);
  const estimatedCostUsd =
    (promptTokens / 1000) * PRICE_PER_1K_PROMPT +
    (completionTokens / 1000) * PRICE_PER_1K_COMPLETION +
    pipelineRuns * PRICE_PER_PIPELINE_RUN;

  return {
    tenantId: row.tenant_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    apiRequests: parseInt(row.api_requests, 10),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    pipelineRuns,
    knowledgeSearches: parseInt(row.knowledge_searches, 10),
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
  };
}

/** List all billing periods for a tenant (most recent first). */
export async function listBillingPeriods(tenantId: string, limit = 12): Promise<BillingUsageSummary[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM billing_usage WHERE tenant_id = $1 ORDER BY period_start DESC LIMIT $2`,
    [tenantId, limit],
  );

  return result.rows.map((row) => {
    const promptTokens = parseInt(row.prompt_tokens, 10);
    const completionTokens = parseInt(row.completion_tokens, 10);
    const pipelineRuns = parseInt(row.pipeline_runs, 10);
    const estimatedCostUsd =
      (promptTokens / 1000) * PRICE_PER_1K_PROMPT +
      (completionTokens / 1000) * PRICE_PER_1K_COMPLETION +
      pipelineRuns * PRICE_PER_PIPELINE_RUN;

    return {
      tenantId: row.tenant_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      apiRequests: parseInt(row.api_requests, 10),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      pipelineRuns,
      knowledgeSearches: parseInt(row.knowledge_searches, 10),
      estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    };
  });
}
