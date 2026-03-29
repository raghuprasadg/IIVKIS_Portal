'use strict';
/**
 * Unit tests — retry utility
 * Source: packages/shared/src/resiliency/retry.ts
 * Compiled: packages/shared/dist/resiliency/retry.js
 */

const path = require('path');
const { retry, isHttpRetryable } = require(
  path.resolve(__dirname, '../../packages/shared/dist/resiliency/retry'),
);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

/* ── success cases ────────────────────────────────────────────────────────── */

describe('retry() — success cases', () => {
  it('returns value on first attempt (no retry needed)', async () => {
    const result = await retry(() => Promise.resolve('hello'), { maxAttempts: 3 });
    expect(result.value).toBe('hello');
    expect(result.attempts).toBe(1);
    expect(typeof result.totalLatencyMs).toBe('number');
  });

  it('succeeds on a later attempt after transient failures', async () => {
    let calls = 0;
    const result = await retry(
      () => {
        calls++;
        if (calls < 3) return Promise.reject(Object.assign(new Error('transient'), { retryable: true }));
        return Promise.resolve('recovered');
      },
      {
        maxAttempts: 5,
        initialDelayMs: 1,
        isRetryable: (err) => err.retryable === true,
      },
    );
    expect(result.value).toBe('recovered');
    expect(result.attempts).toBe(3);
  });

  it('result.attempts equals the number of function invocations', async () => {
    let count = 0;
    const result = await retry(
      () => {
        count++;
        if (count < 2) return Promise.reject(new Error('try again'));
        return Promise.resolve(count);
      },
      { maxAttempts: 3, initialDelayMs: 1 },
    );
    expect(result.attempts).toBe(2);
    expect(result.value).toBe(2);
  });
});

/* ── failure / give-up cases ──────────────────────────────────────────────── */

describe('retry() — failure cases', () => {
  it('throws after exhausting all attempts', async () => {
    await expect(
      retry(() => Promise.reject(new Error('always-fail')), {
        maxAttempts: 2,
        initialDelayMs: 1,
      }),
    ).rejects.toThrow('always-fail');
  });

  it('does not retry when isRetryable returns false', async () => {
    let calls = 0;
    await expect(
      retry(
        () => {
          calls++;
          return Promise.reject(Object.assign(new Error('hard-fail'), { retryable: false }));
        },
        {
          maxAttempts: 5,
          initialDelayMs: 1,
          isRetryable: (err) => err.retryable !== false,
        },
      ),
    ).rejects.toThrow('hard-fail');
    expect(calls).toBe(1); // no retries
  });

  it('preserves the original error thrown by the function', async () => {
    const original = new Error('original');
    await expect(
      retry(() => Promise.reject(original), { maxAttempts: 1 }),
    ).rejects.toBe(original);
  });

  it('throws immediately on first attempt if maxAttempts is 1', async () => {
    let calls = 0;
    await expect(
      retry(
        () => { calls++; return Promise.reject(new Error('x')); },
        { maxAttempts: 1, initialDelayMs: 1 },
      ),
    ).rejects.toThrow('x');
    expect(calls).toBe(1);
  });
});

/* ── abort signal ─────────────────────────────────────────────────────────── */

describe('retry() — AbortSignal', () => {
  it('respects an AbortSignal that fires before any attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      retry(
        () => Promise.resolve('ok'),
        { maxAttempts: 3, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

/* ── isHttpRetryable() ────────────────────────────────────────────────────── */

describe('isHttpRetryable()', () => {
  it.each([429, 502, 503, 504])('returns true for status %i', (status) => {
    expect(isHttpRetryable(status)).toBe(true);
  });

  it.each([200, 201, 301, 400, 401, 403, 404, 500])(
    'returns false for status %i',
    (status) => {
      expect(isHttpRetryable(status)).toBe(false);
    },
  );
});

/* ── options defaults ─────────────────────────────────────────────────────── */

describe('retry() — default options', () => {
  it('uses maxAttempts=3 by default', async () => {
    let calls = 0;
    await expect(
      retry(
        () => { calls++; return Promise.reject(new Error('err')); },
        { initialDelayMs: 1 }, // no maxAttempts specified
      ),
    ).rejects.toThrow();
    expect(calls).toBe(3);
  });
});
