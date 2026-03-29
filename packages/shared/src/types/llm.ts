/**
 * LLM Gateway interface types (LLD §4.1, §7).
 */

export interface LLMCompletionRequest {
  taskId: string;
  tenantId: string;
  userId?: string;
  /** 'auto' | 'fast' | 'capable' | explicit model name */
  model?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Enable server-sent-events streaming (FR-LLM-017). */
  stream?: boolean;
  taskType?: 'chat' | 'plan' | 'search' | 'summary' | 'embedding';
  /** Opt-in to semantic caching. */
  cacheable?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionResponse {
  taskId: string;
  content: string;
  model: string;
  tokensPrompt: number;
  tokensCompletion: number;
  cached: boolean;
  provider: string;
  latencyMs: number;
}

export type LLMStreamChunk =
  | { type: 'delta'; content: string; done: false }
  | { type: 'done'; totalTokens: number; done: true };

/** Embedding request (used internally by VK Agent and LLM Gateway). */
export interface EmbeddingRequest {
  taskId: string;
  tenantId: string;
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  taskId: string;
  embeddings: number[][];
  model: string;
  tokensUsed: number;
}
