/**
 * Engineering Orchestrator — coordinates all IIVKIS AI agents.
 *
 * Responsibilities:
 *  - Receive task requests from the API layer
 *  - Route tasks to the appropriate agent(s)
 *  - Aggregate and return results
 */
import type {
  AgentRequest,
  AgentResponse,
  LLMCompletionRequest,
  EmbeddingRequest,
} from '@iivkis/shared';
import { LLMGateway } from './llm-gateway';
import type { LLMGatewayConfig } from './llm-gateway';
import * as analysisAgent from '@iivkis/agents-analysis';
import * as integrationAgent from '@iivkis/agents-integration';
import * as vkAgent from '@iivkis/agents-vendor-knowledge';
import * as tsAgent from '@iivkis/agents-troubleshooting';

export interface OrchestratorConfig {
  /** Maximum concurrent agent tasks */
  maxConcurrency: number;
  /** Timeout per agent invocation in milliseconds */
  agentTimeoutMs: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrency: 4,
  agentTimeoutMs: 30_000,
};

/* ── singleton gateway instance ─────────────────────────────────────────── */

const GATEWAY_CONFIG: LLMGatewayConfig = {
  defaultProvider: {
    name: 'openai',
    baseUrl: process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1',
    apiKey: process.env['LLM_API_KEY'] ?? '',
  },
  modelTierMap: {
    fast: process.env['LLM_MODEL_FAST'] ?? 'gpt-4o-mini',
    capable: process.env['LLM_MODEL_CAPABLE'] ?? 'gpt-4o',
    auto: process.env['LLM_MODEL_AUTO'] ?? 'gpt-4o-mini',
  },
  maxBudgetTokensPerDay: Number(process.env['LLM_BUDGET_TOKENS_PER_DAY'] ?? 1_000_000),
  cacheSimilarityThreshold: 0.97,
};

const gateway = new LLMGateway(GATEWAY_CONFIG);

/* ── router ──────────────────────────────────────────────────────────────── */

/**
 * Orchestrates a request across the relevant agents and returns
 * a consolidated response.
 */
export async function orchestrate(
  request: AgentRequest,
  config: OrchestratorConfig = DEFAULT_CONFIG,
): Promise<AgentResponse> {
  void config;
  const start = Date.now();

  try {
    switch (request.taskType) {
      /* ── LLM Gateway routes ───────────────────────────────────────────── */
      case 'llm.complete': {
        const llmReq = request.payload as unknown as LLMCompletionRequest;
        const resp = await gateway.complete({
          ...llmReq,
          taskId: request.taskId,
          tenantId: request.tenantId,
          userId: request.userId,
        });
        return {
          taskId: request.taskId,
          status: resp.content ? 'success' : 'degraded',
          tenantId: request.tenantId,
          result: resp as unknown as Record<string, unknown>,
          modelUsed: resp.model,
          tokensUsed: resp.tokensPrompt + resp.tokensCompletion,
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      case 'llm.embed': {
        const embedReq = request.payload as unknown as EmbeddingRequest;
        const resp = await gateway.embed({
          ...embedReq,
          taskId: request.taskId,
          tenantId: request.tenantId,
        });
        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: resp as unknown as Record<string, unknown>,
          modelUsed: resp.model,
          tokensUsed: resp.tokensUsed,
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      /* ── Vendor Knowledge routes ─────────────────────────────────────── */
      case 'vk.search':
      case 'vk.ingest':
      case 'vk.article.get':
        return vkAgent.handle(request);

      /* ── Troubleshooting routes ──────────────────────────────────────── */
      case 'ts.plan.generate':
      case 'ts.chat.turn':
        return tsAgent.handle(request);

      /* ── Integration routes ──────────────────────────────────────────── */
      case 'int.sync':
      case 'int.webhook.process':
        return integrationAgent.handle(request);

      /* ── Analysis / Correlation routes ──────────────────────────────── */
      case 'anlys.report':
      case 'anlys.anomaly':
      case 'ce.signal.ingest':
      case 'ce.group.query':
        return analysisAgent.handle(request);

      default: {
        const unknown: string = (request as AgentRequest).taskType;
        return {
          taskId: request.taskId,
          status: 'failed',
          tenantId: request.tenantId,
          error: {
            code: 'UNKNOWN_TASK_TYPE',
            message: `Unknown task type: ${unknown}`,
            retryable: false,
          },
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    return {
      taskId: request.taskId,
      status: 'failed',
      tenantId: request.tenantId,
      error: {
        code: 'ORCHESTRATOR_ERROR',
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}
