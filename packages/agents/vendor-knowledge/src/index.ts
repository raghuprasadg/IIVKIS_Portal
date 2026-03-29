/**
 * Vendor Knowledge Agent
 *
 * Responsibilities:
 *  - Query and index vendor/product data from internal and external sources
 *  - Respond to knowledge lookup requests from the orchestrator
 *  - Maintain an up-to-date vendor knowledge graph
 */
import type { AgentRequest, AgentResponse, AgentError } from '@iivkis/shared';
import { HybridRetriever, RAGPipeline, LLMGateway } from './rag';
import type { RAGQuery } from './rag';

export const AGENT_ID = 'agent-vendor-knowledge' as const;

/* ── singleton instances ────────────────────────────────────────────────── */

const llmGateway = new LLMGateway();
const retriever = new HybridRetriever();
const ragPipeline = new RAGPipeline(retriever, llmGateway);

/* ── helpers ────────────────────────────────────────────────────────────── */

function degraded(
  request: AgentRequest,
  start: number,
  message: string,
): AgentResponse {
  const error: AgentError = {
    code: 'VK_AGENT_ERROR',
    message,
    retryable: true,
  };
  return {
    taskId: request.taskId,
    status: 'degraded',
    tenantId: request.tenantId,
    error,
    latencyMs: Date.now() - start,
    createdAt: new Date().toISOString(),
  };
}

/* ── main handler ───────────────────────────────────────────────────────── */

/**
 * Handle a vendor-knowledge task request.
 */
export async function handle(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();

  try {
    switch (request.taskType) {
      case 'vk.search': {
        const rawFilters = request.payload['filters'] as RAGQuery['filters'] | undefined;
        const q: RAGQuery = {
          query: String(request.payload['query'] ?? ''),
          tenantId: request.tenantId,
          topK: typeof request.payload['topK'] === 'number' ? request.payload['topK'] : 10,
          ...(rawFilters !== undefined && { filters: rawFilters }),
        };

        if (!q.query.trim()) {
          return degraded(request, start, 'vk.search requires a non-empty "query" field.');
        }

        const ragResponse = await ragPipeline.query(q, request.taskId);

        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: ragResponse as unknown as Record<string, unknown>,
          modelUsed: ragResponse.model,
          tokensUsed: ragResponse.tokensUsed,
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      case 'vk.ingest': {
        // TODO: implement full ingestion pipeline (chunking → embedding → upsert)
        const articleId = String(request.payload['articleId'] ?? 'unknown');
        console.log(`[vk-agent] Stub ingest received for article ${articleId} (tenant ${request.tenantId})`);
        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: { articleId, ingested: false, message: 'Ingestion pipeline not yet connected.' },
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      case 'vk.article.get': {
        // TODO: implement real DB lookup
        const articleId = String(request.payload['articleId'] ?? '');
        if (!articleId) {
          return degraded(request, start, 'vk.article.get requires "articleId".');
        }
        return {
          taskId: request.taskId,
          status: 'degraded',
          tenantId: request.tenantId,
          result: { articleId, found: false, message: 'Article DB not yet connected.' },
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      default:
        return degraded(
          request,
          start,
          `Vendor Knowledge agent does not handle task type: ${request.taskType}.`,
        );
    }
  } catch (err) {
    return degraded(
      request,
      start,
      err instanceof Error ? err.message : String(err),
    );
  }
}
