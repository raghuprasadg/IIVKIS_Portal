/**
 * Agent retry wrapper (Phase 7 — Resiliency).
 *
 * Wraps orchestrator agent dispatch with:
 *  1. Exponential-backoff retry (up to 3 attempts by default)
 *  2. Circuit breaker per agent type (named by AgentId)
 *  3. Tenant isolation enforcement — response tenantId must match request tenantId
 *
 * Retryable conditions:
 *  - Response status is 'failed' AND error.retryable === true
 *  - Exception thrown by agent handler
 *
 * Non-retryable:
 *  - Response status is 'failed' AND error.retryable === false (logic errors)
 *  - Tenant ID mismatch (security violation — never retried)
 */

import type { AgentRequest, AgentResponse, AgentId } from '@iivkis/shared';
import { retry, CircuitBreakerRegistry, CircuitOpenError } from '@iivkis/shared';

export interface AgentDispatchOptions {
  /** Max retry attempts (including first). Default: 3. */
  maxAttempts?: number;
  /** Initial backoff delay in ms. Default: 150. */
  initialDelayMs?: number;
  /** Max backoff delay in ms. Default: 5 000. */
  maxDelayMs?: number;
}

const DEFAULT_DISPATCH_OPTIONS: Required<AgentDispatchOptions> = {
  maxAttempts: 3,
  initialDelayMs: 150,
  maxDelayMs: 5_000,
};

/**
 * Dispatch a request to an agent handler with retry + circuit-breaker protection.
 *
 * @param agentId   Identifier used to namespace the circuit breaker.
 * @param handler   The agent's `handle(request)` function.
 * @param request   The task request to dispatch.
 * @param opts      Retry / circuit-breaker options.
 */
export async function dispatchWithResilience(
  agentId: AgentId | string,
  handler: (request: AgentRequest) => Promise<AgentResponse>,
  request: AgentRequest,
  opts: AgentDispatchOptions = {},
): Promise<AgentResponse> {
  const {
    maxAttempts = DEFAULT_DISPATCH_OPTIONS.maxAttempts,
    initialDelayMs = DEFAULT_DISPATCH_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_DISPATCH_OPTIONS.maxDelayMs,
  } = opts;

  const cb = CircuitBreakerRegistry.get(`agent:${agentId}`, {
    failureThreshold: 5,
    cooldownMs: 30_000,
  });

  const start = Date.now();

  try {
    const { value: response } = await retry(
      () =>
        cb.execute(async () => {
          const resp = await handler(request);

          // Tenant isolation enforcement
          if (resp.tenantId !== request.tenantId) {
            const isolationErr = new Error(
              `Tenant isolation violation: request tenantId=${request.tenantId} ` +
                `response tenantId=${resp.tenantId}`,
            );
            (isolationErr as Error & { retryable: boolean }).retryable = false;
            throw isolationErr;
          }

          // Treat non-retryable failures as real errors (they will NOT be retried)
          if (resp.status === 'failed' && resp.error?.retryable === false) {
            const hardErr = new Error(
              resp.error.message ?? 'Non-retryable agent failure',
            );
            (hardErr as Error & { retryable: boolean }).retryable = false;
            throw hardErr;
          }

          // Treat retryable failures as transient errors (they WILL be retried)
          if (resp.status === 'failed' && resp.error?.retryable !== false) {
            const transientErr = new Error(
              resp.error?.message ?? `Agent returned status '${resp.status}'`,
            );
            (transientErr as Error & { retryable: boolean }).retryable = true;
            throw transientErr;
          }

          // 'degraded' is a valid response the caller can surface directly.
          // Retrying degraded responses caused avoidable circuit-open failures
          // when upstream providers are intentionally unavailable.

          return resp;
        }),
      {
        maxAttempts,
        initialDelayMs,
        maxDelayMs,
        label: `agent:${agentId}:${request.taskType}`,
        isRetryable: (err) => {
          if (err instanceof CircuitOpenError) return false; // circuit open — don't retry
          const e = err as Error & { retryable?: boolean };
          return e.retryable !== false;
        },
      },
    );

    return response;
  } catch (err) {
    // Build a structured degraded response so the API layer always gets a valid AgentResponse
    const isCircuitOpen = err instanceof CircuitOpenError;
    return {
      taskId: request.taskId,
      status: 'failed',
      tenantId: request.tenantId,
      error: {
        code: isCircuitOpen ? 'CIRCUIT_OPEN' : 'DISPATCH_FAILED',
        message: err instanceof Error ? err.message : String(err),
        retryable: isCircuitOpen,
        ...(isCircuitOpen
          ? { retryAfterMs: (err as CircuitOpenError).retryAfter - Date.now() }
          : {}),
      },
      latencyMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}
