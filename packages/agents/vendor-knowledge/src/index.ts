/**
 * Vendor Knowledge Agent
 *
 * Responsibilities:
 *  - Query and index vendor/product data from internal and external sources
 *  - Respond to knowledge lookup requests from the orchestrator
 *  - Maintain an up-to-date vendor knowledge graph
 */
import type { AgentRequest, AgentResponse, AgentError } from '@iivkis/shared';

import { HybridRetriever, RAGPipeline, LLMGateway, chunkArticle, knowledgeBaseStore } from './rag';
import type { RAGQuery } from './rag';

export const AGENT_ID = 'agent-vendor-knowledge' as const;

/* ── singleton instances ────────────────────────────────────────────────── */

const llmGateway = new LLMGateway();
const retriever = new HybridRetriever(llmGateway);
const ragPipeline = new RAGPipeline(retriever, llmGateway);

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

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
        const articleId = String(request.payload['articleId'] ?? '').trim();
        const title = String(request.payload['title'] ?? request.payload['headline'] ?? articleId).trim();
        const content = String(
          request.payload['content'] ?? request.payload['text'] ?? request.payload['body'] ?? '',
        ).trim();
        const vendorId = typeof request.payload['vendorId'] === 'string'
          ? request.payload['vendorId']
          : undefined;
        const tags = normalizeTags(request.payload['tags']);

        if (!articleId) {
          return degraded(request, start, 'vk.ingest requires "articleId".');
        }
        if (!content) {
          return degraded(request, start, 'vk.ingest requires article content in "content", "text", or "body".');
        }

        const chunks = chunkArticle(content, articleId);
        const embeddingResp = await llmGateway.embed({
          taskId: `${request.taskId}-embed`,
          tenantId: request.tenantId,
          texts: chunks.map((chunk) => chunk.text),
        });

        const article = knowledgeBaseStore.upsertArticle({
          articleId,
          tenantId: request.tenantId,
          title: title || articleId,
          content,
          ...(vendorId !== undefined && { vendorId }),
          tags,
          chunks: chunks.map((chunk, index) => ({
            ...chunk,
            embedding: embeddingResp.embeddings[index] ?? [],
          })),
        });

        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: {
            articleId,
            ingested: true,
            chunkCount: article.chunks.length,
            embeddingModel: embeddingResp.model,
            tokensUsed: embeddingResp.tokensUsed,
          },
          latencyMs: Date.now() - start,
          createdAt: new Date().toISOString(),
        };
      }

      case 'vk.article.get': {
        const articleId = String(request.payload['articleId'] ?? '');
        if (!articleId) {
          return degraded(request, start, 'vk.article.get requires "articleId".');
        }

        const article = knowledgeBaseStore.getArticle(request.tenantId, articleId);
        if (!article) {
          return {
            taskId: request.taskId,
            status: 'degraded',
            tenantId: request.tenantId,
            result: { articleId, found: false, message: 'Article not found in the knowledge store.' },
            latencyMs: Date.now() - start,
            createdAt: new Date().toISOString(),
          };
        }

        return {
          taskId: request.taskId,
          status: 'success',
          tenantId: request.tenantId,
          result: {
            articleId,
            found: true,
            title: article.title,
            content: article.content,
            ...(article.vendorId !== undefined && { vendorId: article.vendorId }),
            tags: article.tags,
            chunkCount: article.chunks.length,
            updatedAt: article.updatedAt,
          },
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
