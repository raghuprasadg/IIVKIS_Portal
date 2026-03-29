/**
 * Exponential-backoff retry utility (Phase 7 — Resiliency).
 *
 * Retries an async operation with jittered exponential backoff.
 * Suitable for wrapping any fallible async call (HTTP, DB, queue).
 *
 * Features:
 *  - Configurable max attempts, initial delay, max delay, backoff multiplier
 *  - Full jitter (random in [0, delay]) to avoid thundering herd
 *  - Per-attempt error filter (retryable predicate)
 *  - Structured retry log for observability
 *  - Abort signal support for graceful cancellation
 *
 * Usage:
 *   const result = await retry(
 *     () => fetchFromUpstream(input),
 *     { maxAttempts: 4, initialDelayMs: 100, label: 'upstream-fetch' },
 *   );
 */

export interface RetryOptions {
  /** Total number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Initial backoff delay in ms. Default: 200 ms. */
  initialDelayMs?: number;
  /** Maximum backoff delay in ms. Default: 10 000 ms. */
  maxDelayMs?: number;
  /** Backoff multiplier applied after each failure. Default: 2. */
  backoffMultiplier?: number;
  /**
   * Predicate to decide if an error is retryable.
   * When omitted all errors are retried up to maxAttempts.
   */
  isRetryable?: (err: unknown, attempt: number) => boolean;
  /** Human-readable label for logging. */
  label?: string;
  /** AbortSignal to cancel pending retries. */
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
  totalLatencyMs: number;
}

const DEFAULT_OPTIONS = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
} as const;

/** Sleep for `ms` milliseconds, respecting an optional AbortSignal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Retry aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Retry aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Apply full jitter: random in [0, delay]. */
function jitter(delay: number): number {
  return Math.random() * delay;
}

/**
 * Execute `fn` with exponential-backoff retries.
 *
 * @throws The last error if all attempts are exhausted.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    isRetryable,
    label = 'retry',
    signal,
  } = options;

  const start = Date.now();
  let delay = initialDelayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Retry aborted', 'AbortError');
    }

    try {
      const value = await fn();
      if (attempt > 1) {
        console.log(`[${label}] Succeeded on attempt ${attempt}`);
      }
      return { value, attempts: attempt, totalLatencyMs: Date.now() - start };
    } catch (err) {
      lastError = err;

      const retryable = isRetryable ? isRetryable(err, attempt) : true;
      if (!retryable || attempt === maxAttempts) {
        console.warn(
          `[${label}] Giving up after ${attempt} attempt(s): ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }

      const backoffMs = Math.min(jitter(delay), maxDelayMs);
      console.log(
        `[${label}] Attempt ${attempt} failed — retrying in ${backoffMs.toFixed(0)} ms: ` +
          (err instanceof Error ? err.message : String(err)),
      );
      await sleep(backoffMs, signal);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  // Should not be reached, but TypeScript requires it
  throw lastError;
}

/**
 * Determine if an HTTP status code should trigger a retry.
 * Retries on transient server errors (429, 502, 503, 504) but not on
 * client errors (4xx except 429) or success (2xx, 3xx).
 */
export function isHttpRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
