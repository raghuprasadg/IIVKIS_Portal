/**
 * Internal LLM Gateway types (LLD §7.1).
 */

export type ModelTier = 'fast' | 'capable' | 'auto';
export type TaskComplexity = 'simple' | 'moderate' | 'complex';

export interface ModelTierMap {
  fast: string;
  capable: string;
  auto: string;
}

export interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface CircuitBreakerState {
  failures: number;
  openUntil: Date | null;
}

export interface LLMGatewayConfig {
  defaultProvider: LLMProvider;
  fallbackProvider?: LLMProvider;
  modelTierMap: ModelTierMap;
  /** Maximum token budget per tenant per day. */
  maxBudgetTokensPerDay: number;
  /** Cosine similarity threshold for semantic cache hits. Default 0.97. */
  cacheSimilarityThreshold: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface CacheEntry {
  messagesHash: string;
  response: import('@iivkis/shared').LLMCompletionResponse;
  createdAt: number;
}
