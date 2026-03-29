/**
 * Processor 12 — CausalityChainProcessor
 *
 * Detects causal chains: Signal A on CI-1 → Signal B on CI-2 → Signal C on CI-3
 * where CI-1 DEPENDS_ON CI-2 DEPENDS_ON CI-3 (represented by ascending
 * topologyDepth). Creates a chain correlation group with ordered narrative.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';
import type { EnrichedSignal } from '../types.js';

const MIN_CHAIN_LENGTH = 3;

export class CausalityChainProcessor implements CorrelationProcessorI {
  readonly name = 'causality-chain';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // Only consider signals that have topology depth
    const withDepth = ctx.signals.filter(s => s.topologyDepth !== undefined);
    if (withDepth.length < MIN_CHAIN_LENGTH) {
      return {
        processorName: this.name,
        proposedGroups,
        suppressedSignalIds: [],
        confidenceAdjustments: new Map(),
      };
    }

    // Group by source system to find chains within same dependency tree
    const bySource = new Map<string, EnrichedSignal[]>();
    for (const s of withDepth) {
      const key = s.sourceSystem;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(s);
    }

    for (const signals of bySource.values()) {
      // Sort by topologyDepth ascending (root → leaf)
      const sorted = [...signals].sort(
        (a, b) => (a.topologyDepth ?? 0) - (b.topologyDepth ?? 0),
      );

      // Find strictly-increasing depth sequences of length >= MIN_CHAIN_LENGTH
      // using a greedy chain-building approach
      const used = new Set<string>();
      for (let i = 0; i < sorted.length; i++) {
        if (used.has(sorted[i]!.internalId)) continue;
        const chain: EnrichedSignal[] = [sorted[i]!];

        for (let j = i + 1; j < sorted.length; j++) {
          const last = chain[chain.length - 1]!;
          const candidate = sorted[j]!;
          if (
            !used.has(candidate.internalId) &&
            (candidate.topologyDepth ?? 0) > (last.topologyDepth ?? 0) &&
            candidate.affectedCiId !== last.affectedCiId
          ) {
            chain.push(candidate);
          }
        }

        if (chain.length >= MIN_CHAIN_LENGTH) {
          chain.forEach(s => used.add(s.internalId));
          const ordered = chain
            .map(s => `CI '${s.affectedCiId ?? 'unknown'}' (depth ${s.topologyDepth})`)
            .join(' → ');

          proposedGroups.push({
            signalIds: chain.map(s => s.internalId),
            correlationMethod: this.name,
            baseConfidence: 40,
            rootCauseCiId: chain[0]!.affectedCiId,
            narrative: `Causal chain detected: ${ordered}.`,
          });
        }
      }
    }

    return {
      processorName: this.name,
      proposedGroups,
      suppressedSignalIds: [],
      confidenceAdjustments: new Map(),
    };
  }
}
