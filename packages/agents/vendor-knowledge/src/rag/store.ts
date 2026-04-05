import type { Chunk } from './chunker';

export interface StoredChunk extends Chunk {
  chunkId: string;
  embedding: number[];
  title: string;
  vendorId?: string;
  tags: string[];
}

export interface StoredArticle {
  articleId: string;
  tenantId: string;
  title: string;
  content: string;
  vendorId?: string;
  tags: string[];
  chunks: StoredChunk[];
  updatedAt: string;
}

export interface UpsertArticleInput {
  articleId: string;
  tenantId: string;
  title: string;
  content: string;
  vendorId?: string;
  tags?: string[];
  chunks: Array<Chunk & { embedding: number[] }>;
}

export class KnowledgeBaseStore {
  private readonly articlesByTenant = new Map<string, Map<string, StoredArticle>>();

  upsertArticle(input: UpsertArticleInput): StoredArticle {
    let tenantArticles = this.articlesByTenant.get(input.tenantId);
    if (!tenantArticles) {
      tenantArticles = new Map<string, StoredArticle>();
      this.articlesByTenant.set(input.tenantId, tenantArticles);
    }

    const article: StoredArticle = {
      articleId: input.articleId,
      tenantId: input.tenantId,
      title: input.title,
      content: input.content,
      ...(input.vendorId !== undefined && { vendorId: input.vendorId }),
      tags: input.tags ?? [],
      chunks: input.chunks.map((chunk) => ({
        ...chunk,
        chunkId: `${input.articleId}#${chunk.index}`,
        title: input.title,
        ...(input.vendorId !== undefined && { vendorId: input.vendorId }),
        tags: input.tags ?? [],
      })),
      updatedAt: new Date().toISOString(),
    };

    tenantArticles.set(input.articleId, article);
    return article;
  }

  getArticle(tenantId: string, articleId: string): StoredArticle | undefined {
    return this.articlesByTenant.get(tenantId)?.get(articleId);
  }

  listChunks(
    tenantId: string,
    filters?: { vendorId?: string; tags?: string[] },
  ): StoredChunk[] {
    const tenantArticles = this.articlesByTenant.get(tenantId);
    if (!tenantArticles) return [];

    return Array.from(tenantArticles.values())
      .filter((article) => {
        if (filters?.vendorId && article.vendorId !== filters.vendorId) return false;
        if (filters?.tags?.length) {
          const articleTags = new Set(article.tags.map((tag) => tag.toLowerCase()));
          return filters.tags.every((tag) => articleTags.has(tag.toLowerCase()));
        }
        return true;
      })
      .flatMap((article) => article.chunks);
  }

  clear(): void {
    this.articlesByTenant.clear();
  }
}

export const knowledgeBaseStore = new KnowledgeBaseStore();