/**
 * LLM Gateway — public re-exports.
 */

export { LLMGateway } from './gateway';
export { CircuitBreaker } from './circuit-breaker';
export { redact, containsPii } from './pii-redactor';
export { classify } from './complexity-classifier';
export { validateCompletion } from './validation';
export type {
  ModelTier,
  TaskComplexity,
  ModelTierMap,
  LLMProvider,
  CircuitBreakerState,
  LLMGatewayConfig,
  ValidationResult,
  CacheEntry,
} from './types';
