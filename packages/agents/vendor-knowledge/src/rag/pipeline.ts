/**
 * Full RAG pipeline: retrieval → prompt assembly → LLM completion (LLD §5).
 */

import type { LLMMessage } from '@iivkis/shared';
import type { LLMGateway } from './llm-gateway';
import type { HybridRetriever, RAGQuery, RetrievalResult } from './retrieval';

export interface RAGResponse {
  answer: string;
  sources: Array<{
    articleId: string;
    chunkText: string;
    score: number;
  }>;
  tokensUsed: number;
  model: string;
  cached: boolean;
}

const SYSTEM_PROMPT =
  'You are an IT knowledge assistant. Answer using only the provided context. ' +
  'If the context does not contain enough information, say so clearly.';

const MAX_CONTEXT_CHUNKS = 5;

export class RAGPipeline {
  constructor(
    private readonly retriever: HybridRetriever,
    private readonly gateway: LLMGateway,
  ) {}

  async query(q: RAGQuery, taskId: string): Promise<RAGResponse> {
    // 1. Retrieve relevant chunks
    const results = await this.retriever.retrieve(q);
    const topChunks = results.slice(0, MAX_CONTEXT_CHUNKS);

    // 2. Assemble prompt
    const messages = this.assembleMessages(topChunks, q.query);

    // 3. Call LLM
    const llmResp = await this.gateway.complete({
      taskId,
      tenantId: q.tenantId,
      messages,
      cacheable: true,
      taskType: 'search',
    });

    // 4. Build structured response
    return {
      answer: llmResp.content,
      sources: topChunks.map((c) => ({
        articleId: c.articleId,
        chunkText: c.text,
        score: c.score,
      })),
      tokensUsed: llmResp.tokensPrompt + llmResp.tokensCompletion,
      model: llmResp.model,
      cached: llmResp.cached,
    };
  }

  /* ── private helpers ────────────────────────────────────────────────────── */

  private assembleMessages(
    chunks: RetrievalResult[],
    userQuery: string,
  ): LLMMessage[] {
    const contextBlock =
      chunks.length > 0
        ? chunks
            .map((c, i) => `[Source ${i + 1} — article: ${c.articleId}]\n${c.text}`)
            .join('\n\n---\n\n')
        : '(No relevant context found in the knowledge base.)';

    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Context:\n\n${contextBlock}\n\nQuestion: ${userQuery}`,
      },
    ];
  }
}
