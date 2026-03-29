/**
 * Provider / service failover configuration (Phase 7 — Resiliency).
 *
 * Defines failover chains for the four critical service categories:
 *  1. LLM providers     — primary OpenAI → fallback Azure OpenAI → stub
 *  2. Vector store       — primary pgvector → fallback in-process stub
 *  3. Knowledge graph    — primary Neo4j → fallback topology stub
 *  4. Message queue      — primary Kafka → fallback in-process queue
 *
 * Each entry in a chain is tried in order; the first that succeeds is used.
 * A circuit breaker is attached to each provider so failed providers are
 * automatically skipped during their cooldown window.
 *
 * Usage:
 *   const llmProvider = await FailoverChain.resolve('llm');
 */

import { CircuitBreakerRegistry } from '@iivkis/shared';

export type ServiceCategory = 'llm' | 'vector-store' | 'knowledge-graph' | 'message-queue';

export interface ProviderDescriptor {
  /** Human-readable name for logging. */
  name: string;
  /** Circuit-breaker key (defaults to name). */
  cbKey?: string;
  /** Returns true if this provider is configured and reachable. */
  isAvailable: () => boolean;
  /** Returns a provider-specific status string for health checks. */
  statusLabel: () => string;
}

/** Registered failover chains, keyed by ServiceCategory. */
const chains = new Map<ServiceCategory, ProviderDescriptor[]>();

/* ── LLM provider chain ──────────────────────────────────────────────────── */

chains.set('llm', [
  {
    name: 'openai',
    isAvailable: () => Boolean(process.env['LLM_API_KEY']),
    statusLabel: () => process.env['LLM_API_KEY'] ? 'configured' : 'no-key',
  },
  {
    name: 'azure-openai',
    isAvailable: () => Boolean(process.env['AZURE_OPENAI_API_KEY'] && process.env['AZURE_OPENAI_ENDPOINT']),
    statusLabel: () =>
      process.env['AZURE_OPENAI_API_KEY'] ? 'configured' : 'no-key',
  },
  {
    name: 'llm-stub',
    isAvailable: () => true, // always available — returns mock responses
    statusLabel: () => 'stub',
  },
]);

/* ── Vector store chain ──────────────────────────────────────────────────── */

chains.set('vector-store', [
  {
    name: 'pgvector',
    isAvailable: () => Boolean(process.env['DATABASE_URL']),
    statusLabel: () => process.env['DATABASE_URL'] ? 'configured' : 'no-url',
  },
  {
    name: 'vector-stub',
    isAvailable: () => true,
    statusLabel: () => 'stub',
  },
]);

/* ── Knowledge graph chain ───────────────────────────────────────────────── */

chains.set('knowledge-graph', [
  {
    name: 'neo4j',
    isAvailable: () => Boolean(process.env['NEO4J_URI']),
    statusLabel: () => process.env['NEO4J_URI'] ? 'configured' : 'no-uri',
  },
  {
    name: 'kg-stub',
    isAvailable: () => true,
    statusLabel: () => 'stub',
  },
]);

/* ── Message queue chain ─────────────────────────────────────────────────── */

chains.set('message-queue', [
  {
    name: 'kafka',
    isAvailable: () => Boolean(process.env['KAFKA_BROKERS']),
    statusLabel: () => process.env['KAFKA_BROKERS'] ? 'configured' : 'no-brokers',
  },
  {
    name: 'queue-stub',
    isAvailable: () => true,
    statusLabel: () => 'stub',
  },
]);

/* ── public API ──────────────────────────────────────────────────────────── */

export const FailoverChain = {
  /**
   * Resolve the first healthy provider in the failover chain for a category.
   * A provider is considered healthy when isAvailable() returns true AND its
   * circuit breaker is not OPEN.
   *
   * @returns The selected ProviderDescriptor, or null if the chain is exhausted.
   */
  resolve(category: ServiceCategory): ProviderDescriptor | null {
    const chain = chains.get(category);
    if (!chain) return null;

    for (const provider of chain) {
      if (!provider.isAvailable()) continue;

      const cbKey = provider.cbKey ?? provider.name;
      const cb = CircuitBreakerRegistry.get(`failover:${cbKey}`);
      if (cb.isOpen()) {
        console.log(`[failover:${category}] Skipping '${provider.name}' — circuit is OPEN`);
        continue;
      }

      return provider;
    }

    console.warn(`[failover:${category}] All providers exhausted`);
    return null;
  },

  /**
   * Return a summary of all providers in all chains, including their CB state.
   * Useful for health-check endpoints.
   */
  status(): Record<string, Array<{ name: string; available: boolean; cbState: string; label: string }>> {
    const result: Record<string, Array<{ name: string; available: boolean; cbState: string; label: string }>> = {};
    for (const [category, chain] of chains.entries()) {
      result[category] = chain.map((p) => {
        const cbKey = p.cbKey ?? p.name;
        const cb = CircuitBreakerRegistry.get(`failover:${cbKey}`);
        return {
          name: p.name,
          available: p.isAvailable(),
          cbState: cb.getState(),
          label: p.statusLabel(),
        };
      });
    }
    return result;
  },

  /** Register a custom failover chain (for testing or extension). */
  register(category: ServiceCategory, chain: ProviderDescriptor[]): void {
    chains.set(category, chain);
  },
};
