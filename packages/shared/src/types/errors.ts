/**
 * Error handling, circuit-breaker, and retry types (LLD §10).
 */

/** Standard API error envelope (no stack traces in production). */
export interface ApiError {
  error: {
    /** Machine-readable code, e.g. TENANT_NOT_FOUND | RATE_LIMIT_EXCEEDED. */
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Circuit-breaker configuration per external dependency (LLD §10.2). */
export interface CircuitBreakerConfig {
  name: string;
  /** Consecutive failures before opening. Default: 5. */
  failureThreshold: number;
  /** Window in ms within which failures are counted. Default: 60_000. */
  failureWindowMs: number;
  /** Interval in ms between probes in HALF_OPEN state. Default: 30_000. */
  halfOpenProbeIntervalMs: number;
  /** Consecutive successes needed to close from HALF_OPEN. Default: 2. */
  halfOpenSuccessThreshold: number;
  /** Per-request timeout before counting as a failure. */
  timeoutMs: number;
}

/** Retry policy for agent-to-agent and agent-to-external calls (LLD §10.3). */
export interface RetryPolicy {
  /** Default: 3 (0 for streaming calls). */
  maxRetries: number;
  /** Initial backoff delay in ms. Default: 500. */
  initialDelayMs: number;
  /** Exponential multiplier. Default: 2.0. */
  backoffMultiplier: number;
  /** Maximum delay cap in ms. Default: 30_000. */
  maxDelayMs: number;
  /** Random jitter factor 0.0–1.0. Default: 0.3. */
  jitterFactor: number;
  /** HTTP status codes that trigger a retry. Default: [429,500,502,503,504]. */
  retryableStatusCodes: number[];
}
