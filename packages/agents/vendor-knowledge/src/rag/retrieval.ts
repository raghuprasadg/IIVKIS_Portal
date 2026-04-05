/**
 * Hybrid retrieval: vector search + FTS + KG traversal, merged with RRF (LLD §5).
 *
 * This implementation keeps an in-memory index so ingestion/search work in
 * development and tests before the external stores are connected.
 */

import type { LLMGateway } from './llm-gateway';
import { knowledgeBaseStore } from './store';

export interface RetrievalResult {
  chunkId: string;
  articleId: string;
  text: string;
  /** Final RRF score (or raw score if no merge needed). */
  score: number;
  source: 'vector' | 'fts' | 'kg';
}

export interface RAGQuery {
  query: string;
  tenantId: string;
  topK?: number;
  filters?: {
    vendorId?: string;
    tags?: string[];
  };
}

/** Standard RRF k-constant (Cormack et al., 2009). */
const RRF_K = 60;

export class HybridRetriever {
  constructor(private readonly gateway: LLMGateway) {}

  async retrieve(q: RAGQuery): Promise<RetrievalResult[]> {
    const topK = q.topK ?? 10;

    const embeddingResp = await this.gateway.embed({
      taskId: `embed-${q.tenantId}-${Date.now()}`,
      tenantId: q.tenantId,
      texts: [q.query],
    });
    const queryEmbedding = embeddingResp.embeddings[0] ?? [];
    const entities = q.query
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
      .slice(0, 5);

    const [vectorResults, ftsResults, kgResults] = await Promise.all([
      this.vectorSearch(queryEmbedding, q.tenantId, topK, q.filters),
      this.fullTextSearch(q.query, q.tenantId, topK, q.filters),
      this.kgTraversal(entities, q.tenantId, q.filters, topK),
    ]);

    return this.rrf([vectorResults, ftsResults, kgResults]).slice(0, topK);
  }

  /* ── search backends (stubs) ─────────────────────────────────────────────── */

  private async vectorSearch(
    embedding: number[],
    tenantId: string,
    topK: number,
    filters?: RAGQuery['filters'],
  ): Promise<RetrievalResult[]> {
    if (embedding.length === 0) return [];

    return knowledgeBaseStore
      .listChunks(tenantId, filters)
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        articleId: chunk.articleId,
        text: chunk.text,
        score: cosineSimilarity(embedding, chunk.embedding),
        source: 'vector' as const,
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async fullTextSearch(
    query: string,
    tenantId: string,
    topK: number,
    filters?: RAGQuery['filters'],
  ): Promise<RetrievalResult[]> {
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    return knowledgeBaseStore
      .listChunks(tenantId, filters)
      .map((chunk) => {
        const haystack = `${chunk.title} ${chunk.text} ${chunk.tags.join(' ')}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return {
          chunkId: chunk.chunkId,
          articleId: chunk.articleId,
          text: chunk.text,
          score,
          source: 'fts' as const,
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async kgTraversal(
    entities: string[],
    tenantId: string,
    filters: RAGQuery['filters'] | undefined,
    topK: number,
  ): Promise<RetrievalResult[]> {
    return knowledgeBaseStore
      .listChunks(tenantId, filters)
      .map((chunk) => {
        const metadata = `${chunk.vendorId ?? ''} ${chunk.title} ${chunk.tags.join(' ')}`.toLowerCase();
        const score = entities.reduce((sum, entity) => sum + (metadata.includes(entity) ? 1 : 0), 0);
        return {
          chunkId: chunk.chunkId,
          articleId: chunk.articleId,
          text: chunk.text,
          score,
          source: 'kg' as const,
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /* ── Reciprocal Rank Fusion ──────────────────────────────────────────────── */

  /**
   * Merge ranked lists using RRF.
   *
   * score(d) = Σ_i  1 / (k + rank_i(d))
   *
   * where rank_i is the 1-based position of document d in list i,
   * and k=60 is the standard constant that down-weights top-ranked documents.
   */
  private rrf(resultLists: RetrievalResult[][]): RetrievalResult[] {
    const scores = new Map<string, number>();
    // Keep the first occurrence of each result for metadata
    const meta = new Map<string, RetrievalResult>();

    for (const list of resultLists) {
      list.forEach((result, idx) => {
        const rank = idx + 1;
        const prev = scores.get(result.chunkId) ?? 0;
        scores.set(result.chunkId, prev + 1 / (RRF_K + rank));
        if (!meta.has(result.chunkId)) {
          meta.set(result.chunkId, result);
        }
      });
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([chunkId, score]) => {
        const base = meta.get(chunkId) as RetrievalResult;
        return { ...base, score };
      });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
