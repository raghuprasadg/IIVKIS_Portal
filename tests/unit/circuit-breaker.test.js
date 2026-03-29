'use strict';
/**
 * Unit tests — CircuitBreaker & CircuitBreakerRegistry
 * Source: packages/shared/src/resiliency/circuit-breaker.ts
 * Compiled: packages/shared/dist/resiliency/circuit-breaker.js
 */

const path = require('path');
const {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
} = require(path.resolve(__dirname, '../../packages/shared/dist/resiliency/circuit-breaker'));

// Silence console.log noise from state transitions during tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  CircuitBreakerRegistry.resetAll();
});
afterEach(() => {
  jest.restoreAllMocks();
});

/* ── CircuitBreaker state machine ─────────────────────────────────────────── */

describe('CircuitBreaker — state machine', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker('test-initial', { failureThreshold: 3, cooldownMs: 1000 });
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });

  it('transitions CLOSED → OPEN after reaching failure threshold', () => {
    const cb = new CircuitBreaker('test-open', { failureThreshold: 3, cooldownMs: 60_000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED'); // not yet
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('stays OPEN during cooldown period', () => {
    const cb = new CircuitBreaker('test-cooldown', { failureThreshold: 1, cooldownMs: 60_000 });
    cb.recordFailure(); // → OPEN
    expect(cb.getState()).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('transitions OPEN → HALF_OPEN after cooldown elapses', async () => {
    const cb = new CircuitBreaker('test-halfopen', { failureThreshold: 1, cooldownMs: 5 });
    cb.recordFailure(); // → OPEN
    expect(cb.getState()).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 20));
    expect(cb.isOpen()).toBe(false); // probe allowed
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('transitions HALF_OPEN → CLOSED on success probe', async () => {
    const cb = new CircuitBreaker('test-close', { failureThreshold: 1, cooldownMs: 5 });
    cb.recordFailure(); // → OPEN
    await new Promise((r) => setTimeout(r, 20));
    cb.isOpen(); // → HALF_OPEN
    cb.recordSuccess(); // → CLOSED
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions HALF_OPEN → OPEN on failure probe', async () => {
    const cb = new CircuitBreaker('test-reopen', { failureThreshold: 1, cooldownMs: 5 });
    cb.recordFailure(); // → OPEN
    await new Promise((r) => setTimeout(r, 20));
    cb.isOpen(); // → HALF_OPEN
    cb.recordFailure(); // → OPEN again
    expect(cb.getState()).toBe('OPEN');
  });

  it('recordSuccess resets failure count and keeps circuit CLOSED', () => {
    const cb = new CircuitBreaker('test-reset', { failureThreshold: 5, cooldownMs: 60_000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getStats().failures).toBe(0);
  });

  it('onStateChange callback fires on CLOSED → OPEN transition', () => {
    const transitions = [];
    const cb = new CircuitBreaker('test-callback', {
      failureThreshold: 2,
      cooldownMs: 60_000,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });
    cb.recordFailure();
    cb.recordFailure(); // → OPEN
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({ from: 'CLOSED', to: 'OPEN' });
  });
});

/* ── CircuitBreaker.execute() ─────────────────────────────────────────────── */

describe('CircuitBreaker.execute()', () => {
  it('returns the wrapped function result when CLOSED', async () => {
    const cb = new CircuitBreaker('exec-closed', { failureThreshold: 3, cooldownMs: 60_000 });
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('throws CircuitOpenError when OPEN', async () => {
    const cb = new CircuitBreaker('exec-open', { failureThreshold: 1, cooldownMs: 60_000 });
    cb.recordFailure(); // → OPEN
    await expect(cb.execute(() => Promise.resolve('x'))).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('CircuitOpenError carries the correct circuitName', async () => {
    const cb = new CircuitBreaker('exec-err-name', { failureThreshold: 1, cooldownMs: 60_000 });
    cb.recordFailure();
    let caught = null;
    try {
      await cb.execute(() => Promise.resolve());
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught.circuitName).toBe('exec-err-name');
    expect(caught.name).toBe('CircuitOpenError');
    expect(typeof caught.retryAfter).toBe('number');
  });

  it('records failure when the wrapped function throws', async () => {
    const cb = new CircuitBreaker('exec-fail', { failureThreshold: 3, cooldownMs: 60_000 });
    await expect(cb.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(cb.getStats().failures).toBe(1);
  });

  it('records success and resets failure count', async () => {
    const cb = new CircuitBreaker('exec-succ', { failureThreshold: 3, cooldownMs: 60_000 });
    cb.recordFailure();
    cb.recordFailure();
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getStats().failures).toBe(0);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('propagates the original error from the wrapped function', async () => {
    const cb = new CircuitBreaker('exec-propagate', { failureThreshold: 3, cooldownMs: 60_000 });
    const customErr = new Error('custom error message');
    await expect(cb.execute(() => Promise.reject(customErr))).rejects.toBe(customErr);
  });
});

/* ── CircuitBreakerRegistry ───────────────────────────────────────────────── */

describe('CircuitBreakerRegistry', () => {
  it('get() creates a new CircuitBreaker instance', () => {
    const cb = CircuitBreakerRegistry.get('reg-new');
    expect(cb).toBeInstanceOf(CircuitBreaker);
    expect(cb.name).toBe('reg-new');
  });

  it('get() returns the same instance on subsequent calls', () => {
    const a = CircuitBreakerRegistry.get('reg-same');
    const b = CircuitBreakerRegistry.get('reg-same');
    expect(a).toBe(b);
  });

  it('reset() removes the named instance so next get() creates a fresh one', () => {
    const cb1 = CircuitBreakerRegistry.get('reg-reset');
    CircuitBreakerRegistry.reset('reg-reset');
    const cb2 = CircuitBreakerRegistry.get('reg-reset');
    expect(cb1).not.toBe(cb2);
  });

  it('resetAll() clears all registered instances', () => {
    CircuitBreakerRegistry.get('reg-all-a');
    CircuitBreakerRegistry.get('reg-all-b');
    CircuitBreakerRegistry.resetAll();
    expect(CircuitBreakerRegistry.all()).toHaveLength(0);
  });

  it('all() lists all registered circuit breakers with their stats', () => {
    CircuitBreakerRegistry.get('reg-list-x');
    CircuitBreakerRegistry.get('reg-list-y');
    const all = CircuitBreakerRegistry.all();
    const names = all.map((e) => e.name);
    expect(names).toContain('reg-list-x');
    expect(names).toContain('reg-list-y');
    expect(all[0]).toHaveProperty('state');
    expect(all[0]).toHaveProperty('failures');
    expect(all[0]).toHaveProperty('openUntil');
  });

  it('applies custom failureThreshold option', () => {
    const cb = CircuitBreakerRegistry.get('reg-custom', { failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });
});

/* ── CircuitBreaker.getStats() ────────────────────────────────────────────── */

describe('CircuitBreaker.getStats()', () => {
  it('reports correct failure count in CLOSED state', () => {
    const cb = new CircuitBreaker('stats-fail', { failureThreshold: 10, cooldownMs: 60_000 });
    cb.recordFailure();
    cb.recordFailure();
    const s = cb.getStats();
    expect(s.failures).toBe(2);
    expect(s.state).toBe('CLOSED');
    expect(s.openUntil).toBeNull();
  });

  it('reports openUntil timestamp when OPEN', () => {
    const before = Date.now();
    const cb = new CircuitBreaker('stats-open', { failureThreshold: 1, cooldownMs: 10_000 });
    cb.recordFailure();
    const s = cb.getStats();
    expect(s.openUntil).toBeGreaterThan(before);
    expect(s.state).toBe('OPEN');
  });
});
