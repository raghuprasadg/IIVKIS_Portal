'use strict';
/**
 * Unit tests — FailoverChain
 * Source: apps/orchestrator/src/resiliency/failover.ts
 * Compiled: apps/orchestrator/dist/resiliency/failover.js
 */

const path = require('path');
const { FailoverChain } = require(
  path.resolve(__dirname, '../../apps/orchestrator/dist/resiliency/failover'),
);
const { CircuitBreakerRegistry } = require(
  path.resolve(__dirname, '../../packages/shared/dist/resiliency/circuit-breaker'),
);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  CircuitBreakerRegistry.resetAll();
  // Clean env vars that affect provider availability
  delete process.env['LLM_API_KEY'];
  delete process.env['AZURE_OPENAI_API_KEY'];
  delete process.env['AZURE_OPENAI_ENDPOINT'];
  delete process.env['NEO4J_URI'];
  delete process.env['DATABASE_URL'];
  delete process.env['KAFKA_BROKERS'];
});
afterEach(() => {
  jest.restoreAllMocks();
  CircuitBreakerRegistry.resetAll();
});

/* ── resolve() — healthy chain ───────────────────────────────────────────── */

describe('FailoverChain.resolve() — healthy chain', () => {
  it('resolves llm-stub when no LLM API key is configured', () => {
    const provider = FailoverChain.resolve('llm');
    expect(provider).not.toBeNull();
    expect(provider.name).toBe('llm-stub');
  });

  it('resolves openai when LLM_API_KEY is set', () => {
    process.env['LLM_API_KEY'] = 'sk-test-key';
    const provider = FailoverChain.resolve('llm');
    expect(provider.name).toBe('openai');
    delete process.env['LLM_API_KEY'];
  });

  it('resolves vector-stub when no DATABASE_URL is configured', () => {
    const provider = FailoverChain.resolve('vector-store');
    expect(provider).not.toBeNull();
    expect(provider.name).toBe('vector-stub');
  });

  it('resolves pgvector when DATABASE_URL is set', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost:5432/iivkis';
    const provider = FailoverChain.resolve('vector-store');
    expect(provider.name).toBe('pgvector');
    delete process.env['DATABASE_URL'];
  });

  it('resolves kg-stub when no NEO4J_URI is configured', () => {
    const provider = FailoverChain.resolve('knowledge-graph');
    expect(provider).not.toBeNull();
    expect(provider.name).toBe('kg-stub');
  });

  it('resolves neo4j when NEO4J_URI is set', () => {
    process.env['NEO4J_URI'] = 'bolt://neo4j:7687';
    const provider = FailoverChain.resolve('knowledge-graph');
    expect(provider.name).toBe('neo4j');
    delete process.env['NEO4J_URI'];
  });

  it('resolves queue-stub when no KAFKA_BROKERS is configured', () => {
    const provider = FailoverChain.resolve('message-queue');
    expect(provider).not.toBeNull();
    expect(provider.name).toBe('queue-stub');
  });

  it('resolves kafka when KAFKA_BROKERS is set', () => {
    process.env['KAFKA_BROKERS'] = 'kafka:9092';
    const provider = FailoverChain.resolve('message-queue');
    expect(provider.name).toBe('kafka');
    delete process.env['KAFKA_BROKERS'];
  });

  it('returns null for an unknown service category', () => {
    const provider = FailoverChain.resolve('unknown-service');
    expect(provider).toBeNull();
  });
});

/* ── resolve() — circuit breaker failover ────────────────────────────────── */

describe('FailoverChain.resolve() — circuit breaker failover', () => {
  it('skips provider with OPEN circuit, falls back to stub', () => {
    process.env['NEO4J_URI'] = 'bolt://neo4j:7687';
    // Trip the neo4j circuit breaker
    const cb = CircuitBreakerRegistry.get('failover:neo4j', { failureThreshold: 1 });
    cb.recordFailure(); // → OPEN
    expect(cb.getState()).toBe('OPEN');

    const provider = FailoverChain.resolve('knowledge-graph');
    expect(provider).not.toBeNull();
    expect(provider.name).toBe('kg-stub'); // skipped neo4j, selected stub
    delete process.env['NEO4J_URI'];
  });

  it('uses primary provider when its circuit is CLOSED', () => {
    process.env['NEO4J_URI'] = 'bolt://neo4j:7687';
    const provider = FailoverChain.resolve('knowledge-graph');
    expect(provider.name).toBe('neo4j'); // circuit closed, use primary
    delete process.env['NEO4J_URI'];
  });

  it('returns null when all providers have OPEN circuits', () => {
    // The stub is always available, so we need to trip it too
    const cbStub = CircuitBreakerRegistry.get('failover:kg-stub', { failureThreshold: 1 });
    cbStub.recordFailure(); // → OPEN
    // No NEO4J_URI → neo4j isAvailable() = false, stub circuit is OPEN
    const provider = FailoverChain.resolve('knowledge-graph');
    expect(provider).toBeNull();
  });
});

/* ── status() ─────────────────────────────────────────────────────────────── */

describe('FailoverChain.status()', () => {
  it('returns an entry for each service category', () => {
    const status = FailoverChain.status();
    expect(status).toHaveProperty('llm');
    expect(status).toHaveProperty('vector-store');
    expect(status).toHaveProperty('knowledge-graph');
    expect(status).toHaveProperty('message-queue');
  });

  it('each entry is an array of provider descriptors with required fields', () => {
    const status = FailoverChain.status();
    for (const category of Object.values(status)) {
      expect(Array.isArray(category)).toBe(true);
      for (const provider of category) {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('available');
        expect(provider).toHaveProperty('cbState');
        expect(provider).toHaveProperty('label');
      }
    }
  });

  it('stub providers are always marked as available', () => {
    const status = FailoverChain.status();
    const llmStub = status['llm'].find((p) => p.name === 'llm-stub');
    expect(llmStub).toBeDefined();
    expect(llmStub.available).toBe(true);
  });

  it('primary providers reflect env-var availability', () => {
    const status = FailoverChain.status();
    const neo4j = status['knowledge-graph'].find((p) => p.name === 'neo4j');
    expect(neo4j.available).toBe(false); // NEO4J_URI not set
  });
});

/* ── register() ───────────────────────────────────────────────────────────── */

describe('FailoverChain.register()', () => {
  it('allows overriding a chain with a custom provider list', () => {
    // Save and restore the original chain
    const originalChain = FailoverChain.status()['llm'];

    FailoverChain.register('llm', [
      {
        name: 'custom-provider',
        isAvailable: () => true,
        statusLabel: () => 'custom',
      },
    ]);

    const provider = FailoverChain.resolve('llm');
    expect(provider.name).toBe('custom-provider');

    // Restore original — just re-register the original providers
    FailoverChain.register('llm', [
      { name: 'openai', isAvailable: () => Boolean(process.env['LLM_API_KEY']), statusLabel: () => 'configured' },
      { name: 'azure-openai', isAvailable: () => false, statusLabel: () => 'no-key' },
      { name: 'llm-stub', isAvailable: () => true, statusLabel: () => 'stub' },
    ]);
  });
});
