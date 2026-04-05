/**
 * RAG pipeline — public re-exports.
 */

export { chunkArticle } from './chunker';
export type { Chunk } from './chunker';

export { HybridRetriever } from './retrieval';
export type { RetrievalResult, RAGQuery } from './retrieval';

export { RAGPipeline } from './pipeline';
export type { RAGResponse } from './pipeline';

export { LLMGateway } from './llm-gateway';
export type { LLMGatewayClientConfig } from './llm-gateway';

export { knowledgeBaseStore } from './store';
export type { StoredArticle, StoredChunk } from './store';
