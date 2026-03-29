/**
 * Hybrid retrieval: vector search + FTS + KG traversal, merged with RRF (LLD §5).
 *
 * Individual search backends are stubs (DB not available at this stage).
 * The RRF merge logic is fully functional.
 */

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
  async retrieve(q: RAGQuery): Promise<RetrievalResult[]> {
    const topK = q.topK ?? 10;

    // TODO: replace with real embedding call
    const mockEmbedding: number[] = [];

    // TODO: replace with real entity extraction
    const mockEntities: string[] = q.query.split(/\s+/).slice(0, 3);

    const [vectorResults, ftsResults, kgResults] = await Promise.all([
      this.vectorSearch(mockEmbedding, q.tenantId, topK),
      this.fullTextSearch(q.query, q.tenantId, topK),
      this.kgTraversal(mockEntities, q.tenantId),
    ]);

    return this.rrf([vectorResults, ftsResults, kgResults]).slice(0, topK);
  }

  /* ── search backends (stubs) ─────────────────────────────────────────────── */

  // TODO: call pgvector similarity search once DB is available
  private async vectorSearch(
    _embedding: number[],
    _tenantId: string,
    _topK: number,
  ): Promise<RetrievalResult[]> {
    return [];
  }

  // TODO: call PostgreSQL full-text search once DB is available
  private async fullTextSearch(
    _query: string,
    _tenantId: string,
    _topK: number,
  ): Promise<RetrievalResult[]> {
    return [];
  }

  // TODO: call knowledge-graph traversal service once available
  private async kgTraversal(
    _entities: string[],
    _tenantId: string,
  ): Promise<RetrievalResult[]> {
    return [];
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
