/**
 * Generalized circuit breaker (Phase 7 — Resiliency).
 *
 * State machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * Improvements over the LLM-gateway-specific CircuitBreaker:
 *  - Configurable thresholds per instance
 *  - State-change event callbacks for observability
 *  - `execute()` helper that wraps a call with automatic success/failure tracking
 *  - Named circuit breakers via a shared registry
 *
 * Usage:
 *   const cb = CircuitBreakerRegistry.get('neo4j', { failureThreshold: 3 });
 *   const result = await cb.execute(() => neo4jQuery(cypher));
 */

export type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening. Default: 5. */
  failureThreshold?: number;
  /** Cooldown period in ms before transitioning OPEN → HALF_OPEN. Default: 60 000. */
  cooldownMs?: number;
  /** Called whenever the CB transitions between states. */
  onStateChange?: (from: CBState, to: CBState, name: string) => void;
}

const DEFAULT_OPTIONS = {
  failureThreshold: 5,
  cooldownMs: 60_000,
} as const;

export class CircuitBreaker {
  private state: CBState = 'CLOSED';
  private failures = 0;
  private openUntil: number | null = null;

  constructor(
    public readonly name: string,
    private readonly opts: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> & {
      onStateChange?: CircuitBreakerOptions['onStateChange'];
    },
  ) {}

  /** Returns true when the circuit is OPEN and requests should be rejected. */
  isOpen(): boolean {
    if (this.state === 'CLOSED') return false;

    if (this.state === 'OPEN') {
      if (this.openUntil !== null && Date.now() >= this.openUntil) {
        this.transition('HALF_OPEN');
        return false;
      }
      return true;
    }

    // HALF_OPEN: allow one probe request
    return false;
  }

  recordSuccess(): void {
    if (this.state !== 'CLOSED') this.transition('CLOSED');
    this.failures = 0;
    this.openUntil = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.opts.failureThreshold) {
      this.transition('OPEN');
      this.openUntil = Date.now() + this.opts.cooldownMs;
    }
  }

  getState(): CBState {
    // Trigger OPEN → HALF_OPEN transition if cooldown elapsed
    void this.isOpen();
    return this.state;
  }

  getStats(): { state: CBState; failures: number; openUntil: number | null } {
    return { state: this.getState(), failures: this.failures, openUntil: this.openUntil };
  }

  /**
   * Execute a function protected by this circuit breaker.
   * - Throws `CircuitOpenError` immediately when OPEN.
   * - Records success/failure automatically.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(this.name, this.openUntil ?? Date.now() + this.opts.cooldownMs);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private transition(to: CBState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.opts.onStateChange?.(from, to, this.name);
    console.log(`[circuit-breaker:${this.name}] ${from} → ${to}`);
  }
}

/** Thrown when a circuit is OPEN and an execute() is attempted. */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfter: number,
  ) {
    super(`Circuit '${circuitName}' is OPEN — retry after ${new Date(retryAfter).toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

/* ── named registry ──────────────────────────────────────────────────────── */

const registry = new Map<string, CircuitBreaker>();

export const CircuitBreakerRegistry = {
  /**
   * Get or create a named circuit breaker.
   * Options are only applied on first creation — subsequent calls return the
   * existing instance regardless of the options passed.
   */
  get(name: string, opts: CircuitBreakerOptions = {}): CircuitBreaker {
    if (!registry.has(name)) {
      registry.set(
        name,
        new CircuitBreaker(name, {
          failureThreshold: opts.failureThreshold ?? DEFAULT_OPTIONS.failureThreshold,
          cooldownMs: opts.cooldownMs ?? DEFAULT_OPTIONS.cooldownMs,
          onStateChange: opts.onStateChange,
        }),
      );
    }
    return registry.get(name)!;
  },

  /** List all registered circuit breaker names + stats. */
  all(): Array<{ name: string } & ReturnType<CircuitBreaker['getStats']>> {
    return [...registry.entries()].map(([name, cb]) => ({ name, ...cb.getStats() }));
  },

  /** Reset a named circuit breaker (for testing). */
  reset(name: string): void {
    registry.delete(name);
  },

  /** Reset all circuit breakers (for testing). */
  resetAll(): void {
    registry.clear();
  },
};
