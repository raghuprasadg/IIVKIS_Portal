/**
 * Processor 02 — TopologyProcessor
 *
 * Groups signals on CIs that are within N hops of each other via DEPENDS_ON
 * edges. Assigns topological confidence score based on hop distance.
 *
 * NOTE: In this stub the topology graph is derived from the topologyDepth field
 * on EnrichedSignal (set by the ingest layer before CE runs). CIs sharing the
 * same root (depth 0) or close depths are considered topologically adjacent.
 */
import type { CorrelationProcessorI, ProcessorContext, ProcessorResult, ProposedGroup } from '../types.js';
import { topologicalScore } from '../confidence.js';

const MAX_HOPS = 3;

export class TopologyProcessor implements CorrelationProcessorI {
  readonly name = 'topology';
  readonly version = '1.0.0';

  async process(ctx: ProcessorContext): Promise<ProcessorResult> {
    const proposedGroups: ProposedGroup[] = [];

    // Group by affectedCiId, then find pairs/groups within MAX_HOPS
    const ciSignals = new Map<string, typeof ctx.signals>();
    for (const signal of ctx.signals) {
      const ci = signal.affectedCiId;
      if (!ci) continue;
      if (!ciSignals.has(ci)) ciSignals.set(ci, []);
      ciSignals.get(ci)!.push(signal);
    }

    const ciIds = [...ciSignals.keys()];

    // Build groups: for each CI pair whose depth difference <= MAX_HOPS
    const visited = new Set<string>();
    for (let i = 0; i < ciIds.length; i++) {
      for (let j = i + 1; j < ciIds.length; j++) {
        const ciA = ciIds[i]!;
        const ciB = ciIds[j]!;
        const pairKey = `${ciA}|${ciB}`;
        if (visited.has(pairKey)) continue;

        const signalsA = ciSignals.get(ciA)!;
        const signalsB = ciSignals.get(ciB)!;

        const depthA = signalsA[0]?.topologyDepth ?? 0;
        const depthB = signalsB[0]?.topologyDepth ?? 0;
        const hops = Math.abs(depthA - depthB);

        if (hops <= MAX_HOPS) {
          visited.add(pairKey);
          const tScore = topologicalScore(hops);
          const allSignalIds = [...signalsA, ...signalsB].map(s => s.internalId);
          // Root cause is the CI closer to the top (lower depth)
          const rootCiId = depthA <= depthB ? ciA : ciB;

          proposedGroups.push({
            signalIds: allSignalIds,
            correlationMethod: this.name,
            baseConfidence: 20,
            rootCauseCiId: rootCiId,
            narrative: `CIs '${ciA}' (depth ${depthA}) and '${ciB}' (depth ${depthB}) are ${hops} hop(s) apart. Topological score: ${tScore}.`,
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
